import { shortProxy } from "../shared/parse.js";
import { bindComposer } from "../shared/compose.js";
import { bindCombo, bindSelects } from "../shared/combo.js";
import { initTips } from "../shared/tips.js";
import { applyI18n, setLocale, t, UI_LOCALE_OPTIONS } from "../shared/i18n.js";
import { applyTheme, watchTheme, UI_THEME_OPTIONS } from "../shared/theme.js";
import { formatIpLine, GEO_CHANNEL_OPTIONS } from "../shared/geo.js";
import { call, fmtTime } from "../shared/rpc.js";
import { JP_DURATIONS, networkLabelKey } from "../shared/joyproxy-api.js";
import {
  DPR_PRESETS,
  FONT_PRESETS,
  HARDWARE_PRESETS,
  LANGUAGE_PRESETS,
  MEMORY_PRESETS,
  SCREEN_PRESETS,
  TIMEZONE_PRESETS,
  TOUCH_PRESETS,
  UA_PRESETS,
  WEBGL_PRESETS,
} from "../shared/privacy.js";

let state = null;
let sourceTab = "own";
let lowerTab = "notices";
let extractHydrated = false;
let suppressExtractCommit = false;

const composer = bindComposer(document.getElementById("composer"));
let picks = [];
initTips(document);
const apiCombo = bindCombo({
  input: document.getElementById("ex-url"),
  toggle: document.getElementById("ex-api-toggle"),
  menu: document.getElementById("ex-api-menu"),
  getItems: () =>
    (state?.extractApis || []).map((a) => ({
      id: a.id,
      value: a.url,
      label: a.name ? `${a.name} · ${a.url}` : a.url,
      active: a.id === state?.extract?.activeId,
    })),
  onSelect: async (item) => {
    if (item.id === state?.extract?.activeId) {
      document.getElementById("ex-url").value = item.value;
      return;
    }
    extractHydrated = false;
    await call("SELECT_EXTRACT_API", { id: item.id });
  },
});

document.getElementById("source-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-source]");
  if (!btn || btn.dataset.source === sourceTab) return;
  sourceTab = btn.dataset.source;
  for (const b of document.querySelectorAll("#source-tabs button")) {
    b.classList.toggle("active", b === btn);
  }
  for (const pane of document.querySelectorAll("[data-source-pane]")) {
    pane.hidden = pane.dataset.sourcePane !== sourceTab;
  }
  paintSource();
  if (sourceTab === "account") {
    call("SYNC_JOYPROXY_SESSION")
      .then((next) => {
        if (sourceTab !== "account" || !next) return;
        state = next;
        paintAccount();
      })
      .catch(() => {});
  }
  picks.forEach((p) => p.sync());
  showLower("notices");
  scrollNoticesToBottom();
});

document.getElementById("lower-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-lower]");
  if (!btn) return;
  showLower(btn.dataset.lower);
});

function showLower(id) {
  lowerTab = id;
  for (const b of document.querySelectorAll("#lower-tabs button")) {
    b.classList.toggle("active", b.dataset.lower === id);
  }
  for (const pane of document.querySelectorAll("[data-lower-pane]")) {
    pane.hidden = pane.dataset.lowerPane !== id;
  }
  paintLower();
  picks.forEach((p) => p.sync());
}

function scrollNoticesToBottom() {
  const box = document.getElementById("notice-scroll");
  if (!box) return;
  const go = () => {
    box.scrollTop = box.scrollHeight;
  };
  go();
  requestAnimationFrame(go);
}

document.getElementById("copy-ip").addEventListener("click", copyExitIp);
document.getElementById("clear-notices").addEventListener("click", () => call("CLEAR_LOGS"));
document.getElementById("open-import").addEventListener("click", () => {
  document.getElementById("import-sheet").hidden = false;
});
document.getElementById("import-cancel").addEventListener("click", () => {
  document.getElementById("import-sheet").hidden = true;
});
document.getElementById("import-go").addEventListener("click", doImport);
document.getElementById("btn-extract").addEventListener("click", runExtract);
document.getElementById("jp-web-login").addEventListener("click", () => call("JOYPROXY_WEB_LOGIN"));
document.getElementById("jp-logout").addEventListener("click", () => call("JOYPROXY_LOGOUT"));
document.getElementById("jp-refresh").addEventListener("click", () => call("REFRESH_JOYPROXY"));
document.getElementById("jp-manage").addEventListener("click", () => call("OPEN_JOYPROXY_DASHBOARD"));
document.getElementById("jp-run").addEventListener("click", runJoyproxy);
document.getElementById("jp-kind").addEventListener("click", onJpSegClick);
document.getElementById("jp-mode").addEventListener("click", onJpSegClick);
document.getElementById("jp-proto").addEventListener("click", onJpSegClick);
document.getElementById("jp-timed").addEventListener("change", onJpFormChange);
document.getElementById("jp-network").addEventListener("change", onJpFormChange);
document.getElementById("jp-country").addEventListener("change", onJpFormChange);
document.getElementById("jp-duration").addEventListener("change", onJpFormChange);
document.getElementById("jp-line").addEventListener("change", onJpFormChange);
document.getElementById("jp-i").addEventListener("change", onJpFormChange);
document.getElementById("jp-n").addEventListener("change", onJpFormChange);
document.getElementById("ex-save").addEventListener("click", saveExtractApi);
document.getElementById("ex-import").addEventListener("click", () => {
  document.getElementById("import-api-sheet").hidden = false;
});
document.getElementById("import-api-cancel").addEventListener("click", () => {
  document.getElementById("import-api-sheet").hidden = true;
});
document.getElementById("import-api-go").addEventListener("click", doImportApis);
document.getElementById("ex-new").addEventListener("click", async () => {
  suppressExtractCommit = true;
  try {
    extractHydrated = false;
    const next = await call("NEW_EXTRACT_API");
    if (next?.extract) state = next;
  } finally {
    suppressExtractCommit = false;
  }
  extractHydrated = false;
  paintExtract();
});
document.getElementById("ex-del").addEventListener("click", async () => {
  const id = state.extract?.activeId;
  if (!id) return;
  suppressExtractCommit = true;
  try {
    extractHydrated = false;
    const next = await call("REMOVE_EXTRACT_API", { id });
    if (next?.extract) state = next;
  } finally {
    suppressExtractCommit = false;
  }
  extractHydrated = false;
  paintExtract();
});
document.getElementById("import-api-sheet").addEventListener("click", (e) => {
  if (e.target === document.getElementById("import-api-sheet")) {
    document.getElementById("import-api-sheet").hidden = true;
  }
});
document.getElementById("ex-url").addEventListener("change", onApiUrlCommit);
document.getElementById("ex-url").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    onApiUrlCommit();
  }
});
document.getElementById("ex-proto").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-v]");
  if (!btn) return;
  for (const b of document.querySelectorAll("#ex-proto button")) {
    b.classList.toggle("active", b === btn);
  }
  await persistExtractFromForm();
});
document.getElementById("ex-mode").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-v]");
  if (!btn) return;
  for (const b of document.querySelectorAll("#ex-mode button")) {
    b.classList.toggle("active", b === btn);
  }
  await persistExtractFromForm();
});
document.getElementById("ex-timed").addEventListener("change", async () => {
  const on = document.getElementById("ex-timed").checked;
  document.getElementById("ex-timed-fields").hidden = !on;
  if (on) {
    const interval = document.getElementById("ex-i");
    if (!String(interval.value).trim()) interval.value = "10";
  }
  await persistExtractFromForm();
});
for (const id of ["ex-re", "ex-n", "ex-i", "ex-name", "ex-user", "ex-pass"]) {
  document.getElementById(id).addEventListener("change", persistExtractFromForm);
}
document.querySelector("[data-lower-pane='tools']").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-clean]");
  if (!btn) return;
  try {
    const r = await call("SITE_CLEANUP", { kind: btn.dataset.clean });
    toast(r?.error || t("toast.cleaned"));
  } catch (err) {
    toast(err.message);
  }
});
document.getElementById("proxy-mode").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-v]");
  if (!btn) return;
  for (const b of document.querySelectorAll("#proxy-mode button")) {
    b.classList.toggle("active", b === btn);
  }
  document.getElementById("proxy-include-wrap").hidden = btn.dataset.v !== "allow";
  document.getElementById("proxy-exclude-wrap").hidden = btn.dataset.v === "allow";
  await persistRouting();
});
document.getElementById("proxy-include").addEventListener("change", persistRouting);
document.getElementById("proxy-exclude").addEventListener("change", persistRouting);
for (const id of [
  "priv-ua",
  "priv-ua-custom",
  "priv-lang",
  "priv-tz",
  "priv-referer",
  "priv-dnt",
  "priv-webrtc",
  "priv-screen",
  "priv-dpr",
  "priv-hw",
  "priv-mem",
  "priv-touch",
  "priv-webgl",
  "priv-fonts",
  "priv-canvas",
  "rand-ua",
  "rand-lang",
  "rand-tz",
  "rand-webrtc",
  "rand-screen",
  "rand-dpr",
  "rand-hw",
  "rand-mem",
  "rand-touch",
  "rand-webgl",
  "rand-fonts",
  "rand-canvas",
  "rand-referer",
  "rand-dnt",
]) {
  document.getElementById(id).addEventListener("change", persistPrivacy);
}

document.getElementById("sys-geo").addEventListener("change", persistGeoChannel);
document.getElementById("sys-geo-custom").addEventListener("change", persistGeoChannel);
document.getElementById("sys-ui-lang").addEventListener("change", persistUiLocale);
document.getElementById("sys-ui-theme").addEventListener("change", persistUiTheme);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["joyproxy.v1"]) reload();
});

init();

async function init() {
  watchTheme(() => state?.settings?.uiTheme || "auto");
  await reload();
  picks = bindSelects(document);
  picks.forEach((p) => p.sync());
}

async function reload() {
  try {
    state = await call("GET_STATE");
  } catch (err) {
    toast(err.message);
    return;
  }
  setLocale(state.settings?.uiLocale);
  applyTheme(state.settings?.uiTheme);
  applyI18n(document);
  fillUiLangSelect();
  fillUiThemeSelect();
  toolsReady = false;
  paintChrome();
  paintSource();
  paintLower();
  picks.forEach((p) => p.sync());
}

function paintChrome() {
  const conn = state.connection;
  const line = document.getElementById("conn-line");
  document.getElementById("copy-ip").hidden = !(conn?.exitIp || state.realIp?.ip);
  if (conn) {
    line.textContent = `浏览器代理 ${formatIpLine(conn.exitIp || shortProxy(conn), conn.country)}`.replace(
      "浏览器代理",
      t("proxy.browser")
    );
  } else {
    const real = state.realIp;
    line.textContent = real?.error
      ? `${t("direct")} · ${real.error}`
      : `${t("direct")} · ${formatIpLine(real?.ip, real?.country, "…")}`;
  }
  composer.setProfiles(state.profiles, state.pendingDraft?.activeId);
  composer.applyDraft(state.pendingDraft);
  composer.setConnected(conn);
  composer.setLocked(false);
  paintRunLine();
  paintNotices();
}

function paintRunLine() {
  const runLine = document.getElementById("run-line");
  if (!runLine) return;
  const e = state.extract || {};
  const jp = state.joyproxy || {};
  if (e.running && e.timed) {
    const sec = Number(e.intervalSec) || 10;
    const key = extractMode(e) === "apply" ? "run.timedApply" : "run.timedTest";
    runLine.hidden = false;
    runLine.textContent = t(key).replace("{n}", String(sec));
    return;
  }
  if (jp.running && jp.timed) {
    const sec = Number(jp.intervalSec) || 10;
    const key = jp.mode === "apply" ? "run.timedApply" : "run.timedTest";
    runLine.hidden = false;
    runLine.textContent = t(key).replace("{n}", String(sec));
    return;
  }
  runLine.hidden = true;
  runLine.textContent = "";
}

function paintSource() {
  if (!state) return;
  if (sourceTab === "extract") paintExtract();
  else if (sourceTab === "account") paintAccount();
}

function paintLower() {
  if (!state) return;
  if (lowerTab === "tools") paintTools();
  else if (lowerTab === "system") paintSystem();
}

async function doImport() {
  const text = document.getElementById("import-text").value;
  const r = await call("IMPORT_PROFILES", { text });
  document.getElementById("import-sheet").hidden = true;
  document.getElementById("import-text").value = "";
  if (r?.state) state = r.state;
  toast(`导入 ${r.count} 条`);
  paintChrome();
}

async function doImportApis() {
  const text = document.getElementById("import-api-text").value;
  const r = await call("IMPORT_EXTRACT_APIS", { text });
  document.getElementById("import-api-sheet").hidden = true;
  document.getElementById("import-api-text").value = "";
  if (r?.state) state = r.state;
  toast(`导入 ${r.count} 条`);
  paintExtract();
}

function extractMode(e) {
  return e?.mode === "apply" || e?.mode === "switch" ? "apply" : "probe";
}

function extractRunLabel(e) {
    if (e.running) return t("api.stop");
  const apply = extractMode(e) === "apply";
  if (e.timed) return apply ? t("api.timedApply") : t("api.timedTest");
  return apply ? t("api.startApply") : t("api.start");
}

function paintExtract() {
  const e = state.extract || {};
  const mode = extractMode(e);
  const timed = Boolean(e.timed);
  apiCombo.refresh();
  const saved = Boolean(e.activeId);
  document.getElementById("ex-save").hidden = saved;
  document.getElementById("ex-new").hidden = !saved;
  document.getElementById("ex-del").hidden = !saved;

  if (!suppressExtractCommit && (!extractHydrated || !extractFormFocused())) {
    document.getElementById("ex-url").value = e.url || "";
    document.getElementById("ex-name").value = e.name || "";
    document.getElementById("ex-re").value = e.regex || "";
    document.getElementById("ex-user").value = e.username || "";
    document.getElementById("ex-pass").value = e.password || "";
    document.getElementById("ex-timed").checked = timed;
    document.getElementById("ex-n").value = timed && e.count ? e.count : "";
    document.getElementById("ex-i").value = timed && e.intervalSec ? e.intervalSec : "";
    extractHydrated = true;
  }
  document.getElementById("ex-timed-fields").hidden = !document.getElementById("ex-timed").checked;
  for (const b of document.querySelectorAll("#ex-proto button")) {
    b.classList.toggle("active", (e.protocol === "socks5" ? "socks5" : "http") === b.dataset.v);
  }
  for (const b of document.querySelectorAll("#ex-mode button")) {
    b.classList.toggle("active", b.dataset.v === mode);
  }

  const runBtn = document.getElementById("btn-extract");
  runBtn.disabled = false;
  runBtn.classList.toggle("btn-danger", Boolean(e.running));
  runBtn.classList.toggle("btn-primary", !e.running);
  runBtn.textContent = extractRunLabel({ ...e, timed: document.getElementById("ex-timed").checked, mode });

  const latest = document.getElementById("extract-latest");
  const tb = document.getElementById("extract-body");
  tb.innerHTML = "";
  const rows = e.rows || [];
  const row = rows.length ? rows[rows.length - 1] : null;
  if (!row) {
    latest.hidden = true;
    return;
  }
  latest.hidden = false;
  const statusLabel =
    row.status === "成功" ? t("api.ok") : row.status === "失败" ? t("api.fail") : row.status;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${row.index}</td><td></td><td></td><td>${row.latency ?? "—"}</td>`;
  tr.children[1].textContent = `${row.host}:${row.port}`;
  tr.children[2].textContent = statusLabel;
  const act = document.createElement("td");
  if (row.status === "成功") {
    const proxy = row.proxy || row;
    const current =
      Boolean(state.connection?.fromExtract) &&
      proxy.host === state.connection.host &&
      Number(proxy.port) === Number(state.connection.port);
    if (current) {
      act.append(button(t("restore"), "btn btn-sm btn-danger", () => call("DISCONNECT")));
    } else if (mode === "apply") {
      act.append(
        button(t("connect"), "btn btn-sm btn-primary", () =>
          call("CONNECT", { proxy, fromExtract: true })
        )
      );
    }
  }
  tr.append(act);
  tb.append(tr);
}

function extractFormFocused() {
  const ids = ["ex-url", "ex-re", "ex-n", "ex-i", "ex-timed", "ex-name", "ex-user", "ex-pass"];
  return ids.includes(document.activeElement?.id);
}

function readExtractForm() {
  const timed = document.getElementById("ex-timed").checked;
  return {
    url: document.getElementById("ex-url").value,
    name: document.getElementById("ex-name").value,
    regex: document.getElementById("ex-re").value,
    username: document.getElementById("ex-user").value,
    password: document.getElementById("ex-pass").value,
    protocol: document.querySelector("#ex-proto button.active")?.dataset.v === "socks5" ? "socks5" : "http",
    timed,
    count: timed ? Number(document.getElementById("ex-n").value) || 0 : 0,
    intervalSec: timed ? Number(document.getElementById("ex-i").value) || 0 : 0,
    mode: document.querySelector("#ex-mode button.active")?.dataset.v === "apply" ? "apply" : "probe",
  };
}

async function persistExtractFromForm() {
  if (suppressExtractCommit) return;
  await call("SAVE_EXTRACT", { cfg: readExtractForm() });
}

async function onApiUrlCommit() {
  if (suppressExtractCommit) return;
  const url = document.getElementById("ex-url").value.trim();
  const hit = (state.extractApis || []).find((a) => a.url === url);
  if (hit) {
    if (state.extract?.activeId !== hit.id) {
      extractHydrated = false;
      await call("SELECT_EXTRACT_API", { id: hit.id });
      return;
    }
    await persistExtractFromForm();
    return;
  }
  await persistExtractFromForm();
}

async function saveExtractApi() {
  await persistExtractFromForm();
  const r = await call("UPSERT_EXTRACT_API");
  if (r?.error) {
    toast(r.error);
    return;
  }
  if (r?.state) state = r.state;
  toast(t("toast.savedApi"));
  paintExtract();
}

async function runExtract() {
  await persistExtractFromForm();
  if (state.extract?.running) {
    await call("STOP_EXTRACT");
    return;
  }
  showLower("notices");
  await call("RUN_EXTRACT");
}

let lastNoticeId = "";

function paintNotices() {
  const lock = document.getElementById("notice-lock");
  if (lock) lock.hidden = true;
  const box = document.getElementById("notice-scroll");
  const logs = (state.logs || []).slice(0, 40).reverse();
  const newestId = logs[logs.length - 1]?.id || "";
  const stickToBottom = newestId !== lastNoticeId;
  lastNoticeId = newestId;
  box.innerHTML = "";
  if (!logs.length) {
    box.innerHTML = `<div class="notice-empty">${t("notice.empty")}</div>`;
    return;
  }
  for (const log of logs) {
    const line = document.createElement("div");
    line.className = `notice-line ${log.level || ""}`;
    line.textContent = `${fmtTime(log.at)}  ${log.text}`;
    box.append(line);
  }
  if (stickToBottom) box.scrollTop = box.scrollHeight;
}

let toolsReady = false;

function fillToolSelects() {
  if (toolsReady) return;
  fillSelect(document.getElementById("priv-ua"), UA_PRESETS);
  fillSelect(document.getElementById("priv-lang"), LANGUAGE_PRESETS);
  fillSelect(document.getElementById("priv-tz"), TIMEZONE_PRESETS);
  fillSelect(document.getElementById("priv-screen"), SCREEN_PRESETS);
  fillSelect(document.getElementById("priv-dpr"), DPR_PRESETS);
  fillSelect(document.getElementById("priv-hw"), HARDWARE_PRESETS);
  fillSelect(document.getElementById("priv-mem"), MEMORY_PRESETS);
  fillSelect(document.getElementById("priv-touch"), TOUCH_PRESETS);
  fillSelect(document.getElementById("priv-webgl"), WEBGL_PRESETS);
  fillSelect(document.getElementById("priv-fonts"), FONT_PRESETS);
  toolsReady = true;
}

function fillSelect(el, items) {
  el.innerHTML = "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent =
      item.id === "" ? t("preset.browserDefault") : item.id === "custom" ? t("preset.custom") : item.label;
    el.append(opt);
  }
}

const PRIVACY_FOCUS = [
  "priv-ua",
  "priv-ua-custom",
  "priv-lang",
  "priv-tz",
  "priv-referer",
  "priv-dnt",
  "priv-webrtc",
  "priv-screen",
  "priv-dpr",
  "priv-hw",
  "priv-mem",
  "priv-touch",
  "priv-webgl",
  "priv-fonts",
  "priv-canvas",
  "rand-ua",
  "rand-lang",
  "rand-tz",
  "rand-webrtc",
  "rand-screen",
  "rand-dpr",
  "rand-hw",
  "rand-mem",
  "rand-touch",
  "rand-webgl",
  "rand-fonts",
  "rand-canvas",
  "rand-referer",
  "rand-dnt",
  "proxy-include",
  "proxy-exclude",
];

function splitLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function syncRandomDisabled() {
  const on = (id) => document.getElementById(id).checked;
  document.getElementById("priv-ua").disabled = on("rand-ua");
  document.getElementById("priv-ua-custom").disabled = on("rand-ua");
  document.getElementById("priv-lang").disabled = on("rand-lang");
  document.getElementById("priv-tz").disabled = on("rand-tz");
  document.getElementById("priv-webrtc").disabled = on("rand-webrtc");
  document.getElementById("priv-screen").disabled = on("rand-screen");
  document.getElementById("priv-dpr").disabled = on("rand-dpr");
  document.getElementById("priv-hw").disabled = on("rand-hw");
  document.getElementById("priv-mem").disabled = on("rand-mem");
  document.getElementById("priv-touch").disabled = on("rand-touch");
  document.getElementById("priv-webgl").disabled = on("rand-webgl");
  document.getElementById("priv-fonts").disabled = on("rand-fonts");
  document.getElementById("priv-canvas").disabled = on("rand-canvas");
  document.getElementById("priv-referer").disabled = on("rand-referer");
  document.getElementById("priv-dnt").disabled = on("rand-dnt");
}

function paintTools() {
  fillToolSelects();
  const p = state.settings?.privacy || {};
  const r = p.random || {};
  const focused = PRIVACY_FOCUS.includes(document.activeElement?.id);
  const proxyMode = state.settings?.proxyMode === "allow" ? "allow" : "all";
  for (const b of document.querySelectorAll("#proxy-mode button")) {
    b.classList.toggle("active", b.dataset.v === proxyMode);
  }
  document.getElementById("proxy-include-wrap").hidden = proxyMode !== "allow";
  document.getElementById("proxy-exclude-wrap").hidden = proxyMode === "allow";
  if (document.activeElement?.id !== "proxy-include") {
    document.getElementById("proxy-include").value = (state.settings?.proxyInclude || []).join("\n");
  }
  if (document.activeElement?.id !== "proxy-exclude") {
    document.getElementById("proxy-exclude").value = (state.settings?.bypass || []).join("\n");
  }
  if (!focused) {
    document.getElementById("priv-ua").value = p.userAgentId || "";
    document.getElementById("priv-ua-custom").value = p.userAgentCustom || "";
    document.getElementById("priv-lang").value = p.language || "";
    document.getElementById("priv-tz").value = p.timezone || "";
    document.getElementById("priv-referer").checked = Boolean(p.stripReferer);
    document.getElementById("priv-dnt").checked = Boolean(p.dnt);
    document.getElementById("priv-webrtc").checked = Boolean(state.settings?.restrictWebRTC);
    document.getElementById("priv-screen").value = p.screen || "";
    document.getElementById("priv-dpr").value = p.devicePixelRatio || "";
    document.getElementById("priv-hw").value = p.hardwareConcurrency || "";
    document.getElementById("priv-mem").value = p.deviceMemory || "";
    document.getElementById("priv-touch").value = p.maxTouchPoints || "";
    document.getElementById("priv-webgl").value = p.webglId || "";
    document.getElementById("priv-fonts").value = p.fontId || "";
    document.getElementById("priv-canvas").checked = Boolean(p.canvasNoise);
    document.getElementById("rand-ua").checked = Boolean(r.userAgent);
    document.getElementById("rand-lang").checked = Boolean(r.language);
    document.getElementById("rand-tz").checked = Boolean(r.timezone);
    document.getElementById("rand-webrtc").checked = Boolean(r.webrtc);
    document.getElementById("rand-screen").checked = Boolean(r.screen);
    document.getElementById("rand-dpr").checked = Boolean(r.devicePixelRatio);
    document.getElementById("rand-hw").checked = Boolean(r.hardwareConcurrency);
    document.getElementById("rand-mem").checked = Boolean(r.deviceMemory);
    document.getElementById("rand-touch").checked = Boolean(r.maxTouchPoints);
    document.getElementById("rand-webgl").checked = Boolean(r.webgl);
    document.getElementById("rand-fonts").checked = Boolean(r.fonts);
    document.getElementById("rand-canvas").checked = Boolean(r.canvasNoise);
    document.getElementById("rand-referer").checked = Boolean(r.stripReferer);
    document.getElementById("rand-dnt").checked = Boolean(r.dnt);
  }
  document.getElementById("priv-ua-custom-wrap").hidden =
    document.getElementById("priv-ua").value !== "custom" || document.getElementById("rand-ua").checked;
  syncRandomDisabled();
  picks.forEach((p) => p.sync());
}

async function persistRouting() {
  const mode = document.querySelector("#proxy-mode button.active")?.dataset.v === "allow" ? "allow" : "all";
  document.getElementById("proxy-include-wrap").hidden = mode !== "allow";
  document.getElementById("proxy-exclude-wrap").hidden = mode === "allow";
  await call("SAVE_SETTINGS", {
    settings: {
      proxyMode: mode,
      proxyInclude: splitLines(document.getElementById("proxy-include").value),
      bypass: splitLines(document.getElementById("proxy-exclude").value),
    },
  });
}

async function persistPrivacy() {
  const userAgentId = document.getElementById("priv-ua").value;
  syncRandomDisabled();
  document.getElementById("priv-ua-custom-wrap").hidden =
    userAgentId !== "custom" || document.getElementById("rand-ua").checked;
  picks.forEach((p) => p.sync());
  await call("SAVE_SETTINGS", {
    settings: {
      restrictWebRTC: document.getElementById("priv-webrtc").checked,
      privacy: {
        userAgentId,
        userAgentCustom: document.getElementById("priv-ua-custom").value,
        language: document.getElementById("priv-lang").value,
        timezone: document.getElementById("priv-tz").value,
        stripReferer: document.getElementById("priv-referer").checked,
        dnt: document.getElementById("priv-dnt").checked,
        screen: document.getElementById("priv-screen").value,
        devicePixelRatio: document.getElementById("priv-dpr").value,
        hardwareConcurrency: document.getElementById("priv-hw").value,
        deviceMemory: document.getElementById("priv-mem").value,
        maxTouchPoints: document.getElementById("priv-touch").value,
        webglId: document.getElementById("priv-webgl").value,
        fontId: document.getElementById("priv-fonts").value,
        canvasNoise: document.getElementById("priv-canvas").checked,
        random: {
          userAgent: document.getElementById("rand-ua").checked,
          language: document.getElementById("rand-lang").checked,
          timezone: document.getElementById("rand-tz").checked,
          webrtc: document.getElementById("rand-webrtc").checked,
          screen: document.getElementById("rand-screen").checked,
          devicePixelRatio: document.getElementById("rand-dpr").checked,
          hardwareConcurrency: document.getElementById("rand-hw").checked,
          deviceMemory: document.getElementById("rand-mem").checked,
          maxTouchPoints: document.getElementById("rand-touch").checked,
          webgl: document.getElementById("rand-webgl").checked,
          fonts: document.getElementById("rand-fonts").checked,
          canvasNoise: document.getElementById("rand-canvas").checked,
          stripReferer: document.getElementById("rand-referer").checked,
          dnt: document.getElementById("rand-dnt").checked,
        },
      },
    },
  });
}

function fillUiThemeSelect() {
  const sel = document.getElementById("sys-ui-theme");
  const current = sel.value || state?.settings?.uiTheme || "auto";
  sel.innerHTML = "";
  for (const item of UI_THEME_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = t(item.key);
    sel.append(opt);
  }
  sel.value = current;
}

function fillUiLangSelect() {
  const sel = document.getElementById("sys-ui-lang");
  const current = sel.value || state?.settings?.uiLocale || "auto";
  sel.innerHTML = "";
  for (const item of UI_LOCALE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.id === "auto" ? t("sys.language.auto") : item.native;
    sel.append(opt);
  }
  sel.value = current;
}

function paintSystem() {
  const sel = document.getElementById("sys-geo");
  const current = sel.value || state.settings?.geoChannel || "ipinfo";
  sel.innerHTML = "";
  for (const item of GEO_CHANNEL_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.id === "custom" ? t("sys.geo.custom") : item.label;
    sel.append(opt);
  }
  const channel = state.settings?.geoChannel || "ipinfo";
  if (document.activeElement?.id !== "sys-geo" && document.activeElement !== sel._combo?.input) {
    sel.value = channel;
  } else if (![...sel.options].some((o) => o.value === sel.value)) {
    sel.value = channel;
  }
  if (!sel.value) sel.value = current || channel;
  const custom = (sel.value || channel) === "custom";
  document.getElementById("sys-geo-custom-wrap").hidden = !custom;
  if (document.activeElement?.id !== "sys-geo-custom") {
    document.getElementById("sys-geo-custom").value = state.settings?.customGeoUrl || "";
  }
  fillUiLangSelect();
  fillUiThemeSelect();
  if (document.activeElement?.id !== "sys-ui-lang") {
    document.getElementById("sys-ui-lang").value = state.settings?.uiLocale || "auto";
  }
  if (document.activeElement?.id !== "sys-ui-theme") {
    document.getElementById("sys-ui-theme").value = state.settings?.uiTheme || "auto";
  }
  const manifest = chrome.runtime.getManifest();
  document.getElementById("sys-version").textContent = `${t("sys.version")} ${manifest.version || "—"}`;
}

async function persistUiLocale() {
  const uiLocale = document.getElementById("sys-ui-lang").value || "auto";
  await call("SAVE_SETTINGS", { settings: { uiLocale } });
  setLocale(uiLocale);
  applyI18n(document);
  fillUiLangSelect();
  document.getElementById("sys-ui-lang").value = uiLocale;
  toolsReady = false;
  paintChrome();
  paintSource();
  paintLower();
  picks.forEach((p) => p.sync());
}

async function persistUiTheme() {
  const uiTheme = document.getElementById("sys-ui-theme").value || "auto";
  await call("SAVE_SETTINGS", { settings: { uiTheme } });
  applyTheme(uiTheme);
  fillUiThemeSelect();
  document.getElementById("sys-ui-theme").value = uiTheme;
  picks.forEach((p) => p.sync());
}

async function persistGeoChannel() {
  const geoChannel = document.getElementById("sys-geo").value || "ipinfo";
  document.getElementById("sys-geo-custom-wrap").hidden = geoChannel !== "custom";
  await call("SAVE_SETTINGS", {
    settings: {
      geoChannel,
      customGeoUrl: document.getElementById("sys-geo-custom").value.trim(),
    },
  });
  call("REFRESH_REAL_IP").catch(() => {});
}

function paintAccount() {
  const acc = state.account || {};
  const guest = document.getElementById("jp-guest");
  const app = document.getElementById("jp-app");
  guest.hidden = Boolean(acc.loggedIn);
  app.hidden = !acc.loggedIn;
  if (!acc.loggedIn) return;

  document.getElementById("jp-user").textContent = acc.email || "";
  const jp = state.joyproxy || {};
  const catalog = jp.catalog || {};
  const loading = Boolean(jp.catalogLoading);
  const networks = catalog.networks || [];
  const lines = catalog.lines || [];
  const hasAny = networks.length > 0 || lines.length > 0;

  if (acc.loggedIn && jp.token && !catalog.loaded && !loading) {
    call("REFRESH_JOYPROXY").catch(() => {});
  }

  document.getElementById("jp-load").hidden = !loading;
  document.getElementById("jp-empty").hidden = loading || hasAny || !catalog.loaded;
  const emptyNote = document.querySelector("#jp-empty .note");
  if (emptyNote) emptyNote.textContent = catalog.error || t("jp.empty");
  document.getElementById("jp-form").hidden = !hasAny;

  const kind = jp.kind === "static" ? "static" : "dynamic";
  for (const b of document.querySelectorAll("#jp-kind button")) {
    b.classList.toggle("active", b.dataset.v === kind);
    b.disabled = b.dataset.v === "dynamic" ? !networks.length : !lines.length;
  }
  document.getElementById("jp-dynamic").hidden = kind !== "dynamic";
  document.getElementById("jp-static").hidden = kind !== "static";
  document.getElementById("jp-timed-wrap").hidden = kind !== "dynamic";

  if (document.activeElement?.id !== "jp-network") fillJpNetwork(networks, jp.network);
  if (document.activeElement?.id !== "jp-country") fillJpCountry(catalog.countries || [], jp.countryGeoname);
  if (document.activeElement?.id !== "jp-duration") fillJpDuration(jp.duration || "2m");
  if (document.activeElement?.id !== "jp-line") fillJpLine(lines, jp.selectedId);
  if (document.activeElement?.id !== "jp-timed") document.getElementById("jp-timed").checked = Boolean(jp.timed);
  if (document.activeElement?.id !== "jp-i") {
    document.getElementById("jp-i").value = jp.timed && jp.intervalSec ? jp.intervalSec : "";
  }
  if (document.activeElement?.id !== "jp-n") {
    document.getElementById("jp-n").value = jp.timed && jp.count ? jp.count : "";
  }
  document.getElementById("jp-timed-fields").hidden = kind !== "dynamic" || !document.getElementById("jp-timed").checked;

  const mode = jp.mode === "apply" ? "apply" : "probe";
  for (const b of document.querySelectorAll("#jp-mode button")) {
    b.classList.toggle("active", b.dataset.v === mode);
  }
  const proto = jp.protocol === "socks5" ? "socks5" : "http";
  for (const b of document.querySelectorAll("#jp-proto button")) {
    b.classList.toggle("active", b.dataset.v === proto);
  }
  document.getElementById("jp-socks-hint").hidden = proto !== "socks5";

  const runBtn = document.getElementById("jp-run");
  runBtn.disabled = false;
  runBtn.classList.toggle("btn-danger", Boolean(jp.running));
  runBtn.classList.toggle("btn-primary", !jp.running);
  runBtn.textContent = jpRunLabel(jp);

  paintJpLatest(jp);
}

function jpRunLabel(jp) {
  if (jp.running) return t("api.stop");
  const apply = jp.mode === "apply";
  const timed = jp.kind !== "static" && jp.timed;
  if (timed) return apply ? t("api.timedApply") : t("api.timedTest");
  return apply ? t("api.startApply") : t("api.start");
}

function fillJpSelect(sel, items, current) {
  const html = items
    .map(([id, label]) => `<option value="${escapeAttr(id)}">${escapeHtml(label)}</option>`)
    .join("");
  if (sel.innerHTML !== html) sel.innerHTML = html;
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function fillJpNetwork(networks, current) {
  fillJpSelect(
    document.getElementById("jp-network"),
    networks.map((n) => [n, t(networkLabelKey(n))]),
    current || networks[0] || ""
  );
}

function fillJpCountry(countries, current) {
  const items = [["", t("jp.country.any")], ...countries.map((c) => [c.id, c.name || c.iso || c.id])];
  fillJpSelect(document.getElementById("jp-country"), items, current || "");
}

function fillJpDuration(current) {
  fillJpSelect(document.getElementById("jp-duration"), JP_DURATIONS, current || "2m");
}

function fillJpLine(lines, current) {
  fillJpSelect(
    document.getElementById("jp-line"),
    lines.map((l) => [l.id, l.label]),
    current || lines[0]?.id || ""
  );
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function paintJpLatest(jp) {
  const latest = document.getElementById("jp-latest");
  const tb = document.getElementById("jp-body");
  tb.innerHTML = "";
  const rows = jp.rows || [];
  const row = rows.length ? rows[rows.length - 1] : null;
  if (!row) {
    latest.hidden = true;
    return;
  }
  latest.hidden = false;
  const statusLabel = row.status === "成功" ? t("api.ok") : row.status === "失败" ? t("api.fail") : row.status;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${row.index}</td><td></td><td></td><td>${row.latency ?? "—"}</td>`;
  tr.children[1].textContent = `${row.host}:${row.port}`;
  tr.children[2].textContent = statusLabel;
  const act = document.createElement("td");
  if (row.status === "成功") {
    const proxy = row.proxy || row;
    const current =
      Boolean(state.connection?.fromJoyproxy) &&
      proxy.host === state.connection.host &&
      Number(proxy.port) === Number(state.connection.port);
    if (current) {
      act.append(button(t("restore"), "btn btn-sm btn-danger", () => call("DISCONNECT")));
    } else {
      act.append(
        button(t("connect"), "btn btn-sm btn-primary", () =>
          call("CONNECT", { proxy, fromJoyproxy: true })
        )
      );
    }
  }
  tr.append(act);
  tb.append(tr);
}

function readJoyproxyForm() {
  const kind = document.querySelector("#jp-kind button.active")?.dataset.v === "static" ? "static" : "dynamic";
  const timed = document.getElementById("jp-timed").checked;
  return {
    kind,
    mode: document.querySelector("#jp-mode button.active")?.dataset.v === "apply" ? "apply" : "probe",
    network: document.getElementById("jp-network").value,
    countryGeoname: document.getElementById("jp-country").value,
    duration: document.getElementById("jp-duration").value,
    selectedId: document.getElementById("jp-line").value,
    protocol: document.querySelector("#jp-proto button.active")?.dataset.v === "socks5" ? "socks5" : "http",
    timed,
    intervalSec: timed ? Number(document.getElementById("jp-i").value) || 0 : 0,
    count: timed ? Number(document.getElementById("jp-n").value) || 0 : 0,
  };
}

async function persistJoyproxyFromForm() {
  await call("SET_JOYPROXY", { prefs: readJoyproxyForm() });
}

async function onJpSegClick(e) {
  const btn = e.target.closest("button[data-v]");
  if (!btn || btn.disabled) return;
  const seg = btn.parentElement;
  for (const b of seg.querySelectorAll("button")) b.classList.toggle("active", b === btn);
  if (seg.id === "jp-kind") {
    const kind = btn.dataset.v === "static" ? "static" : "dynamic";
    document.getElementById("jp-dynamic").hidden = kind !== "dynamic";
    document.getElementById("jp-static").hidden = kind !== "static";
    document.getElementById("jp-timed-wrap").hidden = kind !== "dynamic";
  }
  if (seg.id === "jp-proto") {
    document.getElementById("jp-socks-hint").hidden = btn.dataset.v !== "socks5";
  }
  await persistJoyproxyFromForm();
}

async function onJpFormChange() {
  if (document.getElementById("jp-timed").checked) {
    const interval = document.getElementById("jp-i");
    if (interval && !String(interval.value).trim()) interval.value = "10";
  }
  document.getElementById("jp-timed-fields").hidden = !document.getElementById("jp-timed").checked;
  await persistJoyproxyFromForm();
}

async function runJoyproxy() {
  await persistJoyproxyFromForm();
  if (state.joyproxy?.running) {
    await call("STOP_JOYPROXY");
    return;
  }
  showLower("notices");
  scrollNoticesToBottom();
  await call("RUN_JOYPROXY");
}

async function copyExitIp() {
  const ip = state.connection?.exitIp || state.realIp?.ip;
  if (!ip) return;
  try {
    await navigator.clipboard.writeText(ip);
    toast("已复制 IP");
  } catch {
    toast(ip);
  }
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

let toastTimer;
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}
