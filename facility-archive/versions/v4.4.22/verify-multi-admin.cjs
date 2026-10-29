const fs=require('fs'),vm=require('vm'),assert=require('assert');
let active='personal@example.invalid',effective=active,props={JANDI_ADMIN_EMAIL:active},posts=0;const logs=[];
const api={getProperty:k=>props[k]??null,getProperties:()=>({...props}),setProperty:(k,v)=>props[k]=v,setProperties:v=>Object.assign(props,v)};
const c=vm.createContext({console:{info:s=>logs.push(s)},PropertiesService:{getScriptProperties:()=>api},Session:{getActiveUser:()=>({getEmail:()=>active}),getEffectiveUser:()=>({getEmail:()=>effective})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},DriveApp:{getFolderById:()=>({isTrashed:()=>false})},UrlFetchApp:{fetch(){posts++;throw Error('diagnosis must not post')}}});
vm.runInContext(fs.readFileSync(__dirname+'/INI.gs','utf8')+'\n'+fs.readFileSync(__dirname+'/JandiNotifications.gs','utf8'),c);
assert.deepEqual(Array.from(c.facilityAdminEmails_()),[active]);c.iniAssertEditor_();c.jandiAssertAdmin_();
assert.equal(c.iniNormalize_('JANDI_ADMIN_EMAIL',' PERSONAL@example.invalid ; company@example.invalid\nPersonal@example.invalid '),'personal@example.invalid, company@example.invalid');
props.JANDI_ADMIN_EMAIL='personal@example.invalid, company@example.invalid';
for(const email of ['personal@example.invalid','company@example.invalid']){active=email;effective=email;c.iniAssertEditor_();c.jandiAssertAdmin_();assert(c.checkFacilityAdminAccounts().settingsExecutionAllowed);assert(c.checkFacilityAdminAccounts().currentAccountAllowed)}
active='outsider@example.invalid';effective=active;assert.throws(()=>c.iniAssertEditor_(),/허용 목록/);assert.throws(()=>c.jandiAssertAdmin_(),/관리자/);
active='';effective='company@example.invalid';assert.throws(()=>c.iniAssertEditor_(),/로그인/);assert.throws(()=>c.jandiAssertAdmin_(),/관리자/);assert.equal(c.checkFacilityAdminAccounts().settingsExecutionAllowed,false,'effective owner must not authenticate anonymous caller');
active='personal@example.invalid';effective='company@example.invalid';assert.throws(()=>c.iniAssertEditor_(),/실행 계정/);
effective=active;assert.throws(()=>c.iniApplyUnderLock_({JANDI_ADMIN_EMAIL:'company@example.invalid'}),/본인/);assert.equal(props.JANDI_ADMIN_EMAIL,'personal@example.invalid, company@example.invalid');
assert.throws(()=>c.iniNormalize_('JANDI_ADMIN_EMAIL','personal@example.invalid company@example.invalid'),/쉼표/);assert.throws(()=>c.iniNormalize_('JANDI_ADMIN_EMAIL','not-an-email'),/쉼표/);
const oldPhotoFolder=props.REPAIRS_IMAGE_FOLDER_ID='COMPANY_FOLDER_PLACEHOLDER';assert(c.iniApplyUnderLock_({JANDI_ADMIN_EMAIL:'personal@example.invalid, company@example.invalid'}).ok);assert.equal(props.REPAIRS_IMAGE_FOLDER_ID,oldPhotoFolder);
c.getDutyJandiStatus=()=>({enabled:true,imageReady:true,mode:'test',testConfigured:true,testPassed:true});props.JANDI_IMAGE_FOLDER_ID='COMPANY_FOLDER_PLACEHOLDER';const diagnosis=c.diagnoseJandiConnection();assert(diagnosis.folderAccessible);assert.equal(diagnosis.folderWriteAndPublicSharing,'not_tested');assert.equal(posts,0);assert(!logs.join('\n').includes('personal@example.invalid'));assert(!logs.join('\n').includes('company@example.invalid'));
props.JANDI_ADMIN_EMAIL='personal@example.invalid';active=effective='personal@example.invalid';c.iniAssertEditor_();c.jandiAssertAdmin_();
console.log('PASS multi-admin: legacy single account, normalized two-account list, personal/company editor checks, unrelated/anonymous and mismatched execution rejected, self-lockout prevention, existing folder/settings retained, read-only diagnosis with no email or webhook disclosure and zero posts.');
