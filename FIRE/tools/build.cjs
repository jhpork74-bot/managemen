const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const floors=[1,2].map(f=>{
 const faces=JSON.parse(fs.readFileSync(path.join(root,`data/floor${f}-faces.json`),'utf8').replace(/^\uFEFF/,''));
 // Models contain wall footprints on Z=0. Vertical faces and stair treads are excluded.
 const polygons=faces.filter(p=>p.length>=3&&p.every(v=>Math.abs(v[2])<0.01)).map(p=>p.map(v=>[v[0]*.0254,v[1]*.0254]));
 const pts=polygons.flat(),minX=Math.min(...pts.map(p=>p[0]))-.5,maxY=Math.max(...pts.map(p=>p[1]))+.5;
 const cell=.25,w=Math.ceil((Math.max(...pts.map(p=>p[0]))-minX+.5)/cell),h=Math.ceil((maxY-Math.min(...pts.map(p=>p[1]))+.5)/cell);
 const polys=polygons.map(p=>p.map(v=>[(v[0]-minX)/cell,(maxY-v[1])/cell]));
 function inside(x,y,p){let b=false;for(let i=0,j=p.length-1;i<p.length;j=i++){let a=p[i],c=p[j];if((a[1]>y)!=(c[1]>y)&&x<(c[0]-a[0])*(y-a[1])/(c[1]-a[1])+a[0])b=!b;}return b;}
 const grid=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>polys.some(p=>inside(x+.5,y+.5,p))?1:(x===0||y===0||x===w-1||y===h-1?-1:0)));
 return {name:`${f}층`,w,h,cell,grid,polygons:polys,source:`${f}층도면.skp`};
});
function nearest(f,x,y){const m=floors[f];let best=null,dist=Infinity;for(let j=1;j<m.h-1;j++)for(let i=1;i<m.w-1;i++)if(!m.grid[j][i]){const d=(i-x)**2+(j-y)**2;if(d<dist){dist=d;best={f,x:i,y:j};}}return best;}
const defaults={spawn:nearest(0,65,34),stairs:[nearest(0,148,50),nearest(1,145,50)],extinguishers:[nearest(0,35,34),nearest(1,80,34)],limit:180,edits:[]};
fs.writeFileSync(path.join(root,'Maps.html'),'<script>const MAPS='+JSON.stringify(floors)+';const DEFAULT_CONFIG='+JSON.stringify(defaults)+';</script>');
fs.writeFileSync(path.join(root,'data/maps.json'),JSON.stringify(floors));
const sprite=path.join(root,'assets/firefighter-119-transparent.png');
let source=fs.readFileSync(path.join(root,'Index.html'),'utf8');
if(fs.existsSync(sprite)){source=source.replace(/characterSprite\.src='data:image\/png;base64,[^']*'/,"characterSprite.src='data:image/png;base64,"+fs.readFileSync(sprite).toString('base64')+"'");fs.writeFileSync(path.join(root,'Index.html'),source);}
let html=source.replace("<?!= include_('Maps'); ?>",fs.readFileSync(path.join(root,'Maps.html'),'utf8')).replace("<?!= include_('Engine3D'); ?>",fs.readFileSync(path.join(root,'Engine3D.html'),'utf8'));
fs.writeFileSync(path.join(root,'preview.html'),html);
console.log(floors.map(f=>({floor:f.name,w:f.w,h:f.h,wallCells:f.grid.flat().filter(v=>v===1).length,polygons:f.polygons.length})));
