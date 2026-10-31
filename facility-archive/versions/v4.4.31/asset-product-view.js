 function productPhotoBox(item){
  const src=photos.get(item.photo)||(typeof item.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(item.photo)?item.photo:'');
  const visual=src?'<img src="'+esc(src)+'" alt="'+esc(item.name)+' 제품사진">':'<span class="asset-product-placeholder">📷<span>'+(item.photo?'사진 불러오는 중':'등록된 제품사진 없음')+'</span></span>';
  return '<div class="asset-product-box"><strong class="asset-product-caption">제품사진</strong><button type="button" class="asset-product-picture" data-asset-photo="'+esc(item.id)+'" data-photo-ref="'+esc(item.photo||'')+'" aria-label="'+esc(item.name)+' 제품사진 보기">'+visual+'</button><div class="asset-product-buttons"><button type="button" data-asset-register="'+esc(item.id)+'">등록</button><button type="button" data-asset-edit="'+esc(item.id)+'">변경</button></div><span class="asset-product-message" role="status"></span></div>';
 }
 function observeProductPhotos(){
  const load=async button=>{if(!button.isConnected)return;const id=button.dataset.assetPhoto,ref=button.dataset.photoRef,item=store().items.find(x=>x&&x.id===id);if(!item||item.photo!==ref||!drive(ref))return;
   try{const src=await photoLoader.load(id,ref);const current=store().items.find(x=>x&&x.id===id);if(!button.isConnected||button.dataset.photoRef!==ref||current?.photo!==ref)return;const img=document.createElement('img');img.src=src;img.alt=item.name+' 제품사진';button.replaceChildren(img)}
   catch(error){if(button.isConnected&&button.dataset.photoRef===ref){button.innerHTML='<span class="asset-product-placeholder">📷<span>사진을 불러오지 못했습니다</span></span>';button.closest('.asset-product-box').querySelector('.asset-product-message').textContent='제품사진을 눌러 다시 조회하세요.'}}
  };
  const buttons=[...section.querySelectorAll('[data-asset-photo]')];for(const button of buttons)button.onclick=()=>openDetail(button.dataset.assetPhoto);
  if('IntersectionObserver' in window){photoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){photoObserver.unobserve(entry.target);load(entry.target)}},{rootMargin:'180px'});buttons.filter(b=>drive(b.dataset.photoRef)&&!photos.has(b.dataset.photoRef)).forEach(b=>photoObserver.observe(b))}
  else buttons.filter(b=>drive(b.dataset.photoRef)&&!photos.has(b.dataset.photoRef)).forEach(load);
 }
