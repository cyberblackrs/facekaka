/* GhostSpy V8.11 — Instagram-style DARK UI.
 * Correção visual do Feed, Direct, Chat e Notificações.
 * Não consulta APIs e não representa stories/notas/DMs sintéticas como dados reais.
 */
(() => {
  'use strict';
  const CLASS = 'gs-ig-dark', STYLE = 'gs-ig-dark-v811', POST_HEADER = 'gs-ig-post-header';
  const BG = '#0c1014', PANEL = '#0c1014', ELEVATED = '#262a2e', TEXT = '#f5f5f5', MUTED = '#a8a8a8';
  const JS_SHELL = 'gs-ig-shell';
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } };
  const safeName = s => /^[a-z0-9._]{1,30}$/.test(String(s || '').toLowerCase()) ? String(s).toLowerCase() : '';
  const isDarkRoute = () => /^\/(?:feed|direct|notifications|chat\/[1-5])(?:\/|$)/.test(location.pathname);
  const isFeed = () => /^\/feed(?:\/|$)/.test(location.pathname);
  const username = () => safeName(new URL(location.href).searchParams.get('username') || localStorage.getItem('espionado_username') || localStorage.getItem('username'));
  function profile() {
    const want = username(); if (!want) return null;
    const sources = [read('instagram_profile'), read('gs_last_rapidapi_profile'), read('gs_profile_cache_v88_' + want)?.data];
    for (const o of sources) {
      const p = o?.profile?.username ? o.profile : o?.user?.username ? o.user : o;
      if (String(p?.username || '').toLowerCase() !== want) continue;
      return {
        username: want, fullName: p.full_name || p.fullName || p.name || want,
        photo: p.profile_pic_url || p.profile_pic_original_url || '/images/avatars/perfil-sem-foto.jpeg'
      };
    }
    return { username: want, fullName: want, photo: '/images/avatars/perfil-sem-foto.jpeg' };
  }
  function make(tag, attrs = {}, txt) { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') el.className = v; else if (k === 'src') el.src = v; else el.setAttribute(k, v) } if (txt !== undefined) el.textContent = txt; return el }
  function installStyles() {
    if (document.getElementById(STYLE)) return;
    const st = document.createElement('style'); st.id = STYLE;
    st.textContent = `
   body.${CLASS}{--gs-ig-bg:${BG};--gs-ig-elevated:${ELEVATED};--gs-ig-text:${TEXT};--gs-ig-muted:${MUTED};color-scheme:dark;background:${BG}!important;color:${TEXT}!important;}
   body.${CLASS} #root,body.${CLASS} main,body.${CLASS} [data-testid="mobile-shell"]{background:${BG}!important;color:${TEXT}!important;}
   body.${CLASS} .${JS_SHELL},body.${CLASS} .gs-ig-dark-surface{background:${PANEL}!important;background-image:none!important;color:${TEXT}!important;}
   body.${CLASS} .gs-ig-dark-text{color:${TEXT}!important;-webkit-text-fill-color:${TEXT}!important;}
   body.${CLASS} .gs-ig-muted-text{color:${MUTED}!important;-webkit-text-fill-color:${MUTED}!important;}
   body.${CLASS} .bg-white,body.${CLASS} .bg-gray-50,body.${CLASS} .bg-slate-50,body.${CLASS} .bg-gray-100,body.${CLASS} .bg-slate-100,body.${CLASS} .bg-black,body.${CLASS} .bg-gray-900,body.${CLASS} .bg-slate-900,body.${CLASS} .bg-neutral-900,
   body.${CLASS} [class*="bg-\\[\\#f8"],body.${CLASS} [class*="bg-\\[\\#F8"],body.${CLASS} [class*="bg-\\[white"]{
     background:${PANEL}!important;background-image:none!important;
   }
   body.${CLASS} .text-black,body.${CLASS} .text-gray-900,body.${CLASS} .text-slate-900,body.${CLASS} .text-gray-800,body.${CLASS} .text-slate-800,
   body.${CLASS} .text-gray-700,body.${CLASS} .text-slate-700{color:${TEXT}!important;-webkit-text-fill-color:${TEXT}!important;}
   body.${CLASS} .text-gray-500,body.${CLASS} .text-slate-500,body.${CLASS} .text-gray-400,body.${CLASS} .text-slate-400,
   body.${CLASS} .text-gray-600{color:${MUTED}!important;-webkit-text-fill-color:${MUTED}!important;}
   body.${CLASS} .border-gray-100,body.${CLASS} .border-gray-200,body.${CLASS} .border-slate-200,
   body.${CLASS} [class*="border-gray"]{border-color:#23272a!important;}
   body.${CLASS} input,body.${CLASS} textarea{background:${ELEVATED}!important;color:${TEXT}!important;border-color:${ELEVATED}!important;}
   body.${CLASS} input::placeholder,body.${CLASS} textarea::placeholder{color:#a8a8a8!important;opacity:1;}
   body.${CLASS} h1,body.${CLASS} h2,body.${CLASS} h3{color:${TEXT}!important;}
   body.${CLASS} .gs-ig-header{display:flex!important;align-items:center!important;justify-content:space-between!important;background:${PANEL}!important;border:0!important;border-bottom:0!important;min-height:58px!important;color:${TEXT}!important;padding:0 13px!important;}
   body.${CLASS} .gs-ig-header svg{stroke:#f5f5f5!important;color:#f5f5f5!important;}
   body.${CLASS} .gs-ig-wordmark{font-family:'Segoe Script','Brush Script MT','Lobster Two',cursive;font-size:26px!important;line-height:1!important;font-weight:500!important;letter-spacing:-.05em;color:#fff!important;white-space:nowrap;}
   body.${CLASS} .gs-ig-top-icon{stroke:#f5f5f5!important;}
   body.${CLASS} .gs-ig-toolbar{background:${BG}!important;border-top:1px solid #24272a!important;color:${TEXT}!important;}
   body.${CLASS} .gs-ig-toolbar svg{color:${TEXT}!important;stroke:${TEXT}!important;}
   body.${CLASS} .gs-ig-story-tray{background:${BG}!important;display:flex!important;gap:13px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;padding:10px 10px 15px!important;width:100%;max-width:100%;height:142px;box-sizing:border-box;border:0!important;}
   body.${CLASS} .gs-ig-story-tray::-webkit-scrollbar{display:none;}
   body.${CLASS} .gs-ig-story{background:none!important;border:0!important;display:flex;flex:0 0 72px;flex-direction:column;align-items:center;gap:5px;width:72px;min-width:72px;box-shadow:none!important;padding:0!important;}
   body.${CLASS} .gs-ig-story-ring{position:relative;width:74px;height:74px;border-radius:50%;padding:3px;background:linear-gradient(38deg,#f9c74f 0%,#f77737 18%,#e1306c 55%,#c13584 74%,#833ab4 100%);box-sizing:border-box;}
   body.${CLASS} .gs-ig-story:first-child .gs-ig-story-ring{background:#383e43;}
   body.${CLASS} .gs-ig-story-ring--green{background:#32c759!important;}
  body.${CLASS} .gs-ig-story-ring img{width:100%!important;height:100%!important;object-fit:cover!important;border:3px solid ${BG}!important;border-radius:50%!important;display:block!important;box-sizing:border-box;}
  body.${CLASS} .gs-ig-story-demo-clip{width:100%;height:100%;box-sizing:border-box;border:3px solid ${BG};border-radius:50%;overflow:hidden;background:${BG};}
   body.${CLASS} .gs-ig-story-demo-clip img{border:0!important;border-radius:0!important;filter:blur(11px) saturate(1.15) brightness(.8)!important;opacity:.9!important;transform:scale(1.28)!important;}
   body.${CLASS} .gs-ig-story:not(:first-child) img{filter:blur(.8px)!important;}
   body.${CLASS} .gs-ig-story:first-child img{filter:none!important;opacity:1!important;}
   body.${CLASS} .gs-ig-story-demo-label,body.${CLASS} .fd-story-preview-label{display:none!important;margin:0!important;padding:0!important;height:0!important;}
   body.${CLASS} .fd-story-tray{padding:12px 12px 12px!important;}
   body.${CLASS} .gs-ig-story-label{color:#c5c7c9!important;white-space:nowrap;font-size:11px;font-weight:500;width:78px;overflow:hidden;text-overflow:ellipsis;text-align:center;}
   body.${CLASS} #gs-notas-borradas{background:${BG}!important;mask-image:none!important;-webkit-mask-image:none!important;border:0!important;}
   body.${CLASS} #gs-notas-borradas .gs-visual-note>span:first-child{background:#282b30!important;color:#fafafa!important;}
   body.${CLASS} #gs-notas-borradas p{color:#aaaeb2!important;}
   body.${CLASS} .gs-ig-post-card{background:${BG}!important;color:${TEXT}!important;}
   body.${CLASS} .${POST_HEADER}{background:${BG}!important;color:${TEXT}!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:54px!important;padding:6px 12px!important;box-sizing:border-box!important;width:100%;border:0!important;}
   body.${CLASS} .gs-ig-post-author{display:flex;align-items:center;gap:10px;min-width:0;flex:1;}
   body.${CLASS} .gs-ig-post-avatar-ring{width:37px;height:37px;border-radius:50%;background:linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf);padding:2px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:0 0 37px;}
   body.${CLASS} .gs-ig-post-avatar{width:33px!important;height:33px!important;border-radius:50%!important;object-fit:cover!important;display:block!important;border:2px solid #0c1014!important;flex:0 0 33px;}
   body.${CLASS} .gs-ig-post-avatar-initial{width:33px;height:33px;border-radius:50%;background:#2a2d30;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;}
   body.${CLASS} .gs-ig-post-username{color:${TEXT}!important;font-size:13px!important;font-weight:650!important;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
   body.${CLASS} .gs-ig-post-menu{font-size:22px;color:#f5f5f5!important;line-height:1;letter-spacing:2px;flex:none;margin-left:9px;}
   body.${CLASS} .gs-ig-post-old-user{display:none!important;}
   body.${CLASS} .gs-ig-chat-muted{color:${MUTED}!important;}
   body.${CLASS} .gs-ig-search-input{background:${ELEVATED}!important;color:#f5f5f5!important;border:0!important;}
   body.${CLASS} div:has(> input[placeholder*="Meta AI"]) {display:flex!important;align-items:center!important;position:relative!important;}
   body.${CLASS} div:has(> input[placeholder*="Meta AI"]) > div:first-child {top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;justify-content:center!important;}
   body.${CLASS} div:has(> input[placeholder*="Meta AI"]) > input {padding-top:8.5px!important;padding-bottom:13.5px!important;}
   body.${CLASS} .gs-ig-message-row{background:${BG}!important;border-color:#22262a!important;}
   body.${CLASS} .gs-ig-message-row p,body.${CLASS} .gs-ig-message-row span{color:#ebebeb;}
   @media (max-width:430px){body.${CLASS} .gs-ig-story-tray{gap:11px!important;}body.${CLASS} .gs-ig-story{flex-basis:68px;min-width:68px;}body.${CLASS} .gs-ig-story-ring{width:70px;height:70px;}}
   `;
    document.head.appendChild(st);
  }
  function isMarketing(el) { return !!el.closest('.ghost-home-scope,.cta-page,.modal-overlay,[class*="cta-timer"],[class*="cta-banner"],[class*="vip"],[id*="vip"],[data-gs-dark-ignore]') }
  function lightBackground(rgb) { const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/); if (!m) return false; const [r, g, b] = m.slice(1, 4).map(Number); const alpha = m[4] === undefined ? 1 : Number(m[4]); return alpha > .7 && (r > 190 && g > 190 && b > 190 || (r <= 14 && g <= 15 && b <= 18)); }
  function applyDarkSurface() {
    if (!document.body) return;
    document.body.classList.toggle(CLASS, isDarkRoute());
    if (!isDarkRoute()) return;
    const candidates = document.querySelectorAll('body,body div,body section,body article,body header,body nav,body footer,body aside,body main,body button,body a');
    for (const el of candidates) {
      if (isMarketing(el) || el.closest('#gs-ig-story-tray') || el.closest('#gs-notas-borradas')) continue;
      if (el.classList.contains('gs-ig-dark-surface')) continue;
      const st = getComputedStyle(el);
      if (lightBackground(st.backgroundColor)) el.classList.add('gs-ig-dark-surface');
    }
    const textNodes = document.querySelectorAll('h1,h2,h3,h4,p,span,label,small,strong,b,a,button');
    for (const el of textNodes) {
      if (isMarketing(el) || el.closest('#gs-ig-story-tray') || el.closest('#gs-notas-borradas')) continue;
      if (el.classList.contains('gs-ig-dark-text') || el.classList.contains('gs-ig-muted-text')) continue;
      const style = getComputedStyle(el); const m = style.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) continue;
      const [r, g, b] = m.slice(1).map(Number);
      if (r < 96 && g < 96 && b < 96) el.classList.add('gs-ig-dark-text');
    }
  }
  // Logo e ícones do cabeçalho do Feed — troca apenas o logotipo quebrado.
  function fixFeedHeader() {
    if (!isFeed()) return;
    for (const img of document.querySelectorAll('img[alt]')) {
      if (!/instagram/i.test(img.alt)) continue;
      if (img.closest('.gs-ig-story-tray,.gs-ig-post-header')) continue;
      const host = img.closest('header') || img.parentElement?.parentElement;
      if (!host || host.classList.contains('gs-ig-post-header')) continue;
      const text = host.textContent || '';
      if (text.length > 100) continue;
      host.classList.add('gs-ig-header');
      if (!host.querySelector('.gs-ig-wordmark')) {
        const word = make('span', { class: 'gs-ig-wordmark', 'aria-label': 'Instagram' }, 'Instagram');
        img.replaceWith(word);
      }
      for (const svg of host.querySelectorAll('svg')) svg.classList.add('gs-ig-top-icon');
      return;
    }
    // Se o texto já existe em vez da imagem, aplica somente o fundo.
    for (const el of document.querySelectorAll('header')) {
      const str = (el.textContent || '').trim();
      if (str.includes('Instagram') && str.length < 90) { el.classList.add('gs-ig-header'); return; }
    }
  }
  // O original pode desenhar cadeados ou placeholders; usamos retratos locais SOMENTE ilustrativos.
  const storyData = [
    ['Perfil consultado', 'own'],
    ['a*******', 'story-01.jpg'],
    ['b*******', 'story-02.jpg'],
    ['c*******', 'story-03.jpg'],
    ['d*******', 'story-04.jpg'],
    ['e*******', 'story-05.jpg'],
    ['f*******', 'story-06.jpg'],
    ['g*******', 'story-07.jpg'],
    ['h*******', 'story-08.jpg'],
    ['i*******', 'story-09.jpg'],
    ['j*******', 'story-10.jpg'],
    ['k*******', 'story-11.jpg'],
    ['l*******', 'story-12.jpg'],
    ['m*******', 'story-13.jpg'],
    ['n*******', 'story-14.jpg']
  ];
  function storyContainer() {
    const leafs = [...document.querySelectorAll('span,p,div')].filter(el => el.children.length === 0 && /^(Seu story|Your story|Seu stories|Sua história|Perfil consultado)$/i.test((el.textContent || '').trim()));
    for (const leaf of leafs) {
      let at = leaf.parentElement;
      for (let i = 0; at && i < 6; i++, at = at.parentElement) {
        if (at.id === 'gs-ig-story-tray' || at.closest('.gs-ig-post-header')) break;
        const imgs = at.querySelectorAll('img');
        const masked = (at.textContent || '').match(/[a-z]\*{3,}/gi) || [];
        if (imgs.length >= 1 && masked.length >= 2 && at.children.length >= 3) {
          const rect = at.getBoundingClientRect();
          if (rect.height < 230 && rect.width >= 170) return at;
        }
      }
    }
    return null;
  }
  function updateStoryOwnPhoto(strip) {
    const label = strip?.querySelector('.gs-ig-story:first-child .gs-ig-story-label');
    const user = profile()?.username;

    if (label && user && label.textContent !== user) {
      label.textContent = user;
    }
  }
  function patchFeedStories() {
    if (!isFeed()) return;
    let strip = document.getElementById('gs-ig-story-tray'); const old = storyContainer();
    if (!old) { updateStoryOwnPhoto(strip); return; }
    if (!strip) {
      strip = make('div', { id: 'gs-ig-story-tray', class: 'gs-ig-story-tray', 'aria-label': 'Stories ilustrativos' });
      for (const [index, [name, source]] of storyData.entries()) {
        const item = make('div', { class: 'gs-ig-story' }), ring = make('div', { class: 'gs-ig-story-ring' + ([2, 5, 8, 11, 14].includes(index) ? ' gs-ig-story-ring--green' : '') });
        const photo = source === 'own' ? (profile()?.photo || '/images/avatars/perfil-sem-foto.jpeg') : `/assets-local/stories/${source}`;
        const img = make('img', { src: photo, alt: source === 'own' ? 'Foto de perfil consultado' : 'Retrato ilustrativo' });
        img.onerror = () => { img.onerror = null; img.src = source === 'own' ? '/images/avatars/perfil-sem-foto.jpeg' : '/assets-local/stories/story-16.jpg' };
        if (source === 'own') { ring.append(img); } else { const clip = make('div', { class: 'gs-ig-story-demo-clip' }); clip.append(img); ring.append(clip); } item.append(ring, make('span', { class: 'gs-ig-story-label' }, name)); strip.append(item);
      }
    }
    let demoLabel = document.getElementById('gs-ig-story-demo-label');
    if (!demoLabel) demoLabel = make('p', { id: 'gs-ig-story-demo-label', class: 'gs-ig-story-demo-label' }, 'Demo — retratos fictícios, não são Stories reais');
    if (demoLabel.parentElement !== old.parentElement || demoLabel.nextSibling !== old) old.parentElement.insertBefore(demoLabel, old);
    if (strip.parentElement !== old.parentElement || strip.nextSibling !== demoLabel) old.parentElement.insertBefore(strip, demoLabel);
    old.classList.add('gs-ig-original-stories-hidden'); old.style.setProperty('display', 'none', 'important');
    updateStoryOwnPhoto(strip);
  }
  function isMediaImage(img) {
    if (img.closest('#gs-ig-story-tray,#gs-notas-borradas,.gs-ig-header,.gs-ig-post-header')) return false;
    const r = img.getBoundingClientRect();
    // NUNCA usar img.width/naturalWidth: imagens em Stories ocultos têm rect 0.
    const w = r.width, h = r.height;
    return w >= 180 && h >= 180 && h >= w * .45;
  }
  function profileImage(media) {
    if (media?.startsWith('/assets-local/notes/')) return false;
    return true;
  }
  function nearestMediaAfter(label) {
    const r = label.getBoundingClientRect();
    for (const img of document.querySelectorAll('img')) {
      if (!isMediaImage(img)) continue;
      const ir = img.getBoundingClientRect();
      if (ir.top >= r.top - 10 && ir.top - r.top < 200 && Math.abs(ir.left - r.left) < 160) return img;
    }
    return null;
  }
  function chooseHeader(label, media) {
    const target = media.getBoundingClientRect();
    let node = label.parentElement;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      const nr = node.getBoundingClientRect();
      if (node.contains(media)) break;
      if (nr.width >= Math.min(target.width * .75, 190) && nr.height >= 22 && nr.height <= 105 && nr.top < target.top && target.top - nr.bottom < 90) return node;
    }
    return label.parentElement || null;
  }
  function avatarValid(photo) { return typeof photo === 'string' && photo && !photo.includes('perfil-sem-foto') }
  function ensurePostHeader(header, p) {
    if (!header || !p) return;
    header.classList.add(POST_HEADER);
    let author = header.querySelector('.gs-ig-post-author');
    if (!author) {
      author = make('div', { class: 'gs-ig-post-author' });
      const image = make('img', { class: 'gs-ig-post-avatar', src: p.photo, alt: 'Foto de perfil de @' + p.username });
      const ring = make('span', { class: 'gs-ig-post-avatar-ring' });
      image.onerror = () => {
        image.onerror = null; image.style.display = 'none';
        if (!author.querySelector('.gs-ig-post-avatar-initial')) ring.append(make('span', { class: 'gs-ig-post-avatar-initial' }, p.username[0]?.toUpperCase() || '?'));
      };
      ring.append(image); author.append(ring, make('span', { class: 'gs-ig-post-username' }, p.username));
      header.insertBefore(author, header.firstChild);
      if (!header.querySelector('.gs-ig-post-menu')) header.append(make('span', { class: 'gs-ig-post-menu', 'aria-hidden': 'true' }, '···'));
    } else {
      const text = author.querySelector('.gs-ig-post-username'); if (text && text.textContent !== p.username) text.textContent = p.username;
      const image = author.querySelector('img.gs-ig-post-avatar'); if (image && image.getAttribute('src') !== p.photo) { image.style.display = ''; image.src = p.photo; }
    }
    for (const el of [...header.querySelectorAll('span,p,strong,div,a')]) {
      if (el.closest('.gs-ig-post-author') || el.classList.contains('gs-ig-post-menu')) continue;
      if (el.childElementCount) continue;
      const t = (el.textContent || '').trim();
      if (t === p.username || /^(?:usu\*+|user\*+)$/i.test(t)) el.classList.add('gs-ig-post-old-user');
    }
  }
  function fixPosts() {
    if (!isFeed()) return;
    const p = profile(); if (!p) return;
    // Preserva e atualiza as cabecalhos que ja possuem o avatar.
    const existing = [...document.querySelectorAll('.' + POST_HEADER)];
    for (const header of existing) ensurePostHeader(header, p);
    // Um header provisório não pode coexistir com o header verdadeiro do mesmo post.
    const native = existing.filter(header => !header.hasAttribute('data-gs-inserted'));
    for (const placeholder of existing.filter(header => header.hasAttribute('data-gs-inserted'))) {
      if (native.some(real => {
        const sameParent = real.parentElement === placeholder.parentElement;
        const sameCard = real.closest('article,section') && real.closest('article,section') === placeholder.closest('article,section');
        const rr = real.getBoundingClientRect(), pr = placeholder.getBoundingClientRect();
        return sameParent || sameCard || (Math.abs(rr.left - pr.left) < 120 && Math.abs(rr.top - pr.top) < 190);
      })) placeholder.remove();
    }
    // Preferir o header original da publicacao, sem construir uma faixa duplicada.
    const possibleLabels = [...document.querySelectorAll('span,p,strong,b,h2,h3,div')].filter(el => el.childElementCount === 0 &&
      ((el.textContent || '').trim().toLowerCase() === p.username ||
        /^(?:usu\*+|user\*+)$/i.test((el.textContent || '').trim())));
    for (const label of possibleLabels) {
      if (label.closest('#gs-ig-story-tray,#gs-notas-borradas,.gs-ig-header,.gs-ig-post-header')) continue;
      const media = nearestMediaAfter(label); if (!media) continue;
      const header = chooseHeader(label, media); if (!header) continue;
      ensurePostHeader(header, p);
      // Se houver uma faixa sintetica imediatamente antes da imagem, remove-a.
      for (const prior of [...document.querySelectorAll('[data-gs-inserted="true"]')]) {
        if (prior === header) continue;
        const nr = prior.getBoundingClientRect(), mr = media.getBoundingClientRect();
        if (Math.abs(nr.left - mr.left) < 80 && Math.abs(nr.bottom - mr.top) < 110) prior.remove();
      }
    }
    // Fallback restrito a publicacoes sem cabecalho reconhecido.
    const mediaItems = [...document.querySelectorAll('img')].filter(img => isMediaImage(img) && profileImage(img.getAttribute('src')));
    for (const media of mediaItems) {
      const mr = media.getBoundingClientRect();
      const hasHeader = [...document.querySelectorAll('.' + POST_HEADER)].some(header => {
        const hr = header.getBoundingClientRect();
        const sameCard = header.closest('article,section') && header.closest('article,section') === media.closest('article,section');
        const sameParent = header.parentElement === media.parentElement;
        return sameCard || sameParent || (Math.abs(hr.left - mr.left) < 100 && hr.top <= mr.top && mr.top - hr.bottom >= -5 && mr.top - hr.bottom <= 110);
      });
      if (hasHeader) continue;
      const parent = media.parentElement; if (!parent) continue;
      if (media.previousElementSibling?.classList.contains(POST_HEADER)) continue;
      const header = make('div', { class: POST_HEADER, 'data-gs-inserted': 'true' });
      ensurePostHeader(header, p);
      parent.insertBefore(header, media);
    }
  }
  function fixSearchAndChat() {
    if (!isDarkRoute()) return;
    for (const input of document.querySelectorAll('input')) {
      if (/pesquisar/i.test(input.placeholder || '')) {
        input.classList.add('gs-ig-search-input');
        const par = input.parentElement;
        if (par && lightBackground(getComputedStyle(par).backgroundColor)) par.classList.add('gs-ig-dark-surface');
      }
    }
    for (const nav of document.querySelectorAll('nav,footer')) {
      const rect = nav.getBoundingClientRect();
      if (rect.height < 140 && rect.width > 200) nav.classList.add('gs-ig-toolbar');
    }
  }
  let raf = 0;
  function render() { if (!document.body) return; installStyles(); applyDarkSurface(); if (!isDarkRoute()) return; fixFeedHeader(); patchFeedStories(); fixPosts(); fixSearchAndChat(); }
  function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render() }); }
  function start() { const observer = new MutationObserver(records => { if (records.some(r => r.addedNodes.length || r.removedNodes.length)) schedule() }); observer.observe(document.body, { childList: true, subtree: true }); schedule(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  for (const action of ['pushState', 'replaceState']) { const native = history[action]; history[action] = function (...args) { const v = native.apply(this, args); schedule(); return v; }; }
  window.addEventListener('popstate', schedule); window.addEventListener('storage', schedule); window.addEventListener('focus', schedule); window.addEventListener('gs:public-data', schedule);
  window.gsRefreshInstagramTheme = schedule;
})();
