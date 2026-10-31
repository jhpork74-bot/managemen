var AssetLabelCore=(()=>{
 'use strict';
 const fields=['acquiredDate','surveyDate','department','manager','location','quantity'];
 const defaults={institution:'예시복지관',year:new Date().getFullYear(),preset:'custom',paper:'a4',width:90,height:40,columns:2,rows:6,gapX:3,gapY:4,marginX:10,marginY:10,offsetX:0,offsetY:0,fontPt:9,start:1,copies:1,show:{acquiredDate:true,surveyDate:true,department:true,manager:true,location:true,quantity:true}};
 // Label dimensions/counts: official Formtec catalog. Gaps/margins below are
 // centered starting values, not a manufacturer-certified cutting template.
 const presets=Object.freeze([
  {id:'formtec-3105',code:'3105',width:63.5,height:38.1,columns:3,rows:7},
  {id:'formtec-3106',code:'3106',width:64,height:34,columns:3,rows:8},
  {id:'formtec-3107',code:'3107',width:99.1,height:33.9,columns:2,rows:8},
  {id:'formtec-3108',code:'3108',width:99.1,height:38.1,columns:2,rows:7},
  {id:'formtec-3112',code:'3112',width:63.5,height:70,columns:3,rows:4},
  {id:'formtec-3114',code:'3114',width:99.1,height:67.7,columns:2,rows:4},
  {id:'formtec-3116',code:'3116',width:99.1,height:93.1,columns:2,rows:3}
 ].map(Object.freeze));
 const clone=v=>JSON.parse(JSON.stringify(v));
 function number(value,name,min,max,integer=false){if(typeof value==='string'&&!value.trim())throw Error(name+'을 입력하세요.');const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw Error(name+'을 확인하세요 ('+min+'~'+max+').');return n}
 function normalize(input={},printing=false){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('라벨 설정 형식을 확인하세요.');
  const s={...clone(defaults),...input,show:{...defaults.show,...input.show}};
  if(typeof s.institution!=='string'||s.institution.length>80)throw Error('기관명은 80자 이내로 입력하세요.');s.institution=s.institution.trim();if(printing&&!s.institution)throw Error('스티커에 들어갈 기관명을 입력하세요.');
  s.year=number(s.year,'재물조사 연도',1990,2200,true);if(!['a4','single'].includes(s.paper))throw Error('용지 종류를 선택하세요.');
  s.width=number(s.width,'라벨 너비',35,190);s.height=number(s.height,'라벨 높이',25,270);s.fontPt=number(s.fontPt,'글자 크기',7,14);
  s.columns=number(s.columns,'가로 칸 수',1,5,true);s.rows=number(s.rows,'세로 칸 수',1,10,true);s.gapX=number(s.gapX,'가로 간격',0,20);s.gapY=number(s.gapY,'세로 간격',0,20);s.marginX=number(s.marginX,'좌우 여백',0,40);s.marginY=number(s.marginY,'상하 여백',0,40);
  s.offsetX=number(s.offsetX,'가로 위치 보정',-10,10);s.offsetY=number(s.offsetY,'세로 위치 보정',-10,10);
  const preset=presets.find(p=>p.id===s.preset);if(s.preset!=='custom'&&!preset)throw Error('폼텍 제품을 다시 선택하거나 직접 설정을 사용하세요.');
  if(preset&&['width','height','columns','rows'].some(k=>Number(s[k])!==preset[k]))s.preset='custom';
  if(s.paper==='single'){s.columns=1;s.rows=1;s.marginX=0;s.marginY=0;s.gapX=0;s.gapY=0;s.offsetX=0;s.offsetY=0;s.preset='custom'}
  const usedWidth=s.width*s.columns+s.gapX*(s.columns-1)+2*s.marginX,usedHeight=s.height*s.rows+s.gapY*(s.rows-1)+2*s.marginY;
  if(s.paper==='a4'&&(usedWidth>210.01||usedHeight>297.01))throw Error('라벨 크기·칸 수·간격·여백의 합이 A4 용지를 초과합니다. 규격을 줄여 주세요.');
  if(s.paper==='a4'&&(s.marginX+s.offsetX<-.01||usedWidth-s.marginX+s.offsetX>210.01||s.marginY+s.offsetY<-.01||usedHeight-s.marginY+s.offsetY>297.01))throw Error('위치 보정으로 라벨이 용지 밖으로 나갑니다. 보정값을 줄여 주세요.');
  s.start=number(s.start,'첫 출력 칸',1,s.columns*s.rows,true);s.copies=number(s.copies,'물품별 출력 매수',1,20,true);
  for(const key of fields)if(typeof s.show[key]!=='boolean')throw Error('표시 항목을 확인하세요.');
  return s;
 }
 function saved(input){const s=normalize(input);return {...s,start:1,copies:1}}
 function applyPreset(input,id){const p=presets.find(p=>p.id===id);if(!p)throw Error('등록된 폼텍 제품번호를 선택하세요.');const gapX=2.5,gapY=0;return normalize({...input,preset:p.id,paper:'a4',width:p.width,height:p.height,columns:p.columns,rows:p.rows,gapX,gapY,marginX:Number(((210-p.columns*p.width-gapX*(p.columns-1))/2).toFixed(3)),marginY:Number(((297-p.rows*p.height)/2).toFixed(3)),offsetX:0,offsetY:0,fontPt:p.height<35?8:9,start:1})}
 function plan(items,input){
  const s=normalize(input,true);if(!Array.isArray(items)||!items.length)throw Error('출력할 물품을 선택하세요.');if(items.length*s.copies>500)throw Error('한 번에 500장 이하로 출력하세요.');
  if(new Set(items.map(x=>x&&x.id)).size!==items.length)throw Error('출력 물품이 중복되었습니다.');
  const capacity=s.columns*s.rows,slots=Array(s.start-1).fill(null);for(const item of items){if(!item||!item.id||typeof item.name!=='string'||typeof item.assetNo!=='string')throw Error('물품 정보를 확인하세요.');for(let i=0;i<s.copies;i++)slots.push(clone(item))}
  const pages=[];for(let i=0;i<slots.length;i+=capacity){const page=slots.slice(i,i+capacity);while(page.length<capacity)page.push(null);pages.push(page)}
  return {settings:s,pages,labels:items.length*s.copies,pageWidth:s.paper==='a4'?210:s.width,pageHeight:s.paper==='a4'?297:s.height};
 }
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function label(item,s){
  if(!item)return '<div class="asset-sticker-slot" aria-hidden="true"></div>';
  const cell=(key,value)=>'<div class="asset-sticker-field"><b>'+key+'</b><span>'+escape(value||'미입력')+'</span></div>';
  let html='<article class="asset-sticker-slot asset-sticker" aria-label="'+escape(item.assetNo)+' 재물조사표"><h3>'+s.year+'년 재물조사표</h3><div class="asset-sticker-institution">'+escape(s.institution||'기관명 입력')+'</div>'+cell('관리번호',item.assetNo)+cell('물품명',item.name);
  if(s.show.acquiredDate||s.show.surveyDate)html+='<div class="asset-sticker-pair">'+(s.show.acquiredDate?cell('취득일',item.acquiredDate):'')+(s.show.surveyDate?cell('조사일',item.lastSurveyDate||'미조사'):'')+'</div>';
  if(s.show.department||s.show.quantity)html+='<div class="asset-sticker-pair">'+(s.show.department?cell('부서',item.department):'')+(s.show.quantity?cell('수량',String(item.quantity)+'개'):'')+'</div>';
  if(s.show.location||s.show.manager)html+='<div class="asset-sticker-pair">'+(s.show.location?cell('장소',item.locationName):'')+(s.show.manager?cell('담당자',item.manager):'')+'</div>';return html+'</article>';
 }
 function html(plan){const s=plan.settings;return plan.pages.map((page,i)=>'<section class="asset-sticker-page" aria-label="라벨 '+(i+1)+'페이지" style="width:'+plan.pageWidth+'mm;height:'+plan.pageHeight+'mm;padding:'+s.marginY+'mm '+s.marginX+'mm;--sticker-width:'+s.width+'mm;--sticker-height:'+s.height+'mm;--sticker-font:'+s.fontPt+'pt"><div class="asset-sticker-grid" style="grid-template-columns:repeat('+s.columns+','+s.width+'mm);grid-template-rows:repeat('+s.rows+','+s.height+'mm);column-gap:'+s.gapX+'mm;row-gap:'+s.gapY+'mm;transform:translate('+s.offsetX+'mm,'+s.offsetY+'mm)">'+page.map(item=>label(item,s)).join('')+'</div></section>').join('')}
 function fingerprint(items){return JSON.stringify(items.map(x=>({id:x.id,assetNo:x.assetNo,name:x.name,quantity:x.quantity,acquiredDate:x.acquiredDate,department:x.department,manager:x.manager||'',locationName:x.locationName,lastSurveyDate:x.lastSurveyDate})))}
 function confirmItems(selected,canonical){if(!Array.isArray(canonical))throw Error('서버 물품 자료를 확인하세요.');const current=selected.map(item=>canonical.find(x=>x&&x.id===item.id));if(current.some(x=>!x)||fingerprint(current)!==fingerprint(selected))throw Error('선택한 물품이 서버에서 변경되었습니다. 최신 목록을 불러온 뒤 다시 선택하세요.');return clone(current)}
 return {defaults,presets,applyPreset,normalize,saved,plan,html,fingerprint,confirmItems};
})();
