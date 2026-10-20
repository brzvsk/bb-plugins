const STYLE_ID = "bb-browser-no-drag";

// A late cascade layer with !important beats every normal page rule and every
// unlayered !important rule, regardless of selector specificity.
const CSS =
  "@layer bb-browser-no-drag { *, *::before, *::after { " +
  "-webkit-app-region: no-drag !important; app-region: no-drag !important; } }";

export const installScript = `(() => {
  const existing = document.getElementById(${JSON.stringify(STYLE_ID)});
  if (existing && existing.isConnected) return false;
  const style = document.createElement("style");
  style.id = ${JSON.stringify(STYLE_ID)};
  style.textContent = ${JSON.stringify(CSS)};
  (document.head || document.documentElement).appendChild(style);
  return true;
})()`;

export const cleanupScript = `(document.getElementById(${JSON.stringify(STYLE_ID)})?.remove(), true)`;
