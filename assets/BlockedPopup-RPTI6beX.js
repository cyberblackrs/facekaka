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

  const handleGoCTA = (ev) => {
    if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
    if (typeof l === "function") {
      l();
    } else if (typeof window < "u") {
      window.location.href = `/cta${window.location.search || ""}`;
    }
  };

  return e.jsxs("div", {
    onClick: o,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 2147483000,
      background: "rgba(0, 0, 0, 0.45)",
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    },
    children: e.jsxs("div", {
      role: "dialog",
      "aria-modal": "true",
      className: "animate-popup-fade-in",
      onClick: (ev) => ev.stopPropagation(),
      style: {
        position: "relative",
        zIndex: 2147483001,
        width: "100%",
        maxWidth: "390px",
        background: "#262626",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        borderRadius: "16px",
        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.55)",
        overflow: "hidden",
        textAlign: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
      children: [
          e.jsxs("div", {
            style: { padding: "18px 20px 15px" },
            children: [
              e.jsx("div", {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "999px",
                  background: "rgba(239, 68, 68, 0.16)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  marginBottom: "10px",
                },
                children: `● SESSÃO EXPIRA EM ${mm}:${ss}`,
              }),
              e.jsx("h3", {
                style: {
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#f5f5f5",
                  margin: "0 0 6px",
                  letterSpacing: "-0.2px",
                },
                children: "Desbloqueie para continuar",
              }),
              e.jsxs("p", {
                style: {
                  fontSize: "13.5px",
                  color: "#c7c7c7",
                  margin: "0 0 10px",
                  lineHeight: 1.4,
                },
                children: [
                  "Para ",
                  e.jsx("strong", { style: { color: "#ffffff" }, children: c }),
                  " em ",
                  e.jsx("strong", { style: { color: "#ffffff" }, children: `@${target}` }),
                  ", conclua o acesso antes que os dados sejam descartados.",
                ],
              }),
              e.jsx("div", {
                style: {
                  fontSize: "12px",
                  color: "#a8a8a8",
                  lineHeight: 1.35,
                  background: "rgba(255,255,255,0.05)",
                  padding: "8px 10px",
                  borderRadius: "8px",
                },
                children:
                  "Ao sair sem finalizar, este dispositivo perde o acesso à consulta.",
              }),
            ],
          }),
          e.jsx("button", {
            type: "button",
            onClick: handleGoCTA,
            style: {
              display: "block",
              width: "100%",
              padding: "13px 16px",
              background: "#0095f6",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              fontSize: "14.5px",
              fontWeight: 700,
              cursor: "pointer",
            },
            children: "Desbloquear relatório completo",
          }),
          e.jsx("button", {
            type: "button",
            onClick: o,
            style: {
              display: "block",
              width: "100%",
              padding: "11px 16px",
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#a8a8a8",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            },
            children: "Continuar na prévia",
          }),
        ],
      }),
  });
}

export { d as B };
