(()=>{
 'use strict';if(window.FacilityPopupBehavior)return;const baseline=new WeakMap(),stack=[];let press=null;
 function fingerprint(dialog){return JSON.stringify({fields:Array.from(dialog.querySelectorAll('form input,form select,form textarea')).map(el=>({tag:el.tagName,type:el.type,name:el.name,id:el.id,value:el.type==='file'?Array.from(el.files||[]).map(f=>[f.name,f.size,f.lastModified]):el.value,checked:el.checked,selected:el.multiple?Array.from(el.selectedOptions).map(x=>x.value):null})),images:dialog.id==='repairDialog'&&typeof window.RepairPhotoDraftSignature==='function'?[window.RepairPhotoDraftSignature()]:Array.from(dialog.querySelectorAll('form img')).map(x=>x.getAttribute('src')||''),pressed:Array.from(dialog.querySelectorAll('form [aria-pressed]')).map(x=>[x.id,x.getAttribute('aria-pressed')])})}
 function opened(dialog){const i=stack.indexOf(dialog);if(i>=0)stack.splice(i,1);stack.push(dialog);queueMicrotask(()=>{if(dialog.open)baseline.set(dialog,fingerprint(dialog))})}
 for(const method of ['showModal','show']){const original=HTMLDialogElement.prototype[method];HTMLDialogElement.prototype[method]=function(...args){const result=original.apply(this,args);opened(this);return result}}
 document.querySelectorAll('dialog[open]').forEach(opened);
 function top(){return stack.filter(x=>x.isConnected&&x.open).slice(-1)[0]||Array.from(document.querySelectorAll('dialog[open]')).slice(-1)[0]}
 function outside(dialog,event){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom}
 function busy(dialog){
  if(typeof cloudSaving!=='undefined'&&cloudSaving)return true;
  if(dialog.id==='dcDialog'&&window.DutyChangesView&&window.DutyChangesView.getContext().busy)return true;
  if(dialog.id==='repairDialog'&&((typeof repairSaving!=='undefined'&&repairSaving)||(typeof repairProcessing!=='undefined'&&repairProcessing)))return true;
  if(/^duty/.test(dialog.id)&&typeof window.DutyManagementIsBusy==='function'&&window.DutyManagementIsBusy())return true;
  return dialog.getAttribute('aria-busy')==='true';
 }
 const downEvent='PointerEvent' in window?'pointerdown':'mousedown';
 document.addEventListener(downEvent,event=>{if(event.button!==0||event.isPrimary===false){press=null;return}const dialog=top();press=dialog?{dialog,outside:outside(dialog,event)}:null},true);
 document.addEventListener('click',event=>{
  const down=press;press=null;const dialog=top();if(!dialog||!down||down.dialog!==dialog||!down.outside||!outside(dialog,event))return;
  event.preventDefault();event.stopImmediatePropagation();if(busy(dialog))return;
  const cancel=new Event('cancel',{cancelable:true});if(!dialog.dispatchEvent(cancel))return;
  if(baseline.has(dialog)&&baseline.get(dialog)!==fingerprint(dialog)&&!confirm('아직 저장하지 않은 입력·사진 변경사항이 있습니다. 저장하지 않고 닫을까요?'))return;
  dialog.close('cancel');
 },true);
 document.addEventListener('close',event=>{if(event.target instanceof HTMLDialogElement){if(event.target.open)return;baseline.delete(event.target);const i=stack.indexOf(event.target);if(i>=0)stack.splice(i,1)}},true);
 window.FacilityPopupBehavior={isDirty:dialog=>baseline.has(dialog)&&baseline.get(dialog)!==fingerprint(dialog)};
})();
