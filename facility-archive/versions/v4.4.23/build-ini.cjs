const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'INI.CS'),'utf8');
new vm.Script(source);fs.writeFileSync(path.join(__dirname,'INI.gs'),source);
console.log('INI.CS → INI.gs: same settings source; install INI.gs only.');
