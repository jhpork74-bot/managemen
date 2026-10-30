// Conservative three-way merge. Related business fields are one atomic unit.
const FacilityMerge=(()=>{
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const stable=v=>v===undefined?'undefined':JSON.stringify(v,function(k,x){return x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,k)=>(Object.defineProperty(o,k,{value:x[k],enumerable:true}),o),{}):x});
 const equal=(a,b)=>stable(a)===stable(b);
 const groups=[['items','tasks','checks','weeklyChecks','monthlyChecks','repeatSchedules'],['stock','orders','movements'],['dutyManagement','dutyChanges']];
 const names=['업무·점검·반복일정','재고·발주·입출고','당직표·당직변경'];
 function taskEdits(b,l,r){
  if(![b,l,r].every(Array.isArray))return null;
  const ids=b.map(x=>x&&x.id);if(ids.some(x=>typeof x!=='string')||new Set(ids).size!==ids.length)return null;
  // Structural changes/reordering and repeat edits remain atomic.
  if(!equal(ids,l.map(x=>x&&x.id))||!equal(ids,r.map(x=>x&&x.id)))return null;
  const out=[];for(let i=0;i<b.length;i++){
   if(equal(l[i],b[i]))out.push(clone(r[i]));else if(equal(r[i],b[i])||equal(l[i],r[i]))out.push(clone(l[i]));else return null;
  }return out;
 }
 function merge(base,local,remote,choices={}){
  if(!base)return {data:clone(local),conflicts:[{key:'legacy',label:'기준 자료가 없는 이전 임시본',local,remote}],legacy:true};
  const result={},conflicts=[],keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]),units=groups.map((ks,i)=>({ks,label:names[i],key:ks[0]}));
  const grouped=new Set(groups.flat());for(const key of keys)if(!grouped.has(key))units.push({ks:[key],key,label:({repairs:'고장·공사',csfs:'CSFS 게시판',workDiaryDrafts:'업무일지 초안'})[key]||key});
  for(const unit of units){
   const pick=d=>Object.fromEntries(unit.ks.filter(k=>Object.prototype.hasOwnProperty.call(d,k)).map(k=>[k,d[k]]));
   const b=pick(base),l=pick(local),r=pick(remote);let selected;
   if(equal(l,b))selected=r;else if(equal(r,b)||equal(l,r))selected=l;
   else{
    const withoutTasks=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='tasks'));
    const tasks=unit.key==='items'&&equal(withoutTasks(b),withoutTasks(l))&&equal(withoutTasks(b),withoutTasks(r))?taskEdits(b.tasks,l.tasks,r.tasks):null;
    if(tasks)selected={...r,tasks};else{conflicts.push({key:unit.key,label:unit.label,local:l,remote:r});selected=choices[unit.key]==='remote'?r:l;}
   }
   for(const [key,value] of Object.entries(selected))Object.defineProperty(result,key,{value:clone(value),enumerable:true,writable:true,configurable:true});
  }
  return {data:result,conflicts};
 }
 return {clone,equal,merge};
})();
