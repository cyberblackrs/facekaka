import { a as p, p as e } from "./chunk-EPOLDU6W-CkoexLYk.js";
import { u as i } from "./context-DVPZRWQf.js";

function d({ isOpen: a, action: n, onClose: o, onGoToCTA: l }) {
  const { t: r } = i();
  const [secs, setSecs] = p.useState(179);

  p.useEffect(() => {
    if (!a) return;
    const key = "gs_session_expire_ts";
    let end = 0;
    try {
      end = parseInt(sessionStorage.getItem(key) || "0", 10);
      if (!end || end < Date.now()) {
        end = Date.now() + 179 * 1000;
        sessionStorage.setItem(key, String(end));
      }
    } catch {
      end = Date.now() + 179 * 1000;
    }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((end - Date.now()) / 1000));
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
        className: "fixed inset-0 z-[9999] bg-black/75 backdrop-blur-[6px]",
        onClick: o,
      }),
      e.jsxs("div", {
        className:
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] flex flex-col items-center justify-center max-w-[330px] w-[calc(100%-36px)] text-center rounded-[16px] animate-popup-fade-in overflow-hidden",
        style: {
          background: "#262626",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.65)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
        children: [
          e.jsxs("div", {
            style: { padding: "22px 20px 18px", width: "100%" },
            children: [
              e.jsx("div", {
                style: {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: "11px",
                  fontWeight: 700,
                  marginBottom: "12px",
                  letterSpacing: "0.2px",
                },
                children: `● SESSÃO EXPIRA EM ${mm}:${ss}`,
              }),
              e.jsx("h3", {
                style: {
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#f5f5f5",
                  margin: "0 0 8px",
                  letterSpacing: "-0.2px",
                },
                children: "Acesso temporário prestes a encerrar",
              }),
              e.jsxs("p", {
                style: {
                  fontSize: "13px",
                  color: "#a8a8a8",
                  margin: "0 0 12px",
                  lineHeight: 1.45,
                },
                children: [
                  "Para ",
                  e.jsx("strong", { style: { color: "#f5f5f5" }, children: c }),
                  " em ",
                  e.jsx("strong", { style: { color: "#f5f5f5" }, children: `@${target}` }),
                  ", finalize o desbloqueio antes que a conexão seja fechada.",
                ],
              }),
              e.jsx("p", {
                style: {
                  fontSize: "11.5px",
                  color: "#8e8e8e",
                  margin: 0,
                  lineHeight: 1.4,
                  background: "rgba(255,255,255,0.04)",
                  padding: "8px 10px",
                  borderRadius: "8px",
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
              padding: "13px 16px",
              background: "#0095f6",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#ffffff",
              fontSize: "14px",
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
              padding: "11px 16px",
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#8e8e8e",
              fontSize: "13px",
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
