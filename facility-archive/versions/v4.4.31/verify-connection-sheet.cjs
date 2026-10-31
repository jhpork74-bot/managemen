const fs=require('fs'),vm=require('vm'),assert=require('assert');
function setup(){
 let held=false,active='admin@example.invalid';const props={CSFS_IMAGE_FOLDER_ID:'EXISTING_CSFS_FOLDER',JANDI_ADMIN_EMAIL:active,JANDI_IMAGE_FOLDER_ID:'OLD_FOLDER_123456',facilityCommit:'{"revision":12}',JANDI_TEST_WEBHOOK_URL:'SECRET_WEBHOOK',dutyHolidayApiKey:'SECRET_API'},sheets=new Map([['원본자료',{keep:true}]]);
 class Sheet{
  constructor(){this.cells=[];this.formulas=[]}
  getLastRow(){return this.cells.length}
  getRange(r,c,n=1,m=1){if(r==='A1'){r=1;c=1}if(r==='A2'){r=2;c=1}if(r==='A3'){r=3;c=1}const sh=this;
   const range={setValue(v){sh.cells[r-1]||=[];sh.cells[r-1][c-1]=v;return range},getValue(){return sh.cells[r-1]?.[c-1]??''},setValues(a){for(let i=0;i<n;i++){sh.cells[r-1+i]||=[];for(let j=0;j<m;j++)sh.cells[r-1+i][c-1+j]=a[i][j]}return range},getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sh.cells[r-1+i]?.[c-1+j]??''))},getFormulas(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sh.formulas[r-1+i]?.[c-1+j]??''))}};
   for(const method of ['setNumberFormat','setFontWeight','setBackground','setWrap'])range[method]=()=>range;return range;
  }
  setFrozenRows(){}setColumnWidth(){}setColumnWidths(){}
 }
 const c=vm.createContext({console:{info(){}},Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>'admin@example.invalid'})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,getProperties:()=>({...props}),setProperty:(k,v)=>props[k]=v,setProperties:values=>Object.assign(props,values)})},LockService:{getScriptLock:()=>({waitLock(){assert(!held);held=true},releaseLock(){held=false}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const sh=new Sheet();sheets.set(n,sh);return sh}})},DriveApp:{getFolderById:()=>({isTrashed:()=>false})},CalendarApp:{getCalendarById:()=>({})},Utilities:{formatDate:()=>'2026-10-29 19:00:00'}});
 vm.runInContext(fs.readFileSync(__dirname+'/INI.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/ConnectionSettings.gs','utf8'),c);
 return {c,props,sheets,active:v=>active=v,held:()=>held,Sheet};
}
let x=setup();assert.throws(()=>x.c.previewFacilityConnectionSettings(),/먼저/);assert(x.c.setupFacilityConnectionSettings().created);let sh=x.sheets.get('연결설정');assert.equal(sh.cells[5][2],'OLD_FOLDER_123456');assert(!JSON.stringify(sh.cells).includes('SECRET'));assert(x.sheets.get('원본자료').keep);
sh.cells[5][2]='https://drive.google.com/drive/folders/NEW_FOLDER_123456';assert.deepEqual(Array.from(x.c.previewFacilityConnectionSettings().changes),['JANDI_IMAGE_FOLDER_ID']);assert.equal(x.props.JANDI_IMAGE_FOLDER_ID,'OLD_FOLDER_123456');x.c.applyFacilityConnectionSettings();assert.equal(x.props.JANDI_IMAGE_FOLDER_ID,'NEW_FOLDER_123456');assert.equal(sh.cells[5][3],'NEW_FOLDER_123456');assert.equal(x.props.facilityCommit,'{"revision":12}');assert.equal(x.props.JANDI_TEST_WEBHOOK_URL,'SECRET_WEBHOOK');assert.equal(x.c.applyFacilityConnectionSettings().changed.length,0);
sh.cells[5][2]='NEXT_FOLDER_123456';x.c.setupFacilityConnectionSettings();assert.equal(sh.cells[5][2],'NEXT_FOLDER_123456','setup preserves proposed input');sh.cells[5][2]='';assert.equal(x.c.applyFacilityConnectionSettings().changed.length,0,'empty retains current');
x.props.JANDI_IMAGE_FOLDER_ID='OUTSIDE_FOLDER_123456';assert.throws(()=>x.c.applyFacilityConnectionSettings(),/他|다른 곳/);assert(!x.held());x.c.setupFacilityConnectionSettings();assert.equal(sh.cells[5][3],'OUTSIDE_FOLDER_123456');
for(const kind of ['formula','duplicate','missing','unknown','invalid','sheetchange']){
 const y=setup();y.c.setupFacilityConnectionSettings();const tab=y.sheets.get('연결설정');
 if(kind==='formula'){tab.formulas[5]=[];tab.formulas[5][2]='=SOMEFORMULA()'}
 if(kind==='duplicate')tab.cells[5][1]='SPREADSHEET_ID';if(kind==='missing')tab.cells[5][1]='';if(kind==='unknown')tab.cells[5][1]='JANDI_TEST_WEBHOOK_URL';if(kind==='invalid')tab.cells[5][2]='<html>';if(kind==='sheetchange')tab.cells[4][2]='NEW_SHEET_123456';
 assert.throws(()=>y.c.applyFacilityConnectionSettings(),undefined,kind);assert.equal(y.props.JANDI_IMAGE_FOLDER_ID,'OLD_FOLDER_123456');assert(y.sheets.get('원본자료').keep);assert(!y.held());
}
x.active('other@example.invalid');assert.throws(()=>x.c.setupFacilityConnectionSettings(),/관리자/);assert.throws(()=>x.c.applyFacilityConnectionSettings(),/관리자/);
x=setup();const foreign=new x.Sheet();foreign.cells=[['unrelated sheet']];x.sheets.set('연결설정',foreign);assert.throws(()=>x.c.setupFacilityConnectionSettings(),/같은 이름/);assert.equal(foreign.cells[0][0],'unrelated sheet');
// Upgrade an existing six-row v4.4.17 settings sheet without rewriting pending input.
x=setup();x.c.setupFacilityConnectionSettings();sh=x.sheets.get('연결설정');sh.cells.pop();sh.cells[5][2]='PENDING_COMPANY_FOLDER';x.c.setupFacilityConnectionSettings();assert.equal(sh.cells.length,13);assert.equal(sh.cells[5][2],'PENDING_COMPANY_FOLDER');assert.equal(sh.cells[10][1],'REPAIRS_IMAGE_FOLDER_ID');assert.equal(sh.cells[10][3],'OLD_FOLDER_123456');assert.equal(sh.cells[10][2],'');
x.props.REPAIR_UPLOAD_TEST=JSON.stringify({state:'pending',expiresAt:Date.now()+60000});assert.throws(()=>x.c.applyFacilityConnectionSettings(),/사진 저장 중/);
console.log('PASS sheet settings: create/read/current/pending columns; explicit apply; input retention; secret exclusion; formula/key/duplicate/missing/stale/bad folder checks; original-data isolation; admin-only apply; same-name sheet preservation; six-row upgrade and active-upload folder guard. Mocked Google Sheets.');
