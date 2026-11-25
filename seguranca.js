/* Proteção e Anonimato */
(()=>{
  'use strict';

  // 1. SILENCIAMENTO TOTAL DO CONSOLE (impede inspeção de dados, requisições e rotas)
  try {
    const noop = () => {};
    const methods = [
      'log', 'debug', 'info', 'warn', 'error', 'table', 'trace',
      'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd',
      'time', 'timeEnd', 'profile', 'profileEnd', 'count', 'assert'
    ];
    for (const m of methods) {
      try {
        Object.defineProperty(console, m, {
          configurable: false,
          enumerable: true,
          writable: false,
          value: noop
        });
      } catch {
        try { console[m] = noop; } catch {}
      }
    }
    setInterval(() => {
      try { console.clear(); } catch {}
    }, 1500);
  } catch {}

  // 2. BLOQUEIO DE ATALHOS DE DESENVOLVEDOR E INSPEÇÃO DE CÓDIGO
  const isBlockedKey = (e) => {
    const key = (e.key || '').toLowerCase();
    const code = (e.code || '').toLowerCase();
    const isCtrl = Boolean(e.ctrlKey || e.metaKey); // Ctrl no Windows/Linux, Command no Mac
    const isShift = Boolean(e.shiftKey);
    const isAlt = Boolean(e.altKey);

    // Teclas F (F12, F7, F8)
    if (key === 'f12' || code === 'f12') return true;
    if (key === 'f7' || code === 'f7') return true;
    if (key === 'f8' || code === 'f8') return true;

    // Ctrl+Shift+I (DevTools) / Cmd+Option+I
    if (isCtrl && (isShift || isAlt) && (key === 'i' || code === 'keyi')) return true;

    // Ctrl+Shift+J (Console) / Cmd+Option+J
    if (isCtrl && (isShift || isAlt) && (key === 'j' || code === 'keyj')) return true;

    // Ctrl+Shift+C (Inspecionar elemento) / Cmd+Option+C
    if (isCtrl && (isShift || isAlt) && (key === 'c' || code === 'keyc')) return true;

    // Ctrl+Shift+K (Console Firefox)
    if (isCtrl && isShift && (key === 'k' || code === 'keyk')) return true;

    // Ctrl+Shift+E (Network tab Firefox)
    if (isCtrl && isShift && (key === 'e' || code === 'keye')) return true;

    // Ctrl+U (Exibir Código Fonte / View Source) / Cmd+Option+U
    if (isCtrl && (key === 'u' || code === 'keyu')) return true;

    // Ctrl+S (Salvar página completa)
    if (isCtrl && (key === 's' || code === 'keys')) return true;

    // Ctrl+P (Imprimir)
    if (isCtrl && (key === 'p' || code === 'keyp')) return true;

    // Ctrl+Shift+M (Modo de inspeção responsiva)
    if (isCtrl && isShift && (key === 'm' || code === 'keym')) return true;

    return false;
  };

  const blockEvent = (e) => {
    if (isBlockedKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      try {
        document.documentElement.innerHTML = '';
        window.location.replace('about:blank');
      } catch {}
      return false;
    }
  };

  window.addEventListener('keydown', blockEvent, true);
  window.addEventListener('keyup', blockEvent, true);
  document.addEventListener('keydown', blockEvent, true);
  document.addEventListener('keyup', blockEvent, true);

  // 3. BLOQUEIO DE MENU DE CONTEXTO (Botão direito do mouse)
  window.addEventListener('contextmenu', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }, true);

  // 4. BLOQUEIO DE ARRASTE DE CONTEÚDO (evita arrastar imagens/scripts para inspecionar)
  window.addEventListener('dragstart', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // 5. ANTI-DEBUGGING (Trap para DevTools)
  // Quando o DevTools está fechado, o debugger passa em menos de 0.1ms sem impacto.
  // Se o invasor abrir o DevTools, ele pausa instantaneamente e congela a depuração.
  try {
    const antiDebug = () => {
      try {
        const start = performance.now();
        (function() {}['constructor']('debugger')());
        const end = performance.now();
        if (end - start > 100) {
          try { console.clear(); } catch {}
          try {
            document.documentElement.innerHTML = '';
            window.location.replace('about:blank');
          } catch {}
        }
      } catch {}
    };
    setInterval(antiDebug, 800);
  } catch {}

  // 6. DETECÇÃO DE ABERTURA DE JANELA DEVTOOLS
  const checkDevToolsSize = () => {
    if ((window.outerWidth - window.innerWidth > 160) || (window.outerHeight - window.innerHeight > 160)) {
      try { console.clear(); } catch {}
    }
  };
  window.addEventListener('resize', checkDevToolsSize, { passive: true });

  // 7. ESTILOS DE PROTEÇÃO VISUAL CONTRA CÓPIA
  try {
    const s = document.createElement('style');
    s.id = 'gs-sec-style';
    s.textContent = `
      body, img, a, button {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    const target = document.head || document.documentElement;
    if (target) target.appendChild(s);
  } catch {}

  // 8. BLOQUEIO DE CREDENCIAIS E CHECKOUTS NÃO INTEGRADOS
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
    if(href.includes('hancefy.com.br')||href.includes('safipaybr.com'))return;
    const label=((el.textContent||'')+' '+href).toLowerCase();
    if(label.includes('hancefy.com.br')||label.includes('safipaybr.com'))return;
    let external=false;try{external=/^https?:/i.test(href)&&new URL(href,location.href).origin!==location.origin}catch{}
    if(external||/checkout|compre agora|comprar agora|finalizar compra|pagar agora|garantir acesso|ir para pagamento|login|entrar com senha/.test(label)){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
})();
