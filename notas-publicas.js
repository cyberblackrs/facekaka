(()=>{'use strict';
 const STRIP_ID='gs-notas-borradas';
 const STYLE_ID='gs-notas-borradas-style';
 const ITEMS=[
  {name:'Sua nota',note:'Conte as novidades',image:'/assets-local/notes/pessoa-01.jpg',original:true},
  {name:'Marc*******',note:'📍💦',image:'/assets-local/notes/pessoa-02.jpg',original:true},
  {name:'Ana******',note:'oiii 💕',image:'/assets-local/notes/pessoa-03.jpg'},
  {name:'Gui******',note:'quem tá on?',image:'/assets-local/notes/pessoa-04.jpg'},
  {name:'Bia******',note:'saudades',image:'/assets-local/notes/pessoa-05.jpg'},
  {name:'Lu******',note:'🎧',image:'/assets-local/notes/pessoa-06.jpg'},
  {name:'Isa******',note:'sumida 🫶',image:'/assets-local/notes/pessoa-07.jpg'},
  {name:'Raf******',note:'só observando',image:'/assets-local/notes/pessoa-08.jpg'}
 ];
 let frame=0, lastOriginal=null;
 const direct=()=>/^\/direct(?:\/|$)/.test(location.pathname);
 const getJSON=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
 function activeProfile(){
   const fromURL=new URL(location.href).searchParams.get('username');
   const name=(fromURL||localStorage.getItem('espionado_username')||localStorage.getItem('username')||'').toLowerCase();
   if(!/^[a-z0-9._]{1,30}$/.test(name))return {name:'',photo:null,backup:null};
   const candidates=[getJSON('instagram_profile'),getJSON('gs_last_rapidapi_profile')];
   const available=(value)=>typeof value==='string'&&!value.includes('perfil-sem-foto')&&
     (/^https:\/\//i.test(value)||/^\/api\/avatar\?src=/i.test(value));
   for(const profile of candidates){
     if(profile?.username?.toLowerCase()!==name)continue;
     const image=profile.profile_pic_url,original=profile.profile_pic_original_url;
     if(available(image))return {name,photo:image,backup:available(original)?original:null};
     if(available(original))return {name,photo:original,backup:null};
   }
   return {name,photo:null,backup:null};
 }

 const qsa=(el,s)=>[...el.querySelectorAll(s)];
 const isOwn=el=>Boolean(el.closest('#'+STRIP_ID));
 function originalNotes(){
   // Escolhe APENAS a barra original de notas, jamais a area Mensagens.
   for(const el of document.querySelectorAll('#storiesContainer,.storiesContainer,[data-testid="storiesContainer"]')){
     if(isOwn(el))continue;
     const buttons=qsa(el,'button');
     if(buttons.some(b=>/Sua nota/.test(b.textContent||''))&&buttons.some(b=>/Marc\*{2,}/.test(b.textContent||'')))return el;
   }
   // Fallback para versoes do HTML sem class/id no container.
   const label=qsa(document,'p').find(p=>!isOwn(p)&&p.textContent?.trim()==='Sua nota');
   const btn=label?.closest('button');
   if(!btn)return null;
   let ancestor=btn.parentElement;
   for(let i=0;ancestor&&i<4;i++,ancestor=ancestor.parentElement){
     if(ancestor.querySelector('h2')?.textContent?.includes('Mensagens'))break;
     const buttons=qsa(ancestor,'button');
     if(buttons.some(b=>/Marc\*{2,}/.test(b.textContent||'')))return ancestor;
   }
   return null;
 }
 function ensureStyle(){
   if(document.getElementById(STYLE_ID))return;
   const style=document.createElement('style');style.id=STYLE_ID;
   style.textContent=`
     #${STRIP_ID}{box-sizing:border-box;width:100%;max-width:100%;height:154px;display:flex;align-items:flex-start;gap:12px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:11px 13px 8px;position:relative;z-index:1;background:#0c1014!important;mask-image:none!important;-webkit-mask-image:none!important;}
     #${STRIP_ID}::-webkit-scrollbar{display:none;}
     #${STRIP_ID} .gs-visual-note{position:relative;flex:0 0 72px;min-width:72px;width:72px;margin:0!important;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;background:transparent;border:0;padding:0;color:inherit;text-align:center;cursor:default;}
     #${STRIP_ID} .gs-visual-note > span:first-child{position:relative;z-index:3;display:flex;align-items:center;justify-content:center;min-width:61px;max-width:76px;min-height:27px;border-radius:17px;background:#292d30;color:#fff;box-shadow:0 2px 7px rgba(0,0,0,.14);padding:4px 8px;margin-bottom:-8px;font-size:10px;font-weight:500;line-height:12px;text-align:center;white-space:normal;box-sizing:border-box;}
    #${STRIP_ID} img.gs-note-foto{width:68px!important;height:68px!important;max-width:68px!important;max-height:68px!important;border-radius:50%!important;display:block!important;filter:blur(11px) saturate(1.15) brightness(.82)!important;object-fit:cover!important;flex:0 0 68px;}
    #${STRIP_ID} img.gs-note-own-photo{filter:none!important;}
     #${STRIP_ID} p{white-space:nowrap;max-width:75px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#a8a8a8!important;font-weight:500!important;margin:7px 0 0;line-height:15px;text-align:center;}
     #${STRIP_ID} ~ [class*="gradient"],#${STRIP_ID} ~ [class*="fade"]{display:none!important;}
     @media(max-width:390px){#${STRIP_ID}{gap:10px;padding-left:12px;padding-right:12px;}}
   `;
   document.head.appendChild(style);
 }
 function templates(old){
   const btns=qsa(old,'button');
   const own=btns.find(b=>/Sua nota/.test(b.textContent||''));
   const marc=btns.find(b=>/Marc\*{2,}/.test(b.textContent||''));
   return {own,marc};
 }
 function updateText(button,item){
   const labels=qsa(button,'p');
   const label=labels.find(n=>/Sua nota|Marc\*{2,}/.test(n.textContent||''))||labels.at(-1);
   if(label)label.textContent=item.name;
   // Primeiros dois baloes ficam IDENTICOS ao original, so a foto muda.
   if(item.original)return;
   const spans=qsa(button,'span');
   const candidate=spans.filter(n=>n.children.length===0).find(n=>{
     const t=(n.textContent||'').trim();
     return t&&(/Trindade|📍|💦|Conte as novidades|novidades/.test(t));
   }) || spans.find(n=>!n.querySelector('img') && (n.textContent||'').trim().length>0);
   if(candidate)candidate.textContent=item.note;
   else if(label){
     const pill=document.createElement('span');pill.textContent=item.note;
     pill.className='gs-fallback-pill';
     pill.style.cssText='position:absolute;z-index:3;top:-7px;left:50%;transform:translateX(-50%);background:#292d30;color:#fff;border-radius:16px;padding:5px 8px;font-size:10px;line-height:1.1;white-space:nowrap;';
     button.insertBefore(pill,button.firstChild);
   }
 }
 function noteButton(template,item){
   const b=template.cloneNode(true);
   b.classList.add('gs-visual-note');
   b.removeAttribute('id');
   for(const e of qsa(b,'[id]'))e.removeAttribute('id');
   b.dataset.gsVisualPlaceholder='true';
   b.dataset.gsNoteIndex=String(ITEMS.indexOf(item));
   b.type='button';
   b.title='Nota visual ilustrativa';
   b.setAttribute('aria-label',`Nota ilustrativa de ${item.name}`);
   updateText(b,item);
   const imgs=qsa(b,'img');
   if(imgs.length){
     const img=imgs[0];
     img.classList.add('gs-note-foto');
     img.setAttribute('src',item.image);
     img.removeAttribute('srcset');img.removeAttribute('sizes');
     img.setAttribute('alt','Retrato ilustrativo desfocado');
     img.setAttribute('loading','eager');
   }else{
     const pic=document.createElement('img');pic.className='gs-note-foto';pic.src=item.image;pic.alt='Retrato ilustrativo desfocado';
     pic.style.cssText='width:66px;height:66px;border-radius:50%;';
     b.insertBefore(pic,b.querySelector('p')||null);
   }
   b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
   return b;
 }
 function updateOwnPhoto(shelf){
   const img=shelf.querySelector('[data-gs-note-index="0"] img.gs-note-foto');
   if(!img)return;
   const p=activeProfile();
   const url=p.photo||'/images/avatars/perfil-sem-foto.jpeg';
   const key=p.name+'|'+url;
   if(img.dataset.gsPhotoKey===key)return;
   img.dataset.gsPhotoKey=key;
   img.classList.add('gs-note-own-photo');
   img.alt=p.name?'Foto de perfil pública de @'+p.name:'Foto de perfil indisponível';
   img.dataset.gsPhotoBackup=p.backup||'';
   img.onerror=()=>{
     const backup=img.dataset.gsPhotoBackup;
     img.dataset.gsPhotoBackup='';
     if(backup&&img.getAttribute('src')!==backup){img.setAttribute('src',backup);return;}
     img.onerror=null;
     img.setAttribute('src','/images/avatars/perfil-sem-foto.jpeg');
   };
   img.setAttribute('src',url);
 }
 // Remove apenas o degradê sobreposto à extremidade direita das Notas.
 function removeRightShade(original,shelf){
   const host=original.parentElement;
   if(!host)return;
   for(const parent of [host,host.parentElement]){
     if(!parent)continue;
     const st=getComputedStyle(parent),mask=st.maskImage||st.webkitMaskImage||'';
     if(mask.includes('gradient')){
       parent.style.setProperty('mask-image','none','important');
       parent.style.setProperty('-webkit-mask-image','none','important');
     }
     for(const sibling of [...parent.children]){
       if(sibling===original||sibling===shelf||sibling.contains(shelf)||sibling.contains(original))continue;
       const style=getComputedStyle(sibling),className=typeof sibling.className==='string'?sibling.className:'';
       const fade=/gradient|fade/i.test(className)||/gradient/i.test(style.backgroundImage||'');
       const absolute=['absolute','fixed'].includes(style.position);
       const rect=sibling.getBoundingClientRect(),bar=shelf.getBoundingClientRect();
       const edge=rect.width>0&&rect.width<=130&&rect.right>=bar.right-130&&rect.left<=bar.right+15;
       const overlap=rect.bottom>bar.top+10&&rect.top<bar.bottom-10;
       if(fade&&absolute&&edge&&overlap&&!(sibling.textContent||'').trim()){
         sibling.dataset.gsNotesShade='hidden';
         sibling.style.setProperty('display','none','important');
       }
     }
   }
 }
 function restoreOld(){
   for(const el of document.querySelectorAll('[data-gs-notes-shade="hidden"]')){el.style.removeProperty('display');el.removeAttribute('data-gs-notes-shade');}
   for(const el of document.querySelectorAll('[data-gs-original-notes-hidden="yes"]')){
     el.style.removeProperty('display');el.removeAttribute('data-gs-original-notes-hidden');
   }
 }
 function render(){
   if(!direct()){
     document.getElementById(STRIP_ID)?.remove();restoreOld();lastOriginal=null;return;
   }
   const old=originalNotes();if(!old?.parentElement)return;
   const {own,marc}=templates(old);if(!own||!marc)return;
   ensureStyle();
   let shelf=document.getElementById(STRIP_ID);
   if(!shelf){shelf=document.createElement('div');shelf.id=STRIP_ID;shelf.setAttribute('aria-label','Notas visuais ilustrativas');}
   if(shelf.parentElement!==old.parentElement||shelf.nextElementSibling!==old){old.parentElement.insertBefore(shelf,old);}
   if(old.getAttribute('data-gs-original-notes-hidden')!=='yes'){
     old.setAttribute('data-gs-original-notes-hidden','yes');old.style.setProperty('display','none','important');
   }
   if(lastOriginal!==old || shelf.childElementCount!==ITEMS.length){
     shelf.replaceChildren(...ITEMS.map((item,i)=>noteButton(i===0?own:marc,item)));
     lastOriginal=old;
   }
   updateOwnPhoto(shelf);
   removeRightShade(old,shelf);
 }
 function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()});}
 const observer=new MutationObserver(records=>{
   if(records.some(record=>!document.getElementById(STRIP_ID)?.contains(record.target)))schedule();
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{observer.observe(document.body,{childList:true,subtree:true});schedule();},{once:true});
 else{observer.observe(document.body,{childList:true,subtree:true});schedule();}
 window.addEventListener('popstate',schedule);
 window.addEventListener('gs:public-data',schedule);
 window.addEventListener('storage',schedule);
 window.addEventListener('focus',schedule);
 for(const method of ['pushState','replaceState']){
   const native=history[method];history[method]=function(...args){const result=native.apply(this,args);schedule();return result;};
 }
 window.gsRenderPublicFollowing=schedule;
})();
