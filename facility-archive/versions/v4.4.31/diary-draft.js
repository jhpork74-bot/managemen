 function buildDiaryText(rows,end,filter){
  const range=diaryDates(end),within=day=>valid(day)&&day>=range.start&&day<=range.end;
  const selected=data.tasks.filter(t=>(t.frequency||'daily')==='daily'&&!t.repeatGroup&&!t.repeatStart&&!t.repeatNoEnd&&!t.inspectionItemId&&!t.inspectionSource&&['완료','미완료','예정','진행 중'].includes(t.state)).map(task=>({task,date:task.state==='완료'?taskCompletionDate(task):task.date})).filter(x=>within(x.date)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.task.name).localeCompare(String(b.task.name)));
  let text='시설관리 업무일지\n조회일: '+end+'\n조회기간: '+range.start+' ~ '+range.end+' (15일)\n대상: 일일 등록 일반업무 · 완료/미완료 · 반복업무 제외\n업무: '+selected.length+'건 (완료 '+selected.filter(x=>x.task.state==='완료').length+'건 / 미완료 '+selected.filter(x=>x.task.state!=='완료').length+'건)\n',day='';
  for(const row of selected){const t=row.task;if(row.date!==day){day=row.date;text+='\n['+day+']\n'}text+='- ['+(t.state==='완료'?'완료':'미완료')+'] '+t.name+(t.state==='진행 중'?' (진행 중)':'')+(t.place?' / 장소: '+t.place:'')+(t.owner?' / 담당: '+t.owner:'')+(t.state==='완료'&&!taskHasCompletionDate(t)?' (완료일 미기록·예정일 기준)':'')+'\n';if(t.note)text+='  내용: '+t.note+'\n'}
  return text+(selected.length?'':'\n해당 기간의 일일 일반업무가 없습니다.\n');
 }
