/* ---------- 한글(HWPX) 저장 ---------- */
function buildHwpx(JSZip, d, methodParts){
  const X=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const NS='xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
  const HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';
  const FONT="맑은 고딕";
  const LANGS=["HANGUL","LATIN","HANJA","JAPANESE","OTHER","SYMBOL","USER"];
  const fontfaces='<hh:fontfaces itemCnt="7">'+LANGS.map(l=>'<hh:fontface lang="'+l+'" fontCnt="1"><hh:font id="0" face="'+FONT+'" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font></hh:fontface>').join("")+'</hh:fontfaces>';
  const side=(t,w)=>['left','right','top','bottom'].map(s=>'<hh:'+s+'Border type="'+t+'" width="'+w+'" color="#000000"/>').join("");
  const bf=(id,t,fill)=>'<hh:borderFill id="'+id+'" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'+side(t,"0.12 mm")+'<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>'+(fill?'<hc:fillBrush><hc:winBrush faceColor="'+fill+'" hatchColor="#999999" alpha="0"/></hc:fillBrush>':'')+'</hh:borderFill>';
  const seven=(tag,v)=>'<hh:'+tag+' hangul="'+v+'" latin="'+v+'" hanja="'+v+'" japanese="'+v+'" other="'+v+'" symbol="'+v+'" user="'+v+'"/>';
  // 글자 모양: 0 보통 10pt, 1 굵게 10pt, 2 제목 16pt 굵게, 3 굵게+밑줄 10pt, 4 보통 9pt
  const cp=(id,h,bold,ul)=>'<hh:charPr id="'+id+'" height="'+h+'" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">'+seven("fontRef",0)+seven("ratio",100)+seven("spacing",0)+seven("relSz",100)+seven("offset",0)+(bold?'<hh:bold/>':'')+'<hh:underline type="'+(ul?'BOTTOM':'NONE')+'" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>';
  // 문단 모양: 0 양쪽, 1 가운데, 2 내어쓰기(- 로 시작하는 줄), 3 오른쪽
  const pp=(id,align,left,indent)=>'<hh:paraPr id="'+id+'" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="'+align+'" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hh:margin><hc:intent value="'+indent+'" unit="HWPUNIT"/><hc:left value="'+left+'" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="150" unit="HWPUNIT"/><hh:border borderFillIDRef="1" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>';
  const header=HEAD+'<hh:head '+NS+' version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>'+
    fontfaces+
    '<hh:borderFills itemCnt="3">'+bf(1,"NONE")+bf(2,"SOLID")+bf(3,"SOLID","#EEF1F4")+'</hh:borderFills>'+
    '<hh:charProperties itemCnt="5">'+cp(0,1000)+cp(1,1000,1)+cp(2,1600,1)+cp(3,1000,1,1)+cp(4,900,1)+'</hh:charProperties>'+
    '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'+
    '<hh:paraProperties itemCnt="4">'+pp(0,"JUSTIFY",0,0)+pp(1,"CENTER",0,0)+pp(2,"JUSTIFY",1000,-1000)+pp(3,"RIGHT",0,0)+'</hh:paraProperties>'+
    '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'+
    '</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>';

  let pid=1, tid=1;
  const run=(t,c)=>'<hp:run charPrIDRef="'+(c||0)+'"><hp:t>'+X(t)+'</hp:t></hp:run>';
  const para=(runs,p)=>'<hp:p id="'+(pid++)+'" paraPrIDRef="'+(p||0)+'" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'+(runs||'<hp:run charPrIDRef="0"/>')+'</hp:p>';
  const txt=(t,o={})=>para(run(t,o.c),o.p!=null?o.p:(o.center?1:(/^\s*-/.test(t||"")?2:0)));
  const lines=s=>String(s||"").split("\n").map(x=>x.trim()).filter(Boolean);
  const M={l:510,r:510,t:141,b:141};
  const cell=(col,row,w,h,body,o={})=>'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="'+(o.head?3:2)+'"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="'+(o.top?'TOP':'CENTER')+'" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'+body+'</hp:subList><hp:cellAddr colAddr="'+col+'" rowAddr="'+row+'"/><hp:cellSpan colSpan="'+(o.span||1)+'" rowSpan="1"/><hp:cellSz width="'+w+'" height="'+h+'"/><hp:cellMargin left="'+M.l+'" right="'+M.r+'" top="'+M.t+'" bottom="'+M.b+'"/></hp:tc>';
  const table=(rows,colCnt,width,height)=>'<hp:tbl id="'+(tid++)+'" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="'+rows.length+'" colCnt="'+colCnt+'" cellSpacing="0" borderFillIDRef="2" noAdjust="0"><hp:sz width="'+width+'" widthRelTo="ABSOLUTE" height="'+height+'" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="'+M.l+'" right="'+M.r+'" top="'+M.t+'" bottom="'+M.b+'"/>'+rows.map(r=>'<hp:tr>'+r+'</hp:tr>').join("")+'</hp:tbl>';
  const tblPara=(tbl,p)=>'<hp:p id="'+(pid++)+'" paraPrIDRef="'+(p||0)+'" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">'+tbl+'<hp:t/></hp:run></hp:p>';

  // A4 210×297mm, 좌우 여백 20mm → 본문 폭 48190
  const WH=7710, WV=16385, WS=WV*2+WH, W=WH*2+WV*2, RH=1900;
  const H=(t,col,row)=>cell(col,row,WH,RH,lines(t).map(s=>txt(s,{center:true,c:/supervision|장애인과의/.test(s)?4:1})).join(""),{head:true});
  const V=(t,col,row)=>cell(col,row,WV,RH,txt(t,{center:true}));
  const S=(body,row,h,o={})=>cell(1,row,WS,h,body,Object.assign({span:3},o));
  const content=["[상담 개요]","- 상담 일자 : "+d.odate,"인적 사항 및 건강 상태","- 거주지 : "+d.address,"- 장애 유형 : "+d.disability,"- 건강 상태 : "+d.health,"- 보유 자격증 : "+d.license,
    "구직 희망 조건 (취업알선 기준)","- 희망 직무 : "+d.job,"- 희망 근무시간 : "+d.hours,"- 희망 급여 : "+d.pay,"- 계약 기간 : "+d.contract,"- 출퇴근 조건 : "+d.commute,
    "기타 특이사항",...lines(d.etc)];
  // 상담방법: 세 개씩 두 줄, 선택한 항목은 굵게+밑줄
  const mLines=[[],[]];
  methodParts.forEach((p,i)=>{const L=mLines[i<3?0:1]; L.push(run(p.t,p.on?3:0)); if(p.gap) L.push(run(p.gap,0));});
  const methodBody=mLines.map(r=>para(r.join(""),1)).join("");
  const resultL=lines(d.result), supL=lines(d.supervision);
  const rows=[
    H("성    명",0,0)+V(d.name,1,0)+H("생년월일",2,0)+V(d.birth,3,0),
    H("상담자",0,1)+V(d.counselor,1,1)+H("상담일자",2,1)+V(d.date,3,1),
    H("상담장소",0,2)+V(d.place,1,2)+H("내담자/\n장애인과의\n관계",2,2)+V(d.relation,3,2),
    H("상담목적",0,3)+S(txt(d.purpose,{center:true}),3,RH),
    H("상담방법",0,4)+S(methodBody,4,RH*2),
    H("상담\n내용",0,5)+S(content.map(s=>txt(s)).join(""),5,RH,{top:true}),
    H("상담결과\n및\n지원계획",0,6)+S((resultL.length?resultL:[""]).map(s=>txt(s)).join(""),6,Math.max(RH*3,RH*resultL.length),{top:true}),
    H("수퍼비전\n(supervision)",0,7)+S((supL.length?supL:[""]).map(s=>txt(s,{center:true})).join(""),7,5000)
  ];
  // 결재란(담당·팀장)
  const SW=5100;
  const sign=table([
    cell(0,0,SW,1400,txt("담 당",{center:true}),{head:true})+cell(1,0,SW,1400,txt("팀 장",{center:true}),{head:true}),
    cell(0,1,SW,3600,txt("",{center:true}))+cell(1,1,SW,3600,txt("",{center:true}))
  ],2,SW*2,5000);
  const main=table(rows,4,W,20000);

  const secPr='<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY"><hp:margin header="1417" footer="1417" gutter="0" left="5669" right="5669" top="2834" bottom="2834"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr>';
  const first='<hp:p id="0" paraPrIDRef="3" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">'+secPr+'<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run><hp:run charPrIDRef="0">'+sign+'<hp:t/></hp:run></hp:p>';
  const section=HEAD+'<hs:sec '+NS+'>'+first+
    para(run("직 업 상 담 기 록 지",2),1)+
    tblPara(main,0)+'</hs:sec>';

  const zip=new JSZip();
  zip.file("mimetype","application/hwp+zip",{compression:"STORE"});
  zip.file("version.xml",HEAD+'<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="11, 0, 0, 0 WIN32LEWindows_10"/>');
  zip.file("META-INF/container.xml",HEAD+'<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></ocf:rootfiles></ocf:container>');
  zip.file("META-INF/manifest.xml",HEAD+'<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>');
  zip.file("Contents/content.hpf",HEAD+'<opf:package '+NS+' version="" unique-identifier="" id=""><opf:metadata><opf:title>직업상담기록지</opf:title><opf:language>ko</opf:language></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>');
  zip.file("Contents/header.xml",header);
  zip.file("Contents/section0.xml",section);
  zip.file("settings.xml",HEAD+'<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>');
  return zip.generateAsync({type:"blob",mimeType:"application/hwp+zip",compression:"DEFLATE"});
}
