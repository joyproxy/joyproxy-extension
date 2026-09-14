import { bindComposer } from "../shared/compose.js";
import { bindSelects } from "../shared/combo.js";
import { initTips } from "../shared/tips.js";
import { applyI18n, setLocale, t } from "../shared/i18n.js";
import { applyTheme, watchTheme } from "../shared/theme.js";
import { formatIpLine } from "../shared/geo.js";
import { call } from "../shared/rpc.js";
import { lineDisplayLabel, liveCatalogLines, networkLabelKey } from "../shared/joyproxy-api.js";

const $ = (id) => document.getElementById(id);

let state = null;
const composer = bindComposer($("composer"));
initTips(document);
let picks = [];

$("open-panel").addEventListener("click", openPanel);
$("btn-login").addEventListener("click", () => call("JOYPROXY_WEB_LOGIN"));
$("btn-logout").addEventListener("click", () => call("JOYPROXY_LOGOUT"));
$("copy-ip").addEventListener("click", copyExitIp);
$("restore-direct").addEventListener("click", () => call("DISCONNECT"));
$("jp-apply").addEventListener("click", applyJoyproxy);
$("jp-test").addEventListener("click", testJoyproxy);
$("jp-product").addEventListener("change", async () => {
  await call("SET_JOYPROXY", { prefs: prefsFromQuick($("jp-product").value) });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["joyproxy.v1"]) reload();
});

init();

async function init() {
  watchTheme(() => state?.settings?.uiTheme || "auto");
  await reload();
  picks = bindSelects(document);
  picks.forEach((p) => p.sync());
  call("REFRESH_REAL_IP").catch(() => {});
  call("SYNC_JOYPROXY_SESSION")
    .then((next) => {
      if (!next) return;
      state = next;
      paint();
    })
    .catch(() => {});
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
  paint();
  picks.forEach((p) => p.sync());
}

function paint() {
  const acc = state.account || {};
  const conn = state.connection;
  $("copy-ip").hidden = !(conn?.exitIp || state.realIp?.ip);
  $("btn-login").hidden = acc.loggedIn;
  $("btn-logout").hidden = !acc.loggedIn;
  $("status-dot").className = `dot ${conn ? "on" : "off"}`;
  if (conn) {
    $("status-text").textContent = `${t("proxy.browser")} ${formatIpLine(conn.exitIp || conn.host, conn.country)}`;
  } else {
    const real = state.realIp;
    $("status-text").textContent = real?.error
      ? `${t("direct")} · ${real.error}`
      : `${t("direct")} · ${formatIpLine(real?.ip, real?.country, "…")}`;
  }

  const runLine = $("run-line");
  const e = state.extract || {};
  const jp = state.joyproxy || {};
  if (e.running && e.timed) {
    const sec = Number(e.intervalSec) || 10;
    runLine.hidden = false;
    runLine.textContent = t(e.mode === "apply" || e.mode === "switch" ? "run.timedApply" : "run.timedTest").replace(
      "{n}",
      String(sec)
    );
  } else if (jp.running && jp.timed) {
    runLine.hidden = false;
    runLine.textContent = t(jp.mode === "apply" ? "run.timedApply" : "run.timedTest").replace(
      "{n}",
      String(Number(jp.intervalSec) || 10)
    );
  } else {
    runLine.hidden = true;
    runLine.textContent = "";
  }

  composer.setProfiles(state.profiles, state.pendingDraft?.activeId);
  composer.applyDraft(state.pendingDraft);
  composer.applySettings(state.settings);
  composer.setConnected(conn);
  composer.setLocked(false);

  const catalog = jp.catalog || {};
  const networks = catalog.networks || [];
  const lines = liveCatalogLines(catalog.lines);
  if (acc.loggedIn && jp.token && !catalog.loaded && !jp.catalogLoading) {
    call("REFRESH_JOYPROXY").catch(() => {});
  }
  const quick = $("jp-quick");
  quick.hidden = !(acc.loggedIn && (networks.length || lines.length));
  if (!quick.hidden) {
    $("jp-user").textContent = acc.email || "";
    const sel = $("jp-product");
    if (document.activeElement !== sel) {
      const groups = [];
      if (networks.length) {
        groups.push(
          `<optgroup label="${t("jp.kind.dynamic")}">${networks
            .map((n) => `<option value="dyn:${n}">${t(networkLabelKey(n))}</option>`)
            .join("")}</optgroup>`
        );
      }
      if (lines.length) {
        groups.push(
          `<optgroup label="${t("jp.kind.static")}">${lines
            .map((l) => `<option value="${l.id}">${lineDisplayLabel(l, t)}</option>`)
            .join("")}</optgroup>`
        );
      }
      sel.innerHTML = groups.join("");
      const current =
        jp.kind === "static" && jp.selectedId
          ? jp.selectedId
          : jp.network
            ? `dyn:${jp.network}`
            : sel.options[0]?.value || "";
      if ([...sel.options].some((o) => o.value === current)) sel.value = current;
    }
    $("jp-apply").disabled = Boolean(jp.running);
    $("jp-test").disabled = Boolean(jp.running);
    $("jp-apply").textContent = jp.running ? t("api.stop") : t("connect");
  }
}

function prefsFromQuick(value) {
  if (String(value).startsWith("dyn:")) {
    return { kind: "dynamic", network: value.slice(4) };
  }
  return { kind: "static", selectedId: value };
}

async function testJoyproxy() {
  const value = $("jp-product").value;
  if (!value) return;
  await call("SET_JOYPROXY", { prefs: prefsFromQuick(value) });
  await call("RUN_JOYPROXY", { apply: false, once: true });
}

async function applyJoyproxy() {
  const jp = state.joyproxy || {};
  if (jp.running) {
    await call("STOP_JOYPROXY");
    return;
  }
  const value = $("jp-product").value;
  if (!value) return;
  await call("SET_JOYPROXY", { prefs: prefsFromQuick(value) });
  await call("RUN_JOYPROXY", { apply: true, once: true });
}

async function copyExitIp() {
  const ip = state.connection?.exitIp || state.realIp?.ip;
  if (!ip) return;
  try {
    await navigator.clipboard.writeText(ip);
    toast(t("toast.copiedIp"));
  } catch {
    toast(ip);
  }
}

function openPanel() {
  call("SAVE_SETTINGS", { settings: { panelMode: "side", panelModeRev: 1 } }).catch(() => {});
  const panelUrl = chrome.runtime.getURL("src/panel/panel.html");
  const fallback = (err) => {
    const height = Math.max(560, Math.min(920, (screen.availHeight || 800) - 88));
    const width = Math.max(400, Math.min(520, Math.round((screen.availWidth || 1280) * 0.32)));
    Promise.resolve(
      chrome.windows.create({
        url: panelUrl,
        type: "popup",
        width,
        height,
        focused: true,
      })
    ).catch(() => {
      toast(err?.message || t("toast.openPanelFail"));
    });
  };
  const open = (windowId) => {
    if (!chrome.sidePanel?.open) {
      fallback();
      return;
    }
    const req = windowId != null ? { windowId } : {};
    Promise.resolve(chrome.sidePanel.open(req))
      .then(() => window.close())
      .catch(fallback);
  };
  try {
    chrome.windows.getCurrent((win) => {
      if (chrome.runtime.lastError || !win?.id) open();
      else open(win.id);
    });
  } catch (err) {
    fallback(err);
  }
}

let toastTimer;
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}
