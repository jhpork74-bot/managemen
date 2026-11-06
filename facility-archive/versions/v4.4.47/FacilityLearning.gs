/** 시설관리 배움터: 공식 RSS 수집. 업무 JSON/버전은 변경하지 않습니다. */
function includeFacilityLearningUI_(){return HtmlService.createHtmlOutputFromFile('FacilityLearningUI').getContent()}
function learningText_(s){return String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function learningParseFeed_(xml,now){
 const root=XmlService.parse(xml).getRootElement(),channel=root.getChild('channel');if(!channel)throw Error('RSS 형식이 변경되었습니다.');
 const seen={},rows=[];channel.getChildren('item').forEach(function(item){
  const title=learningText_(item.getChildText('title')),url=String(item.getChildText('link')||'').replace(/&amp;/g,'&').trim(),rawDate=item.getChildText('pubDate'),d=new Date(rawDate);
  if(!/^https:\/\/www\.mois\.go\.kr\//i.test(url)||!/(시설|안전|화재|재난|한파|폭염|동파|침수|건축|승강기|소방|전기|공사)/.test(title)||seen[url]||!isFinite(d.getTime())||d.getTime()>now+86400000||now-d.getTime()>45*86400000)return;
  seen[url]=true;rows.push({id:'news-'+facilityRequestHash_(url).slice(0,24),title:title.slice(0,180),category:'시설 이슈',source:'행정안전부 · 공식 RSS',url:url,publishedAt:d.toISOString(),kind:'news',summary:learningText_(item.getChildText('description')).slice(0,180),body:['공식 RSS에서 제공한 제목과 소개문입니다. 소개문이 짧거나 없으면 원문 확인이 필요합니다.','현장 적용 메모: 우리 시설과 관계된 내용인지 확인하고, 대상 장소·담당자·확인할 사항을 업무 일정에 정리해 보세요. 이 문장은 배움터의 학습 제안이며 원문 내용이 아닙니다.']});
 });return rows.sort(function(a,b){return b.publishedAt.localeCompare(a.publishedAt)}).slice(0,20);
}
function getFacilityLearningFeed(){
 const now=Date.now(),day=Utilities.formatDate(new Date(now),'Asia/Seoul','yyyy-MM-dd'),ss=SpreadsheetApp.openById(facilitySpreadsheetId_()),name='_시설배움터_피드';
 let previous=null;const readLock=facilityLock_();try{const raw=readJsonSheet_(ss.getSheetByName(name));if(raw)previous=JSON.parse(raw)}finally{readLock.releaseLock()}
 if(previous&&((previous.day===day&&!previous.error)||(previous.error&&now-previous.attemptedAt<1800000)))return previous;
 let result;
 try{
  const response=UrlFetchApp.fetch('https://www.mois.go.kr/gpms/view/jsp/rss/rss.jsp?ctxCd=1012',{muteHttpExceptions:true,followRedirects:false});if(response.getResponseCode()!==200)throw Error('공식 RSS 응답 오류');
  const articles=learningParseFeed_(response.getContentText('UTF-8'),now);
  result={day:day,attemptedAt:now,checkedAt:new Date(now).toISOString(),articles:articles,error:'',message:articles.length?'게시일 순으로 최근 45일의 관련 소식을 표시합니다.':'최근 45일 공식 RSS에 관련 새 자료가 없습니다.'};
 }catch(e){result={day:day,attemptedAt:now,checkedAt:previous&&previous.checkedAt||null,articles:previous&&previous.articles||[],error:'새 자료를 가져오지 못했습니다. 이전 자료를 유지하며 30분 뒤 다시 확인합니다.',message:'수집 지연 — 기존 자료'};}
 const lock=facilityLock_();try{const raw=readJsonSheet_(ss.getSheetByName(name)),current=raw?JSON.parse(raw):null;if(current&&current.attemptedAt>now)return current;writeJsonSheet_(ss,name,JSON.stringify(result),now);SpreadsheetApp.flush()}finally{lock.releaseLock()}
 return result;
}
/** 선택 사항: 편집기에서 관리자가 실행하면 매일 한국시간 07시대 수집합니다. */
function installFacilityLearningDailyUpdate(){iniAssertEditor_();const fn='refreshFacilityLearningDaily';if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()===fn}))ScriptApp.newTrigger(fn).timeBased().atHour(7).everyDays(1).inTimezone('Asia/Seoul').create();return '매일 한국시간 07시대 갱신. 앱을 열 때도 날짜를 확인합니다.'}
function refreshFacilityLearningDaily(){return getFacilityLearningFeed()}
