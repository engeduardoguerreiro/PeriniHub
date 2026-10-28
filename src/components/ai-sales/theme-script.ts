// Constantes do tema fora do módulo "use client": o layout (Server Component)
// precisa do script como texto, não como referência de cliente.

export const THEME_STORAGE_KEY = "ai-sales-theme";
export const THEME_ROOT_ID = "ai-sales-root";

/** Aplica o tema salvo antes da primeira pintura (sem "piscar"). */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.getElementById("${THEME_ROOT_ID}");if(r){r.classList.toggle("dark",d)}}catch(e){}})();`;
