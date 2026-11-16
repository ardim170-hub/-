/* ---------- 과정상담일지: 원본 양식(hwpx)에 값만 채우기 ----------
   원본 '과정상담일지.hwp'를 한글에서 hwpx로 저장한 빈 양식(proc-template.js)을 그대로 쓰고 빈칸 글자만 바꾼다.
   상담방법은 원본 글자를 그대로 두고, 고른 항목만 굵은 글씨+밑줄로 표시한다(직원들이 손으로 표시하던 방식).
   칸 번호는 원본 표의 칸 순서(1부터)다. */
const PROC_CELLS={7:"name",9:"birth",11:"counselor",13:"date",15:"place",17:"relation",19:"purpose",23:"content",25:"result",27:"supervision"};
const PROC_METHODS=[["① 전화상담","② 내방상담","③ 방문상담"],["④ 인터넷상담","⑤ 문자상담","⑥ 기타(현장상담)"]];

async function buildProcHwpx(JSZip, v){
  const HP="http://www.hancom.co.kr/hwpml/2011/paragraph", HH="http://www.hancom.co.kr/hwpml/2011/head";
  const bin=atob(window.PROC_TEMPLATE_B64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const zip=await JSZip.loadAsync(bytes);
  const parse=s=>{const d=new DOMParser().parseFromString(s,"application/xml");if(d.getElementsByTagName("parsererror").length)throw new Error("양식 읽기 실패");return d;};
  const ser=d=>{let o=new XMLSerializer().serializeToString(d);if(!/^<\?xml/.test(o))o='<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'+o;return o;};

  // 굵은 글씨+밑줄 글자 모양 하나 추가(원본 '상담방법' 글자 모양을 복사해서 굵게·밑줄만 더함)
  const head=parse(await zip.file("Contents/header.xml").async("string"));
  const cps=head.getElementsByTagNameNS(HH,"charProperties")[0];
  const list=[...cps.getElementsByTagNameNS(HH,"charPr")];
  const base=list.find(c=>c.getAttribute("id")==="1");
  const newId=String(Math.max(...list.map(c=>+c.getAttribute("id")))+1);
  const mark=base.cloneNode(true); mark.setAttribute("id",newId);
  [...mark.childNodes].forEach(n=>{if(n.localName==="bold")mark.removeChild(n);});
  const off=[...mark.childNodes].find(n=>n.localName==="offset");
  const ital=[...mark.childNodes].find(n=>n.localName==="italic");
  const bold=head.createElementNS(HH,"hh:bold");
  mark.insertBefore(bold,(ital||off).nextSibling);
  let ul=[...mark.childNodes].find(n=>n.localName==="underline");
  if(ul) ul.setAttribute("type","BOTTOM");
  else{ul=head.createElementNS(HH,"hh:underline");ul.setAttribute("type","BOTTOM");ul.setAttribute("shape","SOLID");ul.setAttribute("color","#000000");mark.insertBefore(ul,bold.nextSibling);}
  cps.appendChild(mark); cps.setAttribute("itemCnt",String(list.length+1));
  zip.file("Contents/header.xml",ser(head));

  const doc=parse(await zip.file("Contents/section0.xml").async("string"));
  const tcs=doc.getElementsByTagNameNS(HP,"tc");
  if(tcs.length!==27) throw new Error("양식 칸 수가 다름");
  const kids=(n,name)=>[...n.childNodes].filter(c=>c.localName===name);
  function dropLineseg(p){kids(p,"linesegarray").forEach(n=>p.removeChild(n));}
  function setRuns(p,parts){ // parts: [{t,cp}]
    dropLineseg(p);
    const runs=kids(p,"run"); const cp0=runs[0]?runs[0].getAttribute("charPrIDRef"):"0";
    runs.forEach(r=>p.removeChild(r));
    parts.filter(x=>x.t).forEach(x=>{const r=doc.createElementNS(HP,"hp:run");r.setAttribute("charPrIDRef",x.cp||cp0);
      const t=doc.createElementNS(HP,"hp:t");t.textContent=x.t;r.appendChild(t);p.appendChild(r);});
    if(!kids(p,"run").length){const r=doc.createElementNS(HP,"hp:run");r.setAttribute("charPrIDRef",cp0);p.appendChild(r);}
  }
  function setCell(tc,text){
    const sub=kids(tc,"subList")[0], ps=kids(sub,"p"), model=ps[0];
    ps.slice(1).forEach(p=>sub.removeChild(p));
    const cp0=(kids(model,"run")[0]||{getAttribute:()=>"0"}).getAttribute("charPrIDRef");
    const lines=String(text||"").split("\n").map(x=>x.trim()).filter(Boolean);
    setRuns(model,[{t:lines[0]||"",cp:cp0}]);
    let prev=model;
    lines.slice(1).forEach(line=>{const p=model.cloneNode(true);setRuns(p,[{t:line,cp:cp0}]);sub.insertBefore(p,prev.nextSibling);prev=p;});
  }
  Object.entries(PROC_CELLS).forEach(([n,k])=>setCell(tcs[+n-1],v[k]));

  // 21번 칸: 상담방법. 원본 두 줄 글자는 그대로, 고른 항목만 굵게+밑줄
  const sub=kids(tcs[20],"subList")[0], ps=kids(sub,"p");
  const m=Math.max(0,Math.min(5,(+v.method||2)-1)), line=Math.floor(m/3);
  ps.forEach((p,li)=>{
    const run=kids(p,"run")[0], cp=run?run.getAttribute("charPrIDRef"):"1";
    let text=[...p.getElementsByTagNameNS(HP,"t")].map(t=>t.textContent).join("");
    let label=PROC_METHODS[li][m%3];
    if(li===line && m===5 && v.methodEtc){const nl="⑥ 기타("+v.methodEtc+")";text=text.replace(label,nl);label=nl;}
    if(li!==line){setRuns(p,[{t:text,cp}]);return;}
    const i=text.indexOf(label);
    if(i<0){setRuns(p,[{t:text,cp}]);return;}
    setRuns(p,[{t:text.slice(0,i),cp},{t:label,cp:newId},{t:text.slice(i+label.length),cp}]);
  });

  zip.file("Contents/section0.xml",ser(doc));
  zip.file("mimetype","application/hwp+zip",{compression:"STORE"});
  return zip.generateAsync({type:"blob",mimeType:"application/hwp+zip",compression:"DEFLATE"});
}
