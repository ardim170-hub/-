/* ---------- 취업알선 적합성 분석지: 원본 양식(hwpx)에 값만 채우기 ----------
   원본 '취업알선 적합성 분석지.hwp'를 한글에서 hwpx로 저장한 빈 양식(fit-template.js)을 그대로 쓰고,
   빈 칸의 글자만 바꾼다. 칸 모양·글꼴·너비·머리칸 색은 손대지 않는다.
   칸 번호는 원본 표의 칸 순서(1부터, 위→아래, 왼쪽→오른쪽)다. */
const FIT_CELLS={6:"date_s",7:"date_j",10:"reg_s",12:"reg_j",14:"name",16:"biz",18:"birth",20:"jsex",22:"sex",24:"jage",
  26:"dis",28:"jdis",30:"addr_s",32:"addr_j",34:"tel_s",36:"tel_j",39:"car_s",41:"car_j",43:"lic_s",45:"lic_j",47:"abil",49:"skill",
  52:"emp_s",53:"emp_j",55:"hrs_s",56:"hrs_j",58:"lunch_s",59:"lunch_j",61:"pay_s",62:"pay_j",64:"hol_s",65:"hol_j",67:"loc_s",68:"loc_j",
  70:"fit",73:"op_s",75:"op_b",77:"op_m"};

async function buildFitHwpx(JSZip, v){
  const HP="http://www.hancom.co.kr/hwpml/2011/paragraph";
  const bin=atob(window.FIT_TEMPLATE_B64), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file("Contents/section0.xml").async("string");
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.getElementsByTagName("parsererror").length) throw new Error("양식 읽기 실패");
  const tcs=doc.getElementsByTagNameNS(HP,"tc");
  if(tcs.length!==77) throw new Error("양식 칸 수가 다름");

  // 문단 하나를 본보기로 남기고 글자만 바꾼다(문단·글자 모양 번호는 원본 그대로)
  function setParaText(p,text){
    [...p.childNodes].forEach(n=>{if(n.localName==="linesegarray")p.removeChild(n);});
    const runs=[...p.childNodes].filter(n=>n.localName==="run");
    const run=runs[0]||p.appendChild(doc.createElementNS(HP,"hp:run"));
    runs.slice(1).forEach(r=>p.removeChild(r));
    [...run.childNodes].forEach(n=>run.removeChild(n));
    if(text){const t=doc.createElementNS(HP,"hp:t");t.textContent=text;run.appendChild(t);}
  }
  function setCell(tc,text){
    const sub=[...tc.childNodes].find(n=>n.localName==="subList");
    const ps=[...sub.childNodes].filter(n=>n.localName==="p");
    const model=ps[0]; ps.slice(1).forEach(p=>sub.removeChild(p));
    const lines=String(text||"").split("\n").map(x=>x.trim()).filter(Boolean);
    if(!lines.length){setParaText(model,"");return;}
    setParaText(model,lines[0]);
    let prev=model;
    lines.slice(1).forEach(line=>{const p=model.cloneNode(true);setParaText(p,line);sub.insertBefore(p,prev.nextSibling);prev=p;});
  }

  Object.entries(FIT_CELLS).forEach(([n,k])=>setCell(tcs[+n-1],v[k]));
  // 1번 칸: 제목은 그대로, '작성자:      (인)' 줄에 이름만 넣는다
  [...tcs[0].getElementsByTagNameNS(HP,"t")].forEach(t=>{
    if(/작성자/.test(t.textContent)) t.textContent="작성자: "+(v.writer||"     ")+"   (인)";
  });

  let out=new XMLSerializer().serializeToString(doc);
  if(!/^<\?xml/.test(out)) out='<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'+out;
  zip.file("Contents/section0.xml",out);
  zip.file("mimetype","application/hwp+zip",{compression:"STORE"});
  return zip.generateAsync({type:"blob",mimeType:"application/hwp+zip",compression:"DEFLATE"});
}
