const fs=require('fs'),vm=require('vm');
const extra=`
const baseReceiptKey=context.jandiReceiptKey_(context.jandiRoute_(context.jandiConfig_(),'topic'),'one',topic),originalReceipt=props[baseReceiptKey],originalData=JSON.stringify(snapshot.data);
const extraPacket=id=>{const prepared=context.prepareDutyJandiImage('one',topic,'topic',id);assert.equal(prepared.state,'ready');return {manual:true,resendId:id,rosterHash:prepared.rosterHash,dataUrl:'data:image/jpeg;base64,'+Buffer.from([255,216,1,2,255,217]).toString('base64')}};
const beforeResendPosts=posts.length,beforeResendFiles=files.length;
let rp=extraPacket('resend-click1');assert.equal(context.notifyDutyChangeJandi('one',topic,'topic',rp).state,'sent');assert.equal(posts.length,beforeResendPosts+1);assert.equal(files.length,beforeResendFiles+1);assert.equal(props[baseReceiptKey],originalReceipt);assert.equal(JSON.stringify(snapshot.data),originalData);
assert.equal(context.prepareDutyJandiImage('one',topic,'topic','resend-click1').state,'sent');assert.equal(context.notifyDutyChangeJandi('one',topic,'topic',rp).state,'sent');assert.equal(posts.length,beforeResendPosts+1,'same resend request must dedup');
assert.equal(context.prepareDutyJandiImage('one',topic,'topic').state,'sent');assert.equal(context.prepareDutyJandiImage('one',ambiguous,'topic','resend-no-original-success').state,'blocked');
rp=extraPacket('resend-click2');httpCode='throw';assert.equal(context.notifyDutyChangeJandi('one',topic,'topic',rp).state,'unknown');const unknownPostCount=posts.length;httpCode=200;
assert.equal(context.prepareDutyJandiImage('one',topic,'topic','resend-click2').state,'unknown');assert.equal(context.prepareDutyJandiImage('one',topic,'topic','resend-click3').state,'blocked');assert.equal(context.notifyDutyChangeJandi('one',topic,'topic',rp).state,'unknown');assert.equal(posts.length,unknownPostCount);
assert.equal(context.prepareDutyJandiImage('one',topic,'topic','invalid token').state,'blocked');assert(!locked);
const transportRoute={url:'https://wh.jandi.com/connect-api/webhook/TEST/PLACEHOLDER',mode:'test'};
for(const [body,state] of [['{"code":40000,"message":"not echoed secret"}','failed'],['{"code":42900}','failed'],['{"code":50000}','unknown'],['<html>login</html>','unknown'],['','sent']]){context.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>body});const response=context.jandiTransport_(transportRoute,'test');assert.equal(response.state,state);assert(!response.message.includes('not echoed secret'))}
console.log('PASS confirmed resend: preserves original receipt/data; one new image/post per explicit nonce; duplicate/lost ACK result checks do not repost; unknown resend blocks new nonce; invalid token blocked; HTTP 200 application errors are not success.');
`;
vm.runInNewContext(fs.readFileSync(__dirname+'/verify-jandi.cjs','utf8')+'\n'+extra,{require,console,__dirname,Buffer,process},{filename:'jandi-resend-test'});
