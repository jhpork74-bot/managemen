function doGet() {
 return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('복지관 FIRE MISSION').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function setup() {
 const ss=SpreadsheetApp.getActiveSpreadsheet();
 if(!ss) throw new Error('스프레드시트의 확장 프로그램 > Apps Script에서 실행하세요.');
 const p=PropertiesService.getScriptProperties();p.setProperty('SHEET_ID',ss.getId());
 ['Settings','Records','Sessions'].forEach(n=>{if(!ss.getSheetByName(n))ss.insertSheet(n);});
 ss.getSheetByName('Settings').getRange('A1:B1').setValues([['key','json']]);
 ss.getSheetByName('Records').getRange('A1:F1').setValues([['완료시각','참가자','소요초','결과','세션','미션종류']]);
 ss.getSheetByName('Sessions').getRange('A1:F1').setValues([['id','name','start','limit','done','mode']]);
 console.log('설정 준비 완료');
}
function sheet_(n){const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw new Error('setup을 먼저 실행하세요.');return SpreadsheetApp.openById(id).getSheetByName(n);}
function getConfig(){const v=sheet_('Settings').getRange('B2').getValue();return v?JSON.parse(v):null;}
function saveConfig(config){
 if(!config||!Array.isArray(config.extinguishers)||!Array.isArray(config.aeds||[])||!(config.extinguishers.length+(config.aeds||[]).length)||!Array.isArray(config.stairs)||config.stairs.length!==2||!config.spawn||![60,120,180,300,600].includes(config.limit))throw new Error('설정 오류');
 if((config.aeds||[]).length>200)throw new Error('AED 개수 오류');
 if(config.stairs.some((p,i)=>!p||p.f!==i)||!Array.isArray(config.edits||[])||config.extinguishers.length>200||JSON.stringify(config).length>49000)throw new Error('설정 크기 또는 계단 오류');
 if(!Array.isArray(config.rooms||[])||(config.rooms||[]).length>100||(config.rooms||[]).some(p=>!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>30))throw new Error('방 이름 오류');
 if((config.rooms||[]).some(p=>p.entrance&&(p.entrance.f!==p.f||!Number.isInteger(p.entrance.x)||!Number.isInteger(p.entrance.y)||p.entrance.x<0||p.entrance.y<0||p.entrance.x>250||p.entrance.y>250)))throw new Error('출입구 위치 오류');
 const points=[...config.extinguishers,...config.aeds||[],...config.stairs,config.spawn,...config.rooms||[]];
 if(points.some(p=>![0,1].includes(p.f)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>250||p.y>250))throw new Error('좌표 오류');
 const lock=LockService.getScriptLock();lock.waitLock(10000);try{sheet_('Settings').getRange('A2:B2').setValues([['config',JSON.stringify(config)]]);}finally{lock.releaseLock();}return true;
}
function startSession(name,mode){mode=mode||'fire';if(!['fire','cardiac'].includes(mode))throw new Error('미션 종류 오류');const c=getConfig();if(!c)throw new Error('관리자가 지도를 설정하고 저장해야 합니다.');if(!(mode==='cardiac'?(c.aeds||[]):c.extinguishers).length)throw new Error(mode==='cardiac'?'관리자가 AED 위치를 먼저 저장해야 합니다.':'소화기 위치가 필요합니다.');name=String(name||'참가자').slice(0,30);const id=Utilities.getUuid(),now=Date.now();sheet_('Sessions').appendRow([id,"'"+name,now,c.limit,false,mode]);return {id,start:now,limit:c.limit,mode};}
function finishSession(id,success){
 const lock=LockService.getScriptLock();lock.waitLock(10000);try{
 const sh=sheet_('Sessions'),rows=sh.getDataRange().getValues(),i=rows.findIndex((r,j)=>j>0&&r[0]===id);if(i<1||rows[i][4])throw new Error('이미 완료되었거나 유효하지 않은 세션');
 const r=rows[i],elapsed=Math.round((Date.now()-Number(r[2]))/100)/10,result=success&&elapsed<=Number(r[3])+2?'완료':'시간초과';
 sheet_('Records').appendRow([new Date(),r[1],elapsed,result,id,r[5]==='cardiac'?'심정지':'화재']);sh.getRange(i+1,5).setValue(true);return {elapsed,result};
 }finally{lock.releaseLock();}
}
