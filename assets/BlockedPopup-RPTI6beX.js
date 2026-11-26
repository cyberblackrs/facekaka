import { a as p, p as e } from "./chunk-EPOLDU6W-CkoexLYk.js";
import { u as i } from "./context-DVPZRWQf.js";

const TOTAL_PREVIEW_MS = 600 * 1000;

function d({ isOpen: a, action: n, onClose: o, onGoToCTA: l }) {
  const { t: r } = i();
  const [secs, setSecs] = p.useState(600);

  p.useEffect(() => {
    if (!a) return;
    let start = 0;
    try {
      const raw =
        localStorage.getItem("shared_timer_start") ||
        localStorage.getItem("previewStartTime");
      start = raw ? parseInt(raw, 10) : 0;
      if (!start || Number.isNaN(start)) {
        start = Date.now();
        localStorage.setItem("shared_timer_start", String(start));
        localStorage.setItem("previewStartTime", String(start));
      }
    } catch {
      start = Date.now();
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((start + TOTAL_PREVIEW_MS - Date.now()) / 1000));
      setSecs(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [a]);

  if (!a) return null;

  const c = r?.blockedPopup?.actionTexts?.[n] || n || "a este conteúdo";
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const target =
    typeof localStorage < "u"
      ? localStorage.getItem("espionado_username") || localStorage.getItem("username") || "perfil"
      : "perfil";

  return e.jsxs(e.Fragment, {
    children: [
      e.jsx("div", {
        className: "fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px]",
        onClick: o,
      }),
      e.jsxs("div", {
        className:
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] flex flex-col items-center justify-center max-w-[360px] w-[calc(100%-32px)] text-center rounded-[18px] animate-popup-fade-in overflow-hidden",
        style: {
          background: "#262626",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
        children: [
          e.jsxs("div", {
            style: { padding: "24px 22px 20px", width: "100%" },
            children: [
              e.jsx("div", {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  background: "rgba(239, 68, 68, 0.16)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  fontSize: "13px",
                  fontWeight: 700,
                  marginBottom: "14px",
                  letterSpacing: "0.2px",
                },
                children: `● SESSÃO EXPIRA EM ${mm}:${ss}`,
              }),
              e.jsx("h3", {
                style: {
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#f5f5f5",
                  margin: "0 0 10px",
                  letterSpacing: "-0.2px",
                },
                children: "Acesso temporário prestes a encerrar",
              }),
              e.jsxs("p", {
                style: {
                  fontSize: "14px",
                  color: "#c7c7c7",
                  margin: "0 0 14px",
                  lineHeight: 1.45,
                },
                children: [
                  "Para ",
                  e.jsx("strong", { style: { color: "#ffffff" }, children: c }),
                  " em ",
                  e.jsx("strong", { style: { color: "#ffffff" }, children: `@${target}` }),
                  ", finalize o desbloqueio antes que o tempo acabe.",
                ],
              }),
              e.jsx("p", {
                style: {
                  fontSize: "12.5px",
                  color: "#a8a8a8",
                  margin: 0,
                  lineHeight: 1.45,
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px 12px",
                  borderRadius: "10px",
                },
                children:
                  "Se sair sem concluir, os dados coletados serão descartados e este dispositivo será bloqueado para novas consultas deste perfil.",
              }),
            ],
          }),
          e.jsx("button", {
            type: "button",
            onClick: l,
            style: {
              width: "100%",
              padding: "14px 16px",
              background: "#0095f6",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            },
            children: "Desbloquear relatório completo",
          }),
          e.jsx("button", {
            type: "button",
            onClick: o,
            style: {
              width: "100%",
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#a8a8a8",
              fontSize: "13.5px",
              fontWeight: 500,
              cursor: "pointer",
            },
            children: "Continuar na prévia",
          }),
        ],
      }),
    ],
  });
}

export { d as B };
