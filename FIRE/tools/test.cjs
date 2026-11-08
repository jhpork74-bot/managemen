const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../preview.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);scripts.forEach(s=>new vm.Script(s));
const noop=()=>{},els=new Map();function element(){return {value:'180',textContent:'',setAttribute:noop,after:noop,before:noop,append:noop,replaceChildren:noop,dataset:{},style:{},scrollIntoView:noop,classList:{toggle:noop,add:noop,remove:noop},addEventListener:noop,getBoundingClientRect:()=>({width:1000,height:600,left:0,top:0}),getContext:()=>({setTransform:noop}),files:[]};}
const memory=new Map();const env={console,document:{body:element(),createElement:element,getElementById:id=>{if(!els.has(id))els.set(id,element());return els.get(id);},querySelectorAll:()=>[],activeElement:{tagName:'BODY'}},window:{addEventListener:noop,devicePixelRatio:1},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},requestAnimationFrame:noop,performance:{now:()=>0},setTimeout:noop,Blob,URL};vm.createContext(env);vm.runInContext(scripts.join('\n'),env);
vm.runInContext(`
MAPS.forEach((m,i)=>{if(!m.grid.flat().some(v=>v===1)||m.w<100)throw Error('Missing real map');});
applyConfig(DEFAULT_CONFIG);validate();console.log("PASS: actual SKP default spawn, extinguishers and stairs connected"); // Controlled layout exercises collision, pathfinding, both floors and stair transitions.
const horizontal=wallCells({f:0,x:8,y:4},{f:0,x:3,y:9},'h');if(horizontal.length!==6||horizontal.some(p=>p.y!==4)||horizontal[5].x!==3)throw Error('Horizontal wall snapping failed');
const vertical=wallCells({f:0,x:8,y:9},{f:0,x:3,y:4},'v');if(vertical.length!==6||vertical.some(p=>p.x!==8)||vertical[5].y!==4)throw Error('Vertical wall snapping failed');
if(wallCells({f:0,x:1,y:1},{f:1,x:1,y:1},'h').length)throw Error('Cross floor wall accepted');
MAPS.forEach(m=>{m.w=8;m.h=8;m.grid=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x===0||y===0||x===7||y===7?1:0));});
cfg={spawn:{f:0,x:1,y:1},stairs:[{f:0,x:5,y:5},{f:1,x:5,y:5}],extinguishers:[{f:1,x:2,y:2}],limit:180,edits:[]};
validate();if(!search(cfg.spawn,cfg.extinguishers).some(p=>p.f===1))throw Error('No inter-floor route');
targetExtinguisher=cfg.extinguishers[0];player={f:0,x:1,y:1};playing=true;move(-1,0);if(player.x!==1)throw Error('Walked through wall');
player={f:0,x:5,y:4};action();if(player.f!==1)throw Error('Stair action failed');
targetExtinguisher=cfg.extinguishers[0];player={f:1,x:2,y:3};fire={f:0,x:3,y:3};action();if(!carrying)throw Error('Extinguisher pickup failed');
cfg.extinguishers.push({f:0,x:2,y:2});carrying=false;player={f:0,x:2,y:3};action();if(carrying)throw Error('Wrong extinguisher accepted');
for(const r of [0,.3,.8,.999]){const m=chooseMission(()=>r),path=search(m.fire,cfg.extinguishers);if(!same(m.target,path[path.length-1])||near(m.start,m.fire))throw Error('Mission selection failed');}
const missionA=chooseMission(()=>0),missionB=chooseMission(()=>.999);if(same(missionA.start,missionB.start))throw Error('Start is not randomized');
console.log('PASS: randomized starts, closest extinguisher by navigable distance, mandatory target pickup');
cfg.aeds=[{f:0,x:4,y:2},{f:1,x:4,y:2}];missionMode='cardiac';const cardiac=chooseMission(()=>.4),aedPath=search(cardiac.fire,cfg.aeds);if(!same(cardiac.target,aedPath[aedPath.length-1]))throw Error('Wrong AED selection');targetExtinguisher=cfg.aeds[0];fire={f:1,x:3,y:3};player={f:0,x:2,y:2};carrying=false;action();if(carrying)throw Error('Fire extinguisher accepted in cardiac mode');player={f:0,x:4,y:3};action();if(!carrying)throw Error('AED pickup failed');if(!same(route[route.length-1],fire))throw Error('Patient route missing');const originalFinish=finish;let patientCompleted=false;finish=success=>patientCompleted=success;player={f:1,x:3,y:2};action();finish=originalFinish;if(!patientCompleted)throw Error('Patient completion failed');missionMode='fire';
console.log('PASS: cardiac mode AED selection, extinguisher rejection, AED pickup, patient route and E completion');
cfg.extinguishers=[{f:0,x:3,y:2},{f:0,x:6,y:2}];player={f:0,x:1,y:1};fire={f:0,x:6,y:1};carrying=false;targetExtinguisher=cfg.extinguishers[1];configureFireGuidance();if(fireGuidance!=='first'||!same(targetExtinguisher,cfg.extinguishers[0]))throw Error('First on-route extinguisher not selected');player={f:0,x:3,y:1};updateRoute();if(fireGuidance!=='first')throw Error('Switched while pickup still possible');player={f:0,x:5,y:1};updateRoute();if(fireGuidance!=='nearest'||!same(targetExtinguisher,cfg.extinguishers[1]))throw Error('Passing extinguisher did not switch to fire-nearest');player={f:0,x:1,y:1};targetExtinguisher=cfg.extinguishers[1];configureFireGuidance();player={f:0,x:3,y:1};action();if(!carrying)throw Error('First on-route extinguisher pickup rejected');player={f:0,x:5,y:1};updateRoute();if(fireGuidance!=='first'||!same(route[route.length-1],fire))throw Error('Picked equipment incorrectly replaced');carrying=false;cfg.extinguishers=[{f:0,x:2,y:5}];player={f:0,x:1,y:1};targetExtinguisher=cfg.extinguishers[0];configureFireGuidance();if(fireGuidance!=='nearest')throw Error('Off-route extinguisher selected as first encounter');
console.log('PASS: first on-route extinguisher, pass-by fallback, pickup preservation and no on-route fallback');
if(smokeDensity(0,180,'fire')!==0||smokeDensity(90,180,'fire')<=smokeDensity(30,180,'fire')||smokeDensity(180,180,'cardiac')!==0)throw Error('Smoke mode or timing invalid');
floor=0;const oldGrid=MAPS[0].grid;MAPS[0].grid=Array.from({length:8},()=>Array(8).fill(0));MAPS[0].grid[2][2]=1;G3.cache=null;const firstWalls=walls3();MAPS[0].grid[2][3]=1;const editedWalls=walls3();if(firstWalls[0].w!==.25||editedWalls[0].w!==.5)throw Error('3D geometry did not follow edited grid');MAPS[0].grid=oldGrid;G3.cache=null;
const identity=identity4(),combined=mul4(identity,transform4(2,3,4));if(combined[12]!==2||combined[13]!==3||combined[14]!==4)throw Error('3D matrix invalid');
console.log('PASS: fire-only progressive smoke, live edited-map 3D geometry, 3D transforms');
cfg.stairs[1]={f:1,x:0,y:0};let failed=false;try{validate();}catch(e){failed=true;}if(!failed)throw Error('Accepted invalid stairs');
playing=false;
floor=0;view={scale:20,ox:0,oy:0};MAPS[0].w=20;MAPS[0].h=20;MAPS[0].grid=Array.from({length:20},()=>Array(20).fill(1));cfg.edits=[];
const eraseTarget={x:145,y:145},erasable=eraserCells(eraseTarget);if(erasable.length!==9)throw Error('50px eraser footprint incorrect');
eraseAt(eraseTarget);if(MAPS[0].grid[6][6]!==0||MAPS[0].grid[8][8]!==0||MAPS[0].grid[9][9]!==1||cfg.edits.length!==9)throw Error('Eraser missed target or erased outside');
eraseAt(eraseTarget);if(cfg.edits.length!==9)throw Error('Duplicate erase edits');
view.scale=10;if(eraserCells({x:250,y:250}).length!==0)throw Error('Out of map eraser not clipped');
console.log('PASS: 50px eraser footprint, clipping, grid update, persistence edits and duplicate strokes');
`,env);
console.log('PASS: JS syntax, SKP map presence, pathfinding across floors, collision, E stair movement, extinguisher pickup, invalid setting rejection');




env.restoreMaps=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../data/maps.json'),'utf8'));
vm.runInContext(`(async()=>{
MAPS.forEach((m,i)=>Object.assign(m,restoreMaps[i]));applyConfig(DEFAULT_CONFIG);const c=clone(cfg);c.rooms=[{...c.spawn,name:'서버 덮어쓰기 검사'}];await overwriteMapFile({size:1000,text:async()=>JSON.stringify(c)});if(cfg.rooms[0].name!=='서버 덮어쓰기 검사')throw Error('Map overwrite failed');const before=JSON.stringify(cfg),saved=localStorage.getItem('fire-mission-config');const bad=clone(cfg);bad.edits=[{...bad.spawn,v:1}];await overwriteMapFile({size:1000,text:async()=>JSON.stringify(bad)});if(JSON.stringify(cfg)!==before||localStorage.getItem('fire-mission-config')!==saved)throw Error('Invalid reload did not roll back');console.log('PASS: map JSON overwrite and invalid import rollback');
})()`,env).catch(e=>{console.error(e);process.exitCode=1;});
