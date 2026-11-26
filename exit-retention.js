/* GhostSpy — Retenção autorizada na tentativa de saída (sem travar navegação). */
(() => {
  'use strict';
  const ROUTES = /^\/(?:feed|direct|chat\/(?:[1-9]|1[0-8])|cta)(?:\/|$)/;
  const TIMER_KEY = 'shared_timer_start';
  const DURATION_MS = 600 * 1000;
  const SHOWN_KEY = 'gs_exit_retention_shown';

  function isUnlocked() {
    try { return localStorage.getItem('gs_msg_unlocked') === '1'; } catch { return false; }
  }
  function isEligibleRoute() {
    return ROUTES.test(location.pathname);
  }
  function getProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem('instagram_profile') || 'null');
      const u = raw?.username || localStorage.getItem('espionado_username') || localStorage.getItem('username') || 'perfil';
      const pic = raw?.profile_pic_url || raw?.profile_pic_original_url || '/images/avatars/perfil-sem-foto.jpeg';
      return { username: String(u).replace(/^@+/, ''), photo: pic };
    } catch {
      return { username: 'perfil', photo: '/images/avatars/perfil-sem-foto.jpeg' };
    }
  }
  function getRemainingText() {
    try {
      let start = parseInt(localStorage.getItem(TIMER_KEY) || '', 10);
      if (!start) {
        start = Date.now();
        localStorage.setItem(TIMER_KEY, String(start));
      }
      const rem = Math.max(0, DURATION_MS - (Date.now() - start));
      const sec = Math.floor(rem / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      return `${mm}:${ss}`;
    } catch {
      return '08:42';
    }
  }

  let modalEl = null;
  let timerId = null;

  function closeModal() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function showModal() {
    if (modalEl || isUnlocked() || !isEligibleRoute()) return;
    try {
      if (sessionStorage.getItem(SHOWN_KEY) === '1') return;
      sessionStorage.setItem(SHOWN_KEY, '1');
    } catch {}

    const { username, photo } = getProfile();
    modalEl = document.createElement('div');
    modalEl.id = 'gs-exit-retention-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(5,7,10,0.86);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'width:100%;max-width:400px;background:#11161d;border:1px solid rgba(239,68,68,0.45);border-radius:18px;padding:20px;color:#f5f5f5;box-shadow:0 24px 60px rgba(0,0,0,0.65);position:relative;';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid #ef4444;flex-shrink:0;background:#1f2937;">
          <img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover;filter:blur(9px);transform:scale(1.22);pointer-events:none;" onerror="this.src='/images/avatars/perfil-sem-foto.jpeg'">
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#f87171;">Sessão prestes a expirar</div>
          <div style="font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">@${username}</div>
        </div>
        <div id="gs-exit-timer" style="background:rgba(239,68,68,0.16);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-weight:800;font-size:14px;padding:5px 10px;border-radius:10px;font-variant-numeric:tabular-nums;">${getRemainingText()}</div>
      </div>
      <p style="font-size:13.5px;line-height:1.45;color:#d1d5db;margin:0 0 14px;">
        Os dados carregados para <strong style="color:#fff;">@${username}</strong> serão descartados desta sessão quando o tempo encerrar.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        <div style="background:#1a2029;border:1px solid #28303d;border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:12.5px;font-weight:600;color:#fff;">Conversa #1 • Mídia de visualização única</div>
            <div style="font-size:11.5px;color:#9ca3af;">14 mensagens ocultas + Reel encaminhado</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#fbbf24;white-space:nowrap;">Pronto</span>
        </div>
        <div style="background:#1a2029;border:1px solid #28303d;border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:12.5px;font-weight:600;color:#fff;">18 conversas &amp; 14 áudios detectados</div>
            <div style="font-size:11.5px;color:#9ca3af;">Transcrições e histórico completo liberáveis</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:#fbbf24;white-space:nowrap;">Pronto</span>
        </div>
      </div>
      <button id="gs-exit-cta" type="button" style="width:100%;padding:13px 16px;border-radius:12px;border:none;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;font-size:14.5px;font-weight:700;cursor:pointer;margin-bottom:8px;">
        Liberar acesso completo agora
      </button>
      <button id="gs-exit-close" type="button" style="width:100%;padding:9px 12px;border-radius:10px;border:1px solid #2b3340;background:transparent;color:#9ca3af;font-size:12.5px;font-weight:500;cursor:pointer;">
        Fechar e continuar na prévia
      </button>
    `;

    modalEl.appendChild(card);
    document.body.appendChild(modalEl);

    const timerNode = card.querySelector('#gs-exit-timer');
    timerId = setInterval(() => {
      if (timerNode) timerNode.textContent = getRemainingText();
    }, 1000);

    card.querySelector('#gs-exit-cta')?.addEventListener('click', () => {
      closeModal();
      const qs = location.search || '';
      if (/^\/cta(?:\/|$)/.test(location.pathname)) {
        const btn = document.querySelector('.cta-buy-button, [data-cta-buy], a[href*="safipay"]');
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        location.href = `/cta${qs}`;
      }
    });
    card.querySelector('#gs-exit-close')?.addEventListener('click', closeModal);
    modalEl.addEventListener('click', (ev) => {
      if (ev.target === modalEl) closeModal();
    });
  }

  const enteredAt = Date.now();
  document.addEventListener('mouseleave', (ev) => {
    if (ev.clientY <= 4 && Date.now() - enteredAt > 6000) showModal();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - enteredAt > 12000) {
      showModal();
    }
  });
})();
