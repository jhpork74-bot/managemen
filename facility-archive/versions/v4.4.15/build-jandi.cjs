const fs=require('fs'),vm=require('vm'),p=__dirname,read=f=>fs.readFileSync(p+'/'+f,'utf8'),code=read('jandi-calendar-canvas.js')+'\n'+read('jandi-notifications-ui.js');new vm.Script(code);new vm.Script(read('JandiNotifications.gs'));
fs.writeFileSync(p+'/JandiNotificationsUI.html','<style>.jandi-duty-panel p{font-size:14px;line-height:1.6;overflow-wrap:anywhere}.jandi-duty-panel button{min-height:44px}</style>\n<script>\n'+code+'\n</script>');
for(const f of ['Index.html','base-index.html']){let index=read(f).split('<?!= includeJandiNotificationsUI_() ?>').join('');index=index.replace('</body>','<?!= includeJandiNotificationsUI_() ?>\n</body>');fs.writeFileSync(p+'/'+f,index)}
console.log('Built separate JANDI UI and retained the fixed template include.');
