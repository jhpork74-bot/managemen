var JandiCalendarCanvas=(function(){
 'use strict';
 function wrap(ctx,text,width){let lines=[''];for(const char of String(text||'')){const n=lines.length-1;if(ctx.measureText(lines[n]+char).width>width&&lines[n])lines.push(char);else lines[n]+=char}return lines}
 function text(ctx,value,x,y,width,maxLines,size,color){let lines=[];for(;size>=12;size--){ctx.font='600 '+size+'px "Malgun Gothic","Noto Sans KR",sans-serif';lines=wrap(ctx,value,width);if(lines.length<=maxLines)break}ctx.fillStyle=color;const step=size+6;lines.slice(0,maxLines).forEach((line,i)=>ctx.fillText(line,x,y+i*step));}
 async function render(snapshot){
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  const date=snapshot.date,month=date.slice(0,7),[year,number]=month.split('-').map(Number),first=new Date(month+'-01T12:00:00Z').getUTCDay(),last=new Date(Date.UTC(year,number,0)).getUTCDate(),rows=Math.ceil((first+last)/7),width=1680,cellH=240,top=160,bottom=52;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=top+rows*cellH+bottom;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,canvas.height);ctx.textBaseline='top';
  text(ctx,year+'년 '+number+'월 '+(snapshot.site==='one'?'본관':'분관')+' 당직변경표',28,20,width-56,1,43,'#163e39');text(ctx,(snapshot.sequence||'')+'번째 변경 · 변경일 '+date+' · 생성 '+snapshot.stamp+' (한국시간)',28,80,width-56,1,24,'#526660');
  const cellW=width/7;['일','월','화','수','목','금','토'].forEach((day,i)=>{ctx.fillStyle='#edf4f1';ctx.fillRect(i*cellW,115,cellW,45);text(ctx,day,i*cellW+18,123,cellW-36,1,25,i===0?'#b63f42':i===6?'#325d9f':'#30483e')});
  for(let i=0;i<rows*7;i++){
   const day=i-first+1,x=(i%7)*cellW,y=top+Math.floor(i/7)*cellH,valid=day>0&&day<=last,key=month+'-'+String(day).padStart(2,'0'),entry=valid&&snapshot.roster.entries[key],holiday=valid&&(snapshot.roster.holidays||{})[key];
   ctx.fillStyle=!valid?'#f2f4f3':entry&&entry.requestedChange?'#fff0cb':!entry?'#f5f6f7':'#fff';ctx.fillRect(x,y,cellW,cellH);ctx.strokeStyle='#c9d7d1';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,cellW-1,cellH-1);if(!valid)continue;
   text(ctx,String(day),x+14,y+12,60,1,29,i%7===0?'#b63f42':i%7===6?'#325d9f':'#1e352d');
   if(key===date){ctx.strokeStyle='#bc7522';ctx.lineWidth=4;ctx.strokeRect(x+3,y+3,cellW-6,cellH-6)}
   if(entry){if(entry.requestedChange)text(ctx,'변경 반영',x+95,y+18,cellW-110,1,18,'#8b5715');text(ctx,entry.primaryName||'미지정',x+14,y+58,cellW-28,3,29,'#172e26');if(entry.lunchRequired)text(ctx,'점심 '+(entry.lunchName||'미지정'),x+14,y+161,cellW-28,2,23,'#735525');if(entry.baselineChanged)text(ctx,'원본 변경 확인 필요',x+14,y+217,cellW-28,1,15,'#a53831')}
   else if(holiday)text(ctx,holiday,x+14,y+62,cellW-28,3,22,'#a64b4b');
  }
  text(ctx,'노란색: 변경 반영 · 테두리: 이번 변경일 · 점심대체가 필요한 날만 두 번째 줄 표시',20,canvas.height-36,width-40,1,21,'#526660');
  let dataUrl='';for(const quality of [.9,.8,.68]){dataUrl=canvas.toDataURL('image/jpeg',quality);if(dataUrl.length<2400000)break}if(dataUrl.length>2800000)throw Error('달력 이미지 크기가 전송 한도를 넘었습니다.');
  return {dataUrl,rosterHash:snapshot.rosterHash,width:canvas.width,height:canvas.height};
 }
 return {render};
})();
