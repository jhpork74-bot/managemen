var RepairPhotosCore=(function(){
 'use strict';
 function read(record){const saved=record.workPhotos&&typeof record.workPhotos==='object'&&!Array.isArray(record.workPhotos)?record.workPhotos:{};return {fault:typeof record.photo==='string'?record.photo:'',before:typeof saved.before==='string'?saved.before:'',during:typeof saved.during==='string'?saved.during:'',after:typeof saved.after==='string'?saved.after:''}}
 function merge(previous,draft){return {...(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{}),before:draft.before||'',during:draft.during||'',after:draft.after||''}}
 function imageSource(value){return typeof value==='string'&&(/^(data:image\/(jpeg|png|webp|gif);base64,|https:\/\/)/i.test(value))?value:''}
 return {read,merge,imageSource};
})();
