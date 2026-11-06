/** 시설관리 v4.4 리뷰 수정 통합본. 기존 운영 프로젝트와 SPREADSHEET_ID를 유지합니다. */
function doGet(e){
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('시설관리 통합업무 · 본관/분관')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function includeDutyManagementUI_(){return HtmlService.createHtmlOutputFromFile('DutyManagementUI').getContent()}

function safe_(v) {
  const s=String(v===undefined||v===null?'':v);
  // Spreadsheet formula injection prevention
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}
function put_(book,name,head,rows){
  const sh=book.getSheetByName(name)||book.insertSheet(name);
  sh.clearContents();
  const all=[head,...rows].map(row=>row.map(safe_));
  if(all.length)sh.getRange(1,1,all.length,head.length).setValues(all);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,head.length).setFontWeight('bold').setBackground('#dbeafe');
}
function num_(x){const n=Number(x);return Number.isSafeInteger(n)&&n>=0?n:0}
function writeAll_(d){
  const ss=SpreadsheetApp.openById(facilitySpreadsheetId_());
  const items=d.items||[], tasks=d.tasks||[], stock=d.stock||[], orders=d.orders||[], movements=d.movements||[];
  const itemMap=Object.fromEntries(items.map(i=>[i.id,i.name]));
  const stockMap=Object.fromEntries(stock.map(i=>[i.id,i]));
  put_(ss,'시설관리 일정',['업무ID','일자','업무명','구분','상태','담당자','장소','내용','업무분류','반복그룹','반복시작일','반복종료일'],
    tasks.map(t=>[t.id,t.date,t.name,t.type,t.state,t.owner,t.place,t.note,({daily:'일일',weekly:'주간',monthly:'월간'})[t.frequency]||'일일',t.repeatGroup||'',t.repeatStart||'',t.repeatUntil||'']));
  put_(ss,'점검항목',['점검항목ID','점검항목명','분류','점검주기'],items.map(i=>[i.id,i.name,i.type,i.frequency==='monthly'?'월간':i.frequency==='weekly'?'주간':'일일']));
  const checks=[];
  Object.keys(d.checks||{}).sort().forEach(date=>{
    const rec=d.checks[date]||{};
    items.filter(i=>!i.frequency||i.frequency==='daily').forEach(i=>checks.push([date,'일일',i.id,i.name,i.type,rec[i.id]===true?'완료':'미완료',rec._memo||'','']));
  });
  Object.keys(d.weeklyChecks||{}).sort().forEach(w=>{const rec=d.weeklyChecks[w]||{};items.filter(i=>i.frequency==='weekly').forEach(i=>checks.push([w,'주간',i.id,i.name,i.type,rec[i.id]===true?'완료':'미완료',rec._memo||'',rec._dates&&rec._dates[i.id]||'']));});
  Object.keys(d.monthlyChecks||{}).sort().forEach(m=>{const rec=d.monthlyChecks[m]||{};items.filter(i=>i.frequency==='monthly').forEach(i=>checks.push([m,'월간',i.id,i.name,i.type,rec[i.id]===true?'완료':'미완료',rec._memo||'',rec._dates&&rec._dates[i.id]||'']));});
  checks.forEach(row=>{while(row.length<8)row.push('')});
  put_(ss,'점검 기록',['점검일/월','점검주기','점검항목ID','점검항목명','분류','완료여부','점검메모','실제 점검날짜'],checks);
  put_(ss,'자판기 재고',['재료ID','재료명','박스당 낱개','본관 박스','본관 낱개','본관 환산','분관 박스','분관 낱개','분관 환산','총합계','발주필요','본관 사용','본관 최소','본관 보충필요','분관 사용','분관 최소','분관 보충필요'],
    stock.map(x=>{
      const p=Math.max(1,num_(x.pack)||1),a=num_(x.boxone)*p+num_(x.one),b=num_(x.boxtwo)*p+num_(x.two);
      return [x.id,x.name,p,num_(x.boxone),num_(x.one),a,num_(x.boxtwo),num_(x.two),b,a+b,a+b<4?'예':'아니오',x.siteUseOne===false?'아니오':'예',stockMinimum_(x,'one'),x.siteUseOne!==false&&a<(stockMinimum_(x,'one'))?'예':'아니오',x.siteUseTwo===false?'아니오':'예',stockMinimum_(x,'two'),x.siteUseTwo!==false&&b<(stockMinimum_(x,'two'))?'예':'아니오'];
    }));
  put_(ss,'발주 관리',['발주ID','재료ID','재료명','입고장소','박스','낱개','박스당 수량','총 낱개','발주일','도착예정일','상태','처리일','메모'],
    orders.map(o=>[o.id,o.itemId,(stockMap[o.itemId]||{}).name||'',o.site==='one'?'복지관 본관':'복지관 분관',o.boxes,o.singles,o.pack,num_(o.boxes)*num_(o.pack)+num_(o.singles),o.date,o.eta,o.status,o.processedAt||'',o.note||'']));
  put_(ss,'입출고 내역',['기록ID','재료ID','재료명','장소','구분','낱개 수량','날짜','메모','연결 발주ID'],
    movements.map(m=>[m.id,m.itemId,m.itemName||itemMap[m.itemId]||'',m.site==='one'?'복지관 본관':'복지관 분관',m.type==='in'?'입고':'출고',m.qty,m.date,m.note,m.orderId||'']));
  const months=new Set(tasks.map(t=>String(t.date||'').slice(0,7)));
  for(const records of [d.checks,d.weeklyChecks,d.monthlyChecks])for(const [key,rec] of Object.entries(records||{})){months.add(key.slice(0,7));for(const date of Object.values(rec&&rec._dates||{}))months.add(String(date).slice(0,7))}
  put_(ss,'월간 통계',['월','점검 기록 회수','완료 점검항목','점검 대상항목','완료율(%)','완료 업무','전체 업무','일일 완료','일일 대상','주간 완료','주간 대상','월간 완료','월간 대상'],
    [...months].filter(m=>/^\d{4}-\d{2}$/.test(m)).sort().map(m=>{
      const a=inspectionMonthAggregate(d,m),ts=tasks.filter(t=>String(t.date||'').startsWith(m));
      return [m,a.periods,a.done,a.total,a.total?Math.round(a.done/a.total*100):0,ts.filter(t=>t.state==='완료').length,ts.length,a.cycles.daily.done,a.cycles.daily.total,a.cycles.weekly.done,a.cycles.weekly.total,a.cycles.monthly.done,a.cycles.monthly.total];
    }));
  const repairs=d.repairs||[];
  put_(ss,'고장 관리',['ID','접수일','고장 위치','장소','담당자 또는 업체','재료 구비','조치 상태','내용','사진 등록 여부'],
    repairs.filter(x=>x.kind==='fault').map(x=>[x.id,x.date,x.title,x.site,x.owner,x.materials,x.done,x.note,x.photo?'있음':'없음']));
  put_(ss,'공사 처리',['ID','접수일','공사명','장소','업체 견적서 상황','공사 예정일','예산(원)','자금 출처','완료 상태','내용'],
    repairs.filter(x=>x.kind==='work').map(x=>[x.id,x.date,x.title,x.site,x.quote,x.due,x.budget,x.funding||'',x.workStatus,x.note]));
  if(d.assetManagement&&typeof writeAssetReports_==='function')writeAssetReports_(ss,d);
  put_(ss,'동기화 정보',['항목','값'],[['마지막 서버 저장시각',new Date().toISOString()],['방식','Google 웹앱 → Google 시트 공통 저장']]);
}

function inspectionMonthAggregate(d,month){
  const modes={daily:{records:d.checks||{},label:'일일'},weekly:{records:d.weeklyChecks||{},label:'주간'},monthly:{records:d.monthlyChecks||{},label:'월간'}};
  const result={done:0,total:0,days:0,periods:0,cycles:{}};
  for(const [mode,entry] of Object.entries(modes)){
    const items=(d.items||[]).filter(i=>(i.frequency||'daily')===mode);let done=0,total=0;const periods=new Set();
    for(const [key,record] of Object.entries(entry.records)){
      if(!record||typeof record!=='object')continue;
      for(const item of items){
        // Attribute cross-month weeks by actual item date, otherwise by week start.
        const date=mode==='daily'?key:(record._dates&&record._dates[item.id]||key);
        if(String(date).slice(0,7)!==month)continue;
        periods.add(key);total++;if(record[item.id]===true)done++;
      }
    }
    result.cycles[mode]={label:entry.label,done,total,periods:periods.size};
    result.done+=done;result.total+=total;result.periods+=periods.size;
  }
  result.days=result.cycles.daily.periods;return result;
}

function stockMinimum_(item,site){const value=item[site==='one'?'siteMinOne':'siteMinTwo'];return Number.isSafeInteger(value)&&value>=0&&value<=999999?value:4}
