/* ---------- 이력서 2종: 원본 양식(hwpx)에 값만 채우기 ----------
   A = 바탕화면 '이력서(양식).hwp'(공단식, [  ] 고르는 칸)  — 표 칸 112개
   B = '이력서 + 자기소개서' 양식(기존 이력서 예시와 같은 모양, 값 칸은 비운 빈 양식) — 표 칸 141개
   칸 번호는 원본 표의 칸 순서(1부터)다. 칸 모양·글꼴·너비는 손대지 않고 글자만 바꾼다.
   고른 항목은 '[  ]'를 '[V]'로 바꿔 표시한다. */
(function(){
  const HP="http://www.hancom.co.kr/hwpml/2011/paragraph";
  const RESUME_OPTS={
    eduStatus:["졸업(예정)","중퇴","재학","수료","검정고시","휴학","독학사"],
    computer:["문서작성","스프레트시트","프리젠테이션","회계프로그램"],
    langLevel:["상","중","하"],
    curStatus:["이직","졸업(예정)","재직","정년퇴직","자영업","가사ㆍ육아","휴학생","기타"],
    disType:["지체장애","뇌병변장애","시각장애","청각장애","언어장애","지적장애","자폐성장애","정신장애","신장장애","심장장애","호흡기장애","간장애","안면장애","장루ㆍ요루장애","뇌전증장애","상이등급"],
    disDeg:["중증","경증"],
    aids:["휠체어","스틱","보조기","보청기","목발","흰지팡이","의수","맹도견","의족"],
    causeType:["질병","사고","선천","기타"],
    lift:["5kg 이내","5~20kg","20kg 이상"],
    stand:["서거나 걷는 일 어려움","일부 서서하는 작업 가능","오랫동안 가능"],
    talk:["듣고 말하는 작업 어려움","간단한 듣고 말하기 가능","듣고 말하기에 어려움 없음"],
    sight:["일상적 활동 가능","비교적 큰 인쇄물을 읽을 수 있음","아주 작은 글씨를 읽을 수 있음"],
    hand:["큰 물품 조립가능","작은 물품 조립가능","정밀한 작업가능"],
    hands:["한손작업 가능","한손보조작업 가능","양손작업 가능"],
    days:["월","화","수","목","금","토","일"]
  };
  // A 양식 작업능력: 고른 순서(0,1,2) → 칸 번호
  const ABILITY_CELLS={lift:[89,90,91],stand:[93,94,95],talk:[97,98,99],sight:[101,102,103],hand:[105,106,107],hands:[109,110,111]};

  async function open(b64){
    const bin=atob(b64), bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const zip=await JSZip.loadAsync(bytes);
    const xml=await zip.file("Contents/section0.xml").async("string");
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    if(doc.getElementsByTagName("parsererror").length) throw new Error("양식 읽기 실패");
    return {zip,doc,tcs:doc.getElementsByTagNameNS(HP,"tc")};
  }
  async function close(o){
    let out=new XMLSerializer().serializeToString(o.doc);
    if(!/^<\?xml/.test(out)) out='<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'+out;
    o.zip.file("Contents/section0.xml",out);
    o.zip.file("mimetype","application/hwp+zip",{compression:"STORE"});
    return o.zip.generateAsync({type:"blob",mimeType:"application/hwp+zip",compression:"DEFLATE"});
  }
  const kids=(n,name)=>[...n.childNodes].filter(c=>c.localName===name);
  const paras=tc=>kids(kids(tc,"subList")[0],"p");
  function setParaText(doc,p,text){
    kids(p,"linesegarray").forEach(n=>p.removeChild(n));
    const runs=kids(p,"run");
    const run=runs[0]||p.appendChild(doc.createElementNS(HP,"hp:run"));
    runs.slice(1).forEach(r=>p.removeChild(r));
    [...run.childNodes].forEach(n=>{if(n.localName==="t")run.removeChild(n);});
    if(text){const t=doc.createElementNS(HP,"hp:t");t.textContent=text;run.appendChild(t);}
  }
  const paraText=p=>[...p.getElementsByTagNameNS(HP,"t")].map(t=>t.textContent).join("");
  // 칸 전체를 새 글자로(여러 줄이면 첫 문단 모양을 복사해 문단을 늘림)
  function setCell(doc,tc,text){
    const sub=kids(tc,"subList")[0], ps=kids(sub,"p"), model=ps[0];
    ps.slice(1).forEach(p=>sub.removeChild(p));
    const lines=String(text==null?"":text).split("\n").map(x=>x.trim()).filter(Boolean);
    setParaText(doc,model,lines[0]||"");
    let prev=model;
    lines.slice(1).forEach(line=>{const p=model.cloneNode(true);setParaText(doc,p,line);sub.insertBefore(p,prev.nextSibling);prev=p;});
  }
  // 칸 안 글자 일부만 바꿈(문단은 그대로)
  function editCell(doc,tc,fn){
    let hit=false;
    paras(tc).forEach(p=>{const a=paraText(p), b=fn(a);if(b!==a){setParaText(doc,p,b);hit=true;}});
    return hit;
  }
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  // '[  ]라벨'을 '[V]라벨'로. extra가 있으면 바로 뒤 '(   )' 빈칸에 글자를 넣음
  function mark(doc,tc,label,extra){
    return editCell(doc,tc,t=>{
      const re=new RegExp("\\[\\s*\\](\\s*)"+esc(label)+(extra!=null?"\\(\\s*\\)":""));
      return t.replace(re,(m,sp)=>"[V]"+sp+label+(extra!=null?"("+extra+")":""));
    });
  }
  const s=v=>String(v==null?"":v).trim();
  const list=(arr,n)=>{const a=(Array.isArray(arr)?arr:[]).slice(0,n);while(a.length<n)a.push({});return a;};

  /* ---------- A: 이력서(양식) ---------- */
  async function buildResumeA(R,today){
    const o=await open(window.RESUME_A_B64), {doc,tcs}=o, c=n=>tcs[n-1];
    if(tcs.length!==112) throw new Error("이력서(양식) 칸 수가 다름");
    const miss=[];
    const mk=(cells,label,extra)=>{if(!label)return;const ok=cells.some(n=>mark(doc,c(n),label,extra));if(!ok)miss.push(label);};
    setCell(doc,c(3),R.name);
    // 5번(주민등록번호)·6번(사진)은 비워 둠
    setCell(doc,c(8),R.addr);
    if(s(R.homeTel)) setCell(doc,c(10),"집전화 "+s(R.homeTel));
    const p11=paras(c(11));
    if(p11.length>=3){setParaText(doc,p11[1],"(보호자/모) "+s(R.guardTel));setParaText(doc,p11[2],"(본인) "+s(R.mobile));}
    const e=list(R.edu,2).filter(x=>s(x.school)).pop()||{};
    setCell(doc,c(19),e.school); setCell(doc,c(20),s(e.major)||"-");
    setCell(doc,c(21),s(e.in)||s(e.out)?(s(e.in)+" ~ "+s(e.out)):"-");
    mk([22,23,24],R.eduStatus);
    setCell(doc,c(31),R.trainOrg); setCell(doc,c(32),R.trainType); setCell(doc,c(33),R.trainPeriod);
    setCell(doc,c(35),list(R.lic,4).filter(x=>s(x.name)).map(x=>s(x.name)+(s(x.date)?" ("+s(x.date)+")":"")).join(", "));
    (R.computer||[]).forEach(k=>mk([37],k));
    if(s(R.computerEtc)) mk([37],"기타",s(R.computerEtc));
    setCell(doc,c(43),R.langName); mk([44],R.langLevel); setCell(doc,c(45),R.langTest); setCell(doc,c(46),R.langScore);
    const cr=list(R.career,3).filter(x=>s(x.place)||s(x.task));
    const col=k=>cr.map(x=>s(x[k])||"-").join("\n");
    if(cr.length){setCell(doc,c(55),col("place"));setCell(doc,c(56),col("job"));setCell(doc,c(57),col("period"));
      setCell(doc,c(58),col("emptype"));setCell(doc,c(59),col("wage"));setCell(doc,c(60),col("task"));setCell(doc,c(61),col("reason"));}
    if(R.curStatus==="기타") mk([63],"기타",s(R.curStatusEtc)); else mk([63],R.curStatus);
    mk([67,68,69,70],R.disType);
    mk([72],R.disDeg);
    setCell(doc,c(74),R.disRegDate);
    if(s(R.mainPart)) setCell(doc,c(76),"주장애부위: "+s(R.mainPart));
    if(s(R.subPart)) setCell(doc,c(77),"부장애부위: "+s(R.subPart));
    (R.aids||[]).forEach(k=>mk([79,80,81,82,83],k));
    if(s(R.aidsEtc)) mk([83],"기타",s(R.aidsEtc));
    if(R.causeType) mk([85],R.causeType,s(R.causeText));
    Object.entries(ABILITY_CELLS).forEach(([k,cells])=>{
      const i=RESUME_OPTS[k].indexOf(R[k]); if(i<0) return;
      if(!editCell(doc,c(cells[i]),t=>t.replace(/\[\s*\]/,"[V]"))) miss.push(R[k]);
    });
    editCell(doc,c(112),t=>t.replace(/(\d{4})년\s+월\s+일/,today.getFullYear()+"년  "+(today.getMonth()+1)+"월  "+today.getDate()+"일"));
    return {blob:await close(o),miss};
  }

  /* ---------- B: 이력서 + 자기소개서 ---------- */
  async function buildResumeB(R){
    const o=await open(window.RESUME_B_B64), {doc,tcs}=o, c=n=>tcs[n-1];
    if(tcs.length!==141) throw new Error("이력서·자기소개서 양식 칸 수가 다름");
    const set=(n,v)=>setCell(doc,c(n),v);
    set(3,R.name); set(5,R.birth); set(7,R.field); set(9,R.addr);
    set(12,s(R.homeTel)||"-"); set(14,R.mobile); set(16,R.email);
    set(19,R.hobby); set(21,R.skill); set(24,R.insurance); set(26,R.benefit);
    list(R.edu,2).forEach((x,i)=>{const b=33+5*i;set(b,x.in);set(b+1,x.out);set(b+2,x.school);set(b+3,x.major);set(b+4,x.note);});
    list(R.lic,2).forEach((x,i)=>{const b=48+4*i;set(b,x.name);set(b+1,x.issuer);set(b+2,x.date);set(b+3,x.note);});
    list(R.career,3).forEach((x,i)=>{const b=61+4*i;set(b,x.period);set(b+1,x.place);set(b+2,x.task);set(b+3,x.reason);});
    set(75,[s(R.disType),s(R.disDeg)].filter(Boolean).join(" / "));
    set(77,R.card); set(79,R.onset); set(81,R.diagnosis); set(83,R.med); set(85,R.medCycle); set(87,R.disDesc);
    set(90,R.org); set(92,R.orgTel); set(94,R.worker); set(96,R.workerTel);
    list(R.family,3).forEach((x,i)=>{const b=103+5*i;set(b,x.rel);set(b+1,x.name);set(b+2,x.age);set(b+3,x.tel);set(b+4,x.live);});
    set(120,"( "+(s(R.hours)||"  ")+" )시간");
    set(122,"최대 ( "+(s(R.evening)||"  ")+" )시까지");
    RESUME_OPTS.days.forEach((d,i)=>set(125+i,d+((R.days||[]).includes(d)?"(O)":"( )")));
    set(133,R.therapy); set(135,R.hospital);
    set(137,R.intro); set(139,R.experience); set(141,R.motivation);
    return {blob:await close(o),miss:[]};
  }

  window.RESUME_OPTS=RESUME_OPTS;
  window.buildResumeA=buildResumeA;
  window.buildResumeB=buildResumeB;
})();
