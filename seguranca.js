/* Bloqueia envio de credenciais e checkouts de módulos externos não integrados. */
(()=>{'use strict';
 function guard(root){
  if(!(root instanceof Element))return;
  const fields=root.matches('input')?[root]:root.querySelectorAll('input');
  for(const field of fields){
   if(field.type==='password'||/password|senha/i.test(field.name||'')){
    field.disabled=true;
    field.readOnly=true;
    field.autocomplete='off';
    field.value='';
   }
  }
 }
 function init(){
  const observer=new MutationObserver(items=>{
   for(const item of items)for(const node of item.addedNodes)guard(node);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  guard(document.body);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
 document.addEventListener('submit',event=>{
  const form=event.target;
  if(form?.querySelector?.('input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"]')){
   event.preventDefault();event.stopImmediatePropagation();
  }
 },true);
 document.addEventListener('click',event=>{
  const el=event.target.closest?.('a,button');if(!el)return;
  const href=el.getAttribute('href')||'';
  if(href.includes('hancefy.com.br'))return;
  const label=((el.textContent||'')+' '+href).toLowerCase();
  if(label.includes('hancefy.com.br'))return;
  let external=false;try{external=/^https?:/i.test(href)&&new URL(href,location.href).origin!==location.origin}catch{}
  if(external||/checkout|compre agora|comprar agora|finalizar compra|pagar agora|garantir acesso|ir para pagamento|login|entrar com senha/.test(label)){
   event.preventDefault();event.stopImmediatePropagation();
  }
 },true);
})();
