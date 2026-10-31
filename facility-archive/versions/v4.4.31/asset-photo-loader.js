// Bounded private-photo cache and shared two-request queue. No business-data writes.
function createAssetPhotoLoader(fetcher,cache=new Map(),limit=2,maxCache=40){
 const pending=new Map(),queue=[];let active=0;
 function remember(ref,src){cache.delete(ref);cache.set(ref,src);while(cache.size>maxCache)cache.delete(cache.keys().next().value);return src}
 function drain(){while(active<limit&&queue.length){const job=queue.shift();active++;Promise.resolve().then(()=>fetcher(job.id,job.ref)).then(src=>job.resolve(remember(job.ref,src)),job.reject).finally(()=>{active--;pending.delete(job.key);drain()})}}
 function load(id,ref){if(cache.has(ref))return Promise.resolve(remember(ref,cache.get(ref)));const key=JSON.stringify([id,ref]);if(pending.has(key))return pending.get(key);const promise=new Promise((resolve,reject)=>queue.push({id,ref,key,resolve,reject}));pending.set(key,promise);drain();return promise}
 return {load,cache};
}
