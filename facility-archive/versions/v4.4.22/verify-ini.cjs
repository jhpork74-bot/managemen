const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/INI.gs','utf8');
assert.equal(source,fs.readFileSync(__dirname+'/INI.CS','utf8'));
function setup(settings={}){
 let active='admin@example.invalid',held=false,folderDenied=false,folderTrashed=false;
 const props={JANDI_ADMIN_EMAIL:active,facilityCommit:'{"revision":12}',JANDI_IMAGE_FOLDER_ID:'OLD_FOLDER_123456',JANDI_TEST_WEBHOOK_URL:'secret-must-stay',unrelated:'preserve'};
 const api={getProperty:k=>props[k]??null,getProperties:()=>({...props}),setProperty:(k,v)=>props[k]=v,setProperties:(values,del)=>{assert.equal(del,false);Object.assign(props,values)}};
 const context=vm.createContext({console:{info(){}},PropertiesService:{getScriptProperties:()=>api},Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>'admin@example.invalid'})},LockService:{getScriptLock:()=>({waitLock(){assert(!held);held=true},releaseLock(){held=false}})},DriveApp:{getFolderById:id=>{if(folderDenied)throw Error('denied');return {isTrashed:()=>folderTrashed}}},CalendarApp:{getCalendarById:()=>({})},SpreadsheetApp:{openById:()=>({getId:()=>'id'})}});
 const customized=source.replace(/const INI_SETTINGS = Object.freeze\(\{[\s\S]*?\}\);/,'const INI_SETTINGS = Object.freeze('+JSON.stringify(settings)+');');vm.runInContext(customized,context);
 return {context,props,active:v=>active=v,deny:()=>folderDenied=true,trash:()=>folderTrashed=true,held:()=>held};
}
let x=setup();const original=JSON.stringify(x.props);assert.equal(x.context.previewIniSettings().changes.length,0);assert.equal(x.context.applyIniSettings().changed.length,0);assert.equal(JSON.stringify(x.props),original);assert(x.context.facilitySpreadsheetId_());
x=setup({JANDI_IMAGE_FOLDER_ID:'https://drive.google.com/drive/folders/NEW_FOLDER_123456?usp=sharing'});assert.deepEqual(Array.from(x.context.previewIniSettings().changes),['JANDI_IMAGE_FOLDER_ID']);x.context.applyIniSettings();assert.equal(x.props.JANDI_IMAGE_FOLDER_ID,'NEW_FOLDER_123456');assert.equal(x.props.JANDI_TEST_WEBHOOK_URL,'secret-must-stay');assert.equal(x.props.facilityCommit,'{"revision":12}');assert.equal(x.props.unrelated,'preserve');assert.equal(JSON.parse(x.props.INI_PREVIOUS_SETTINGS).previous.JANDI_IMAGE_FOLDER_ID,'OLD_FOLDER_123456');assert.equal(x.context.applyIniSettings().changed.length,0);
for(const mode of ['deny','trash']){x=setup({JANDI_IMAGE_FOLDER_ID:'NEW_FOLDER_123456'});x[mode]();assert.throws(()=>x.context.applyIniSettings());assert.equal(x.props.JANDI_IMAGE_FOLDER_ID,'OLD_FOLDER_123456');assert(!x.held())}
x=setup({SPREADSHEET_ID:'NEW_SHEET_123456'});assert.throws(()=>x.context.applyIniSettings(),/별도 작업/);assert.equal(x.props.SPREADSHEET_ID,undefined);
x=setup({facilityReminderCalendarId:'new@group.calendar.google.com'});x.props.facilityReminderCalendarId='old@group.calendar.google.com';assert.throws(()=>x.context.applyIniSettings(),/이관/);
x=setup({JANDI_IMAGE_FOLDER_ID:'NEW_FOLDER_123456'});x.props.JANDI_RCPT_EXAMPLE=JSON.stringify({state:'pending',at:Date.now()});assert.throws(()=>x.context.applyIniSettings(),/전송 중/);assert.equal(x.props.JANDI_IMAGE_FOLDER_ID,'OLD_FOLDER_123456');
x=setup({JANDI_IMAGE_FOLDER_ID:'NEW_FOLDER_123456'});x.props.facilityCalendarLease=JSON.stringify({expiresAt:Date.now()+60000});assert.throws(()=>x.context.applyIniSettings(),/작업 중/);
x=setup({JANDI_IMAGE_FOLDER_ID:'bad < html'});assert.throws(()=>x.context.applyIniSettings(),/확인/);assert(!x.held());
x=setup();x.active('');assert.throws(()=>x.context.applyIniSettings(),/관리자/);assert.throws(()=>x.context.showIniSettingsStatus(),/관리자/);
x=setup();x.active('someone@example.invalid');assert.throws(()=>x.context.applyIniSettings(),/관리자/);
for(const file of ['Code.gs','FacilityStorage.gs','CalendarReminders.gs'])assert(!fs.readFileSync(__dirname+'/'+file,'utf8').includes('openById(SPREADSHEET_ID)'));
x=setup();x.props.dutyNotificationCalendarId='configured@group.calendar.google.com';let chosen='';
x.context.CalendarApp={getCalendarById:id=>{chosen=id;return {getId:()=>id}},getDefaultCalendar:()=>{throw Error('must preserve configured calendar')}};
x.context.ScriptApp={getProjectTriggers:()=>[{getHandlerFunction:()=>'generateCurrentDutyMonths'}]};
vm.runInContext(fs.readFileSync(__dirname+'/DutyManagement.gs','utf8'),x.context);x.context.installDutyMonthAutomation();assert.equal(chosen,'configured@group.calendar.google.com');assert.equal(x.props.dutyNotificationCalendarId,chosen);
console.log('INI PASS: empty preserves legacy; URL normalization; folder validation; pending/lease protection; original data and secrets retained; one-step previous values; spreadsheet/calendar migration guard; unauthorized calls blocked.');
