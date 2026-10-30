const fs=require('fs'),path=require('path'),vm=require('vm'),read=f=>fs.readFileSync(path.join(__dirname,f),'utf8'),write=(f,s)=>fs.writeFileSync(path.join(__dirname,f),s);
const core=read('csfs-core.js'),ui=core+'\n'+read('csfs-ui.js'),server=core+'\n'+read('csfs-service.js');new vm.Script(ui);new vm.Script(server);
write('CSFSManagement.gs',server);write('CSFSManagementUI.html','<style>\n'+read('csfs.css')+'\n</style>\n<script>\n'+ui+'\n</script>\n');
for(const f of ['Index.html','base-index.html']){let text=read(f).split('<?!= includeCSFSManagementUI_() ?>').join('');text=text.includes('<?!= includePopupBehavior_() ?>')?text.replace('<?!= includePopupBehavior_() ?>','<?!= includeCSFSManagementUI_() ?>\n<?!= includePopupBehavior_() ?>'):text.replace('</body>','<?!= includeCSFSManagementUI_() ?>\n</body>');write(f,text)}
console.log('Built separate CSFS screen/model/service; fixed include before common popup behavior.');
