import { call } from "../shared/rpc.js";
import { bindSelects } from "../shared/combo.js";
import { initTips } from "../shared/tips.js";
import { applyI18n, setLocale } from "../shared/i18n.js";
import { applyTheme, watchTheme } from "../shared/theme.js";

const bypass = document.getElementById("bypass");
const geo = document.getElementById("geo");
const customWrap = document.getElementById("custom-wrap");
const customUrl = document.getElementById("custom-url");
const webrtc = document.getElementById("webrtc");
const msg = document.getElementById("msg");
let uiTheme = "auto";

geo.addEventListener("change", () => {
  customWrap.hidden = geo.value !== "custom";
});

document.getElementById("save").addEventListener("click", save);
document.getElementById("restore").addEventListener("click", async () => {
  await call("RESTORE_PROXY");
  flash("已尝试恢复接管前的代理设置");
});
initTips(document);
const picks = bindSelects(document);
watchTheme(() => uiTheme);

load();

async function load() {
  const state = await call("GET_STATE");
  setLocale(state.settings?.uiLocale);
  uiTheme = state.settings?.uiTheme || "auto";
  applyTheme(uiTheme);
  applyI18n(document);
  bypass.value = (state.settings.bypass || []).join("\n");
  geo.value = state.settings.geoChannel || "ipinfo";
  customUrl.value = state.settings.customGeoUrl || "";
  customWrap.hidden = geo.value !== "custom";
  webrtc.checked = Boolean(state.settings.restrictWebRTC);
  picks.forEach((p) => p.sync());
}

async function save() {
  const lines = bypass.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  await call("SAVE_SETTINGS", {
    settings: {
      bypass: lines,
      geoChannel: geo.value,
      customGeoUrl: customUrl.value.trim(),
      restrictWebRTC: webrtc.checked,
    },
  });
  flash("已保存");
}

function flash(text) {
  msg.textContent = text;
  setTimeout(() => {
    if (msg.textContent === text) msg.textContent = "";
  }, 2500);
}
