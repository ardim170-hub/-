/* ---------- 서류 파일 읽기: hwp / hwpx / xlsx / csv ----------
   hwp·hwpx는 표의 칸을 문서 순서대로 읽고, 굵은 글씨+밑줄로 표시된 글자(고른 항목)를 따로 표시한다.
   보안(DRM, 파일 머리가 "BMS Docu")이 걸린 파일은 브라우저에서 열 수 없다. */
(function(){
  const HP="http://www.hancom.co.kr/hwpml/2011/paragraph", HH="http://www.hancom.co.kr/hwpml/2011/head";
  const ascii=(b,n)=>String.fromCharCode(...b.slice(0,n));

  async function sniff(file){
    const buf=new Uint8Array(await file.arrayBuffer());
    const name=file.name.toLowerCase();
    if(ascii(buf,8)==="BMS Docu") return {kind:"drm",buf};
    if(buf[0]===0xD0&&buf[1]===0xCF&&buf[2]===0x11&&buf[3]===0xE0){
      if(/\.xls$/.test(name)) return {kind:"xlsx",buf};
      return {kind:"hwp",buf};
    }
    if(buf[0]===0x50&&buf[1]===0x4B){
      const zip=await JSZip.loadAsync(buf);
      if(zip.file("Contents/section0.xml")) return {kind:"hwpx",buf,zip};
      if(zip.file("xl/workbook.xml")) return {kind:"xlsx",buf};
      return {kind:"unknown",buf};
    }
    if(/\.csv$/.test(name)) return {kind:"csv",buf};
    return {kind:"unknown",buf};
  }

  /* hwpx: 칸 = {t:글자, m:[굵게+밑줄 글자 조각]} */
  async function cellsFromHwpx(zip){
    const head=new DOMParser().parseFromString(await zip.file("Contents/header.xml").async("string"),"application/xml");
    const marked={};
    [...head.getElementsByTagNameNS(HH,"charPr")].forEach(c=>{
      const b=[...c.childNodes].some(n=>n.localName==="bold");
      const u=[...c.childNodes].find(n=>n.localName==="underline");
      marked[c.getAttribute("id")]=b&&u&&u.getAttribute("type")!=="NONE";
    });
    const cells=[], body=[];
    const names=Object.keys(zip.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)).sort();
    for(const n of names){
      const doc=new DOMParser().parseFromString(await zip.file(n).async("string"),"application/xml");
      [...doc.getElementsByTagNameNS(HP,"t")].forEach(t=>body.push(t.textContent));
      [...doc.getElementsByTagNameNS(HP,"tc")].forEach(tc=>{
        const sub=[...tc.childNodes].find(x=>x.localName==="subList"); if(!sub) return;
        const paras=[...sub.childNodes].filter(x=>x.localName==="p");
        const lines=[], m=[];
        paras.forEach(p=>{
          let line="", seg="";
          [...p.childNodes].filter(x=>x.localName==="run").forEach(r=>{
            const txt=[...r.childNodes].filter(x=>x.localName==="t").map(x=>x.textContent).join("");
            if(marked[r.getAttribute("charPrIDRef")]){seg+=txt;} else if(seg){m.push(seg);seg="";}
            line+=txt;
          });
          if(seg) m.push(seg);
          lines.push(line);
        });
        cells.push({t:lines.join("\n").trim(),m:m.map(x=>x.trim()).filter(Boolean)});
      });
    }
    return {cells,body:body.join(" ")};
  }

  /* hwp(보안 없는 파일): hwp.js로 읽기 */
  function cellsFromHwp(buf){
    if(!window.hwpParse) throw new Error("hwp 읽기 도구를 불러오지 못했습니다");
    const doc=window.hwpParse(buf,{type:"array"});
    const cs=doc.info.charShapes||[];
    const isMarked=i=>{const a=(cs[i]&&cs[i].attr)||0;return !!(a&2)&&((a>>2)&3)!==0;};
    const cells=[], body=[];
    function paraText(p){
      let pos=0, line="", seg="", m=[];
      const sb=(p.shapeBuffer||[]).slice().sort((a,b)=>a.pos-b.pos);
      const shapeAt=x=>{let s=sb.length?sb[0].shapeIndex:0;for(const e of sb){if(e.pos<=x)s=e.shapeIndex;else break;}return s;};
      (p.content||[]).forEach(ch=>{
        const plain=ch.type===0&&typeof ch.value==="string";
        if(plain){
          if(isMarked(shapeAt(pos))) seg+=ch.value; else if(seg){m.push(seg);seg="";}
          line+=ch.value; pos+=1;
        }else{ if(seg){m.push(seg);seg="";} pos+=(ch.type===0?1:8); }
      });
      if(seg) m.push(seg);
      return {line,m};
    }
    function walkParas(paras,inCell){
      (paras||[]).forEach(p=>{
        if(!inCell) body.push(paraText(p).line);
        (p.controls||[]).forEach(c=>{
          if(!Array.isArray(c.content)) return;
          c.content.forEach(row=>(row||[]).forEach(cell=>{
            if(!cell||!cell.items) return;
            const lines=[], m=[];
            cell.items.forEach(it=>{const r=paraText(it);lines.push(r.line);m.push(...r.m);body.push(r.line);});
            cells.push({t:lines.join("\n").trim(),m:m.map(x=>x.trim()).filter(Boolean)});
            walkParas(cell.items,true);
          }));
        });
      });
    }
    (doc.sections||[]).forEach(sec=>walkParas(sec.content,false));
    return {cells,body:body.join(" ")};
  }

  function rowsFromSheet(buf,kind){
    const wb=XLSX.read(buf,{type:"array",cellDates:true});
    return wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,dateNF:"yyyy-mm-dd",defval:""})}));
  }

  window.FormReader={sniff,cellsFromHwpx,cellsFromHwp,rowsFromSheet};
})();
