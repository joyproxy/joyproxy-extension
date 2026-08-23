let pref = "auto";
let watching = false;
let applied = "";
let applying = false;

export const UI_THEME_OPTIONS = [
  { id: "auto", key: "sys.theme.auto" },
  { id: "light", key: "sys.theme.light" },
  { id: "dark", key: "sys.theme.dark" },
];

export function browserTheme() {
  try {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    /* ignore */
  }
  return "dark";
}

export function resolveTheme(setting) {
  if (setting === "light" || setting === "dark") return setting;
  return browserTheme();
}

export function applyTheme(setting) {
  pref = setting || "auto";
  const theme = resolveTheme(pref);
  const root = document.documentElement;
  if (applied === theme && root.dataset.theme === theme) return theme;
  applied = theme;
  applying = true;
  try {
    root.dataset.theme = theme;
    // Do not set style.colorScheme: it can synchronously retrigger
    // prefers-color-scheme and freeze the whole page.
  } finally {
    applying = false;
  }
  return theme;
}

export function watchTheme(getPref) {
  if (watching) return;
  watching = true;
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (applying) return;
      const current = getPref?.() || pref;
      if (current === "auto") applyTheme("auto");
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
  } catch {
    /* ignore */
  }
}
