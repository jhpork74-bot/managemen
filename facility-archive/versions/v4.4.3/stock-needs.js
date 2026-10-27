function stockLocationMinimum(item,site){
 const value=item[site==='one'?'siteMinOne':'siteMinTwo'];return Number.isSafeInteger(value)&&value>=0&&value<=999999?value:4;
}
function stockLocationUsed(item,site){return item[site==='one'?'siteUseOne':'siteUseTwo']!==false}
function stockLocationNeeds(item){
 const result=[];
 for(const site of ['one','two']){
  if(!stockLocationUsed(item,site))continue;
  const quantity=stockSiteTotal(item,site),minimum=stockLocationMinimum(item,site);
  if(quantity>=minimum)continue;
  const other=site==='one'?'two':'one',spare=Math.max(0,stockSiteTotal(item,other)-(stockLocationUsed(item,other)?stockLocationMinimum(item,other):0));
  result.push({site,quantity,minimum,shortage:minimum-quantity,from:other,transfer:Math.min(spare,minimum-quantity)});
 }
 return result;
}
function renderLocationStockWarnings(){
 const flagged=data.stock.map(item=>({item,needs:stockLocationNeeds(item)})).filter(x=>x.needs.length);
 let panel=$('stockLocationAlerts');if(!panel){panel=document.createElement('div');panel.id='stockLocationAlerts';panel.setAttribute('role','status');$('stockAlert').after(panel)}
 panel.innerHTML='<h3>장소별 보충·이동 검토</h3><p class="mutedtext">전체 발주 기준(합계 4개 미만)과 별도로 확인합니다. 이동은 제안이며 재고를 자동 변경하지 않습니다.</p>'+(flagged.length?flagged.map(({item,needs})=>'<div class="stock-location-warning"><strong>'+esc(item.name)+'</strong>'+needs.map(n=>'<p>'+esc(n.site==='one'?'본관':'분관')+' '+n.quantity+'개 / 기준 '+n.minimum+'개 · '+n.shortage+'개 부족'+(n.transfer?' · '+(n.from==='one'?'본관 → 분관':'분관 → 본관')+' '+n.transfer+'개 이동 검토':stockTotal(item)<4?' · 전체 발주도 필요':' · 보충·배분 또는 추가 발주 검토')+'</p>').join('')+'</div>').join(''):'<p>사용 장소별 최소 수량을 충족합니다.</p>');
 $('stockRows').querySelectorAll('[data-stock-one],[data-stock-two]').forEach(input=>{
  const site=input.dataset.stockOne!==undefined?'one':'two',id=input.dataset.stockOne||input.dataset.stockTwo,item=data.stock.find(i=>String(i.id)===id);
  if(!item)return;const cell=input.closest('td'),low=stockLocationNeeds(item).some(n=>n.site===site);cell.classList.toggle('stock-location-low',low);
  const hint=document.createElement('div');hint.className='sub';hint.textContent=stockLocationUsed(item,site)?'장소 기준 '+stockLocationMinimum(item,site)+'개'+(low?' · 보충 필요':''):'이 장소는 부족 경고 제외';cell.appendChild(hint);
 });
}
