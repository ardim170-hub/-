/* ---------- 월별 고용지원사업 서류: 원본 양식(hwpx)에 값만 채우기 ----------
   PLAN   = 11월 실시계획서 양식(표 칸 120개)
   REPORT = 9월 결과보고서 양식(표 칸 132개)
   L1~L6  = 사업별 현황 리스트(구직상담·취업알선·취업확정·사후관리·고용자원개발·사업체 관리)
   칸 번호는 원본 표 칸 순서(1부터). 칸 모양·글꼴은 그대로 두고 글자만 바꾼다. */
(function(){
  const HP="http://www.hancom.co.kr/hwpml/2011/paragraph";
  const kids=(n,name)=>[...n.childNodes].filter(c=>c.localName===name);
  const paras=tc=>kids(kids(tc,"subList")[0],"p");
  const paraText=p=>[...p.getElementsByTagNameNS(HP,"t")].map(t=>t.textContent).join("");
  const S=v=>String(v==null?"":v);

  async function open(b64){
    const bin=atob(b64), bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const zip=await JSZip.loadAsync(bytes);
    const xml=await zip.file("Contents/section0.xml").async("string");
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    if(doc.getElementsByTagName("parsererror").length) throw new Error("양식 읽기 실패");
    // 문단 모양 중 자동 글머리표('-')가 붙는 것
    const head=await zip.file("Contents/header.xml").async("string");
    const bul=new Set();
    head.replace(/<hh:paraPr\b[^>]*\bid="(\d+)"[\s\S]*?<\/hh:paraPr>/g,(m,id)=>{if(/<hh:heading[^>]*type="BULLET"/.test(m))bul.add(id);return m;});
    return {zip,doc,bul,tcs:doc.getElementsByTagNameNS(HP,"tc")};
  }
  async function closeBlob(o){
    let out=new XMLSerializer().serializeToString(o.doc);
    if(!/^<\?xml/.test(out)) out='<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'+out;
    o.zip.file("Contents/section0.xml",out);
    o.zip.file("mimetype","application/hwp+zip",{compression:"STORE"});
    return o.zip.generateAsync({type:"blob",mimeType:"application/hwp+zip",compression:"DEFLATE"});
  }
  function setParaText(doc,p,text){
    kids(p,"linesegarray").forEach(n=>p.removeChild(n));
    const runs=kids(p,"run");
    const run=runs[0]||p.appendChild(doc.createElementNS(HP,"hp:run"));
    runs.slice(1).forEach(r=>p.removeChild(r));
    [...run.childNodes].forEach(n=>{if(n.localName==="t")run.removeChild(n);});
    if(text){const t=doc.createElementNS(HP,"hp:t");t.textContent=text;run.appendChild(t);}
  }
  // 칸 글자 통째로(여러 줄이면 첫 문단 모양으로 늘림)
  function setCell(doc,tc,text){
    const sub=kids(tc,"subList")[0], ps=kids(sub,"p"), model=ps[0];
    ps.slice(1).forEach(p=>sub.removeChild(p));
    const lines=S(text).split("\n");
    setParaText(doc,model,lines[0]||"");
    let prev=model;
    lines.slice(1).forEach(line=>{const p=model.cloneNode(true);setParaText(doc,p,line);sub.insertBefore(p,prev.nextSibling);prev=p;});
  }
  // 여러 줄 글 칸: 줄마다 원래 칸의 같은 종류 문단 모양을 씀
  //  제목 줄(<직업상담>, 1) 구직상담) / '- ' 항목 줄(자동 글머리표 문단이면 '- '를 떼고 넣음) / 그냥 줄
  const HEAD=/^\s*(<[^>]*>|\d+\)|\(\d+\))/;
  function kindOf(p,bul){const t=paraText(p);if(HEAD.test(t))return "head";if(bul.has(p.getAttribute("paraPrIDRef")))return "bullet";if(/^\s*-/.test(t))return "dash";return "plain";}
  function setLines(doc,tc,text,bul){
    const sub=kids(tc,"subList")[0], ps=kids(sub,"p");
    const info=ps.map(p=>({p:p.cloneNode(true),k:kindOf(p,bul)}));
    const find=(...ks)=>{for(const k of ks){const x=info.find(i=>i.k===k);if(x)return x.p;}return info[0].p;};
    ps.forEach(p=>sub.removeChild(p));
    const lines=S(text).split("\n").map(x=>x.replace(/\s+$/,"")).filter((x,i,a)=>x.trim()||(i>0&&i<a.length-1));
    if(!lines.length) lines.push("");
    lines.forEach((line,i)=>{
      const pos=info[i]; let model, t=line;
      if(HEAD.test(line)) model=pos&&pos.k==="head"?pos.p:find("head","plain","bullet","dash");
      else if(/^\s*-/.test(line)){
        model=pos&&(pos.k==="bullet"||pos.k==="dash")?pos.p:find("bullet","dash","plain");
        if(bul.has(model.getAttribute("paraPrIDRef"))) t=t.replace(/^\s*-\s*/,"");
      }else model=pos&&pos.k==="plain"?pos.p:find("plain","head","dash","bullet");
      const p=model.cloneNode(true); setParaText(doc,p,t); sub.appendChild(p);
    });
  }
  // 칸 글자를 읽어 화면 기본값으로(자동 글머리표 문단은 '- '를 붙여 보여 줌)
  function readLines(tc,bul){
    return paras(tc).map(p=>{const t=paraText(p);return kindOf(p,bul)==="bullet"&&t.trim()?"- "+t.trim():t;}).join("\n");
  }
  // 본문(표 밖) 문단에서 글자 바꾸기
  function replaceBody(doc,re,fn){
    const sec=doc.documentElement;
    for(const p of kids(sec,"p")){
      for(const t of p.getElementsByTagNameNS(HP,"t")){
        let a=t; while(a&&a!==p){if(a.localName==="tbl")break;a=a.parentNode;}
        if(a!==p) continue;
        if(re.test(t.textContent)){t.textContent=t.textContent.replace(re,fn);re.lastIndex=0;return true;}
      }
    }
    return false;
  }
  const pct=(a,b)=>b>0?Math.round(a/b*100)+"%":"-";

  /* ----- 서식에서 기본 글 읽기 ----- */
  async function readDefaults(){
    const P=await open(window.MONTHLY_TPL.plan), R=await open(window.MONTHLY_TPL.report);
    const c=(o,n)=>o.tcs[n-1];
    return {
      plan:{methods:[11,18,22,27,32,36].map(n=>readLines(c(P,n),P.bul)),
        budget:{item:paraText(paras(c(P,91))[0]),amount:paraText(paras(c(P,92))[0]),basis:paraText(paras(c(P,93))[0]),note:paraText(paras(c(P,94))[0])},
        targets:[[14,15,16],[19,20,21],[23,24,25],[28,29,30],[33,34,35],[37,38,39]].map(a=>a.map(n=>parseInt(paraText(paras(c(P,n))[0]))||0))},
      report:{methods:[11,18,22,27,32,36].map(n=>readLines(c(R,n),R.bul)),
        evals:[113,117,120,124,128,131].map(n=>readLines(c(R,n),R.bul).split("\n").slice(1).join("\n")),
        future:readLines(c(R,132),R.bul)}
    };
  }

  /* ----- 실시계획서 ----- */
  // d = {y,m,period,start,end, targets[6][3], methods[6], weeks[6][5], budget{item,amount,basis,note}}
  async function buildPlan(d){
    const o=await open(window.MONTHLY_TPL.plan), {doc,tcs,bul}=o, c=n=>tcs[n-1];
    if(tcs.length!==120) throw new Error("실시계획서 양식 칸 수가 다름");
    setCell(doc,c(1),d.y+"년 "+d.m+"월 고용지원사업 실시계획서");
    replaceBody(doc,/(기\s*간\s*:\s*).*/,(x,a)=>a+d.period);
    setCell(doc,c(12),d.start+"\n~\n"+d.end);
    [11,18,22,27,32,36].forEach((n,i)=>setLines(doc,c(n),d.methods[i],bul));
    const T=d.targets, cells=[[14,15,16],[19,20,21],[23,24,25],[28,29,30],[33,34,35],[37,38,39]];
    cells.forEach((a,i)=>{
      setCell(doc,c(a[0]),T[i][0]+"회");
      if(i<4){setCell(doc,c(a[1]),T[i][1]+"명");setCell(doc,c(a[2]),T[i][2]+"명");}
    });
    const sum=k=>T.slice(0,k===0?6:4).reduce((s,r)=>s+(+r[k]||0),0);
    setCell(doc,c(41),sum(0)+"회"); setCell(doc,c(42),sum(1)+"명"); setCell(doc,c(43),sum(2)+"명");
    setCell(doc,c(45),d.m+"월");
    for(let r=0;r<6;r++) for(let w=0;w<5;w++) setCell(doc,c(52+r*6+w),d.weeks[r][w]?"▶":"");
    const b=d.budget;
    setCell(doc,c(91),b.item); setCell(doc,c(92),b.amount); setCell(doc,c(93),b.basis); setCell(doc,c(94),b.note);
    setCell(doc,c(96),b.amount);
    [108,112,116,120].forEach(n=>setCell(doc,c(n),d.m+"월"));
    return closeBlob(o);
  }

  /* ----- 결과보고서 ----- */
  // d = {y,m,period,start,end, targets[6][3], actual[6][3], methods[6], weeks[6][5], evals[6](자동 문장 뺀 나머지), autoEval[6], future, spend{item,budget,used,detail,left,note}}
  async function buildReport(d){
    const o=await open(window.MONTHLY_TPL.report), {doc,tcs,bul}=o, c=n=>tcs[n-1];
    if(tcs.length!==132) throw new Error("결과보고서 양식 칸 수가 다름");
    setCell(doc,c(1),d.y+"년 "+d.m+"월 고용지원사업 결과보고서");
    replaceBody(doc,/(기\s*간\s*:\s*).*/,(x,a)=>a+d.period);
    setCell(doc,c(12),d.y+". \n"+d.start.replace(/^\d{4}\.\s*/,"")+"\n~\n"+d.end);
    [11,18,22,27,32,36].forEach((n,i)=>setLines(doc,c(n),d.methods[i],bul));
    const T=d.targets, A=d.actual, cells=[[14,15,16],[19,20,21],[23,24,25],[28,29,30],[33,34,35],[37,38,39]];
    cells.forEach((a,i)=>{
      setCell(doc,c(a[0]),A[i][0]+"회\n("+pct(A[i][0],T[i][0])+")");
      if(i<4){setCell(doc,c(a[1]),A[i][1]+"명\n("+pct(A[i][1],T[i][1])+")");setCell(doc,c(a[2]),A[i][2]+"명\n("+pct(A[i][2],T[i][2])+")");}
    });
    const sum=(M,k)=>M.slice(0,k===0?6:4).reduce((s,r)=>s+(+r[k]||0),0);
    [41,42,43].forEach((n,k)=>setCell(doc,c(n),sum(A,k)+(k?"명":"회")+"\n("+pct(sum(A,k),sum(T,k))+")"));
    setCell(doc,c(45),d.m+"월");
    for(let r=0;r<6;r++) for(let w=0;w<5;w++) setCell(doc,c(52+r*6+w),d.weeks[r][w]?"▶":"");
    const s=d.spend;
    setCell(doc,c(93),s.item); setCell(doc,c(94),s.budget); setCell(doc,c(95),s.used); setCell(doc,c(96),s.detail); setCell(doc,c(97),s.left); setCell(doc,c(98),s.note);
    setCell(doc,c(100),s.budget); setCell(doc,c(101),s.used); setCell(doc,c(102),s.left); setCell(doc,c(103),"");
    [112,116,119,123].forEach(n=>{const sub=kids(c(n),"subList")[0];kids(sub,"p").forEach(p=>{const t=paraText(p);if(/\d+월/.test(t))setParaText(doc,p,t.replace(/\d+월/,d.m+"월"));});});
    [113,117,120,124,128,131].forEach((n,i)=>setLines(doc,c(n),"- "+d.autoEval[i]+(S(d.evals[i]).trim()?"\n"+d.evals[i]:""),bul));
    setLines(doc,c(132),d.future,bul);
    return closeBlob(o);
  }

  /* ----- 사업별 현황 리스트(표 줄 수를 기록 수에 맞춤) ----- */
  async function buildList(key,m,y,rows,total){
    const o=await open(window.MONTHLY_TPL[key]), {doc}=o;
    const tbl=doc.getElementsByTagNameNS(HP,"tbl")[0];
    const trs=kids(tbl,"tr"), model=trs[1];
    trs.slice(1).forEach(tr=>tbl.removeChild(tr));
    const data=rows.length?rows:[[]];
    data.forEach((vals,ri)=>{
      const tr=model.cloneNode(true);
      kids(tr,"tc").forEach((tc,ci)=>{
        const a=kids(tc,"cellAddr")[0]; if(a) a.setAttribute("rowAddr",String(ri+1));
        setCell(doc,tc,vals[ci]==null?"":S(vals[ci]));
      });
      tbl.appendChild(tr);
    });
    tbl.setAttribute("rowCnt",String(data.length+1));
    replaceBody(doc,/\d{4}년/,()=>y+"년");
    replaceBody(doc,/\d{1,2}월/,()=>m+"월");
    replaceBody(doc,/합계\s*:\s*\d+\s*회?/,x=>x.replace(/\d+/,String(total)));
    return closeBlob(o);
  }

  window.MonthlyHwpx={readDefaults,buildPlan,buildReport,buildList};
})();
