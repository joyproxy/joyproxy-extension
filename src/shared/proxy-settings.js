import { resolveGeoTarget } from "./geo.js";
import { DEFAULT_BYPASS } from "./store.js";

let authHandlerInstalled = false;
let pendingAuth = null;
let testLock = Promise.resolve();

function pacEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function proxyPacToken(proxy) {
  const scheme = proxy.protocol === "http" ? "PROXY" : "SOCKS5";
  return `${scheme} ${proxy.host}:${proxy.port}`;
}

function fallbackPacToken(connection) {
  if (!connection) return "DIRECT";
  return proxyPacToken(connection);
}

function buildTestPac(proxy, connection, testHost) {
  const hosts = new Set(
    ["ipinfo.io", "ipwhois.app", "ip-api.com", "api.myip.com", testHost].filter(Boolean)
  );
  const list = [...hosts].map((h) => `"${pacEscape(h)}"`).join(", ");
  return `function FindProxyForURL(url, host) {
  var tests = [${list}];
  for (var i = 0; i < tests.length; i++) {
    if (host === tests[i]) return "${pacEscape(proxyPacToken(proxy))}";
  }
  return "${pacEscape(fallbackPacToken(connection))}";
}`;
}

function uniqueLines(list) {
  const out = [];
  const seen = new Set();
  for (const item of list || []) {
    const s = String(item || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function normalizeProxySettings(settingsOrBypass) {
  if (Array.isArray(settingsOrBypass)) {
    return { bypass: settingsOrBypass, proxyInclude: [], proxyMode: "all" };
  }
  return settingsOrBypass || {};
}

function needsPacPattern(pattern) {
  const p = String(pattern || "");
  return /[/?#]/.test(p) || /^https?:\/\//i.test(p) || /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(p);
}

function cidrMask(bits) {
  const n = Math.max(0, Math.min(32, Number(bits) || 0));
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return [24, 16, 8, 0].map((shift) => (mask >>> shift) & 255).join(".");
}

function pacClause(pattern) {
  const p = String(pattern || "").trim();
  if (!p) return "";
  const cidr = p.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
  if (cidr) return `isInNet(host, "${cidr[1]}", "${cidrMask(cidr[2])}")`;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(p)) return `host === "${p}"`;
  if (/^https?:\/\//i.test(p)) return `shExpMatch(url, "${pacEscape(p)}*")`;
  if (p.includes("/")) {
    return `shExpMatch(url, "*://${pacEscape(p)}*")`;
  }
  if (p.includes("*")) {
    return `shExpMatch(host, "${pacEscape(p)}") || shExpMatch(url, "${pacEscape(p)}")`;
  }
  const host = p.replace(/^\./, "");
  return `host === "${pacEscape(host)}" || dnsDomainIs(host, "${pacEscape(host)}") || shExpMatch(host, "*.${pacEscape(host)}")`;
}

function pacCondition(patterns) {
  const parts = (patterns || []).map(pacClause).filter(Boolean);
  return parts.length ? `(${parts.join(" || ")})` : "false";
}

function buildRoutingPac(proxy, { allowOnly, include, exclude }) {
  const token = proxyPacToken(proxy);
  return `function FindProxyForURL(url, host) {
  var proxy = "${pacEscape(token)}";
  if (isPlainHostName(host) || host === "127.0.0.1" || host === "::1") return "DIRECT";
  if (${pacCondition(exclude)}) return "DIRECT";
  ${allowOnly ? `if (${pacCondition(include)}) return proxy;\n  return "DIRECT";` : "return proxy;"}
}`;
}

export async function getProxySettings() {
  return new Promise((resolve) => {
    chrome.proxy.settings.get({ incognito: false }, (cfg) => resolve(cfg));
  });
}

export async function setProxyConfig(value) {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set({ value, scope: "regular" }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function clearProxyConfig() {
  return new Promise((resolve) => {
    chrome.proxy.settings.clear({ scope: "regular" }, () => resolve());
  });
}

export function setPendingAuth(proxy) {
  pendingAuth =
    proxy?.username != null && String(proxy.username).length
      ? { username: proxy.username, password: proxy.password || "" }
      : null;
}

export function installAuthHandler() {
  if (authHandlerInstalled) return;
  authHandlerInstalled = true;
  chrome.webRequest.onAuthRequired.addListener(
    (details, asyncCallback) => {
      if (!details.isProxy || !pendingAuth) {
        asyncCallback({ cancel: false });
        return;
      }
      asyncCallback({ authCredentials: pendingAuth });
    },
    { urls: ["<all_urls>"] },
    ["asyncBlocking"]
  );
}

export async function applyBrowserProxy(proxy, settingsOrBypass) {
  setPendingAuth(proxy);
  const settings = normalizeProxySettings(settingsOrBypass);
  const exclude = uniqueLines(settings.bypass?.length ? settings.bypass : DEFAULT_BYPASS);
  const include = uniqueLines(settings.proxyInclude);
  const allowOnly = settings.proxyMode === "allow";
  if (allowOnly || exclude.some(needsPacPattern) || include.some(needsPacPattern)) {
    await setProxyConfig({
      mode: "pac_script",
      pacScript: { data: buildRoutingPac(proxy, { allowOnly, include, exclude }) },
    });
    return;
  }
  await setProxyConfig({
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: proxy.protocol === "http" ? "http" : "socks5",
        host: proxy.host,
        port: Number(proxy.port),
      },
      bypassList: exclude,
    },
  });
}

export async function restoreProxy(saved) {
  pendingAuth = saved?.auth || null;
  if (!saved?.value) {
    await clearProxyConfig();
    return;
  }
  try {
    await setProxyConfig(saved.value);
  } catch {
    await clearProxyConfig();
  }
}

async function withTestProxy(proxy, connection, settings, fn) {
  const current = await getProxySettings();
  const testHost = resolveGeoTarget(settings).host;
  const pac = buildTestPac(proxy, connection, testHost);
  setPendingAuth(proxy);
  await setProxyConfig({
    mode: "pac_script",
    pacScript: { data: pac },
  });
  try {
    return await fn();
  } finally {
    try {
      if (connection) {
        await applyBrowserProxy(connection, settings);
      } else if (current?.levelOfControl === "controlled_by_this_extension" && current.value) {
        await setProxyConfig(current.value);
      } else {
        await clearProxyConfig();
      }
    } catch {
      await clearProxyConfig();
    }
  }
}

export function runExclusiveTest(task) {
  const next = testLock.then(task, task);
  testLock = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export async function testViaPac(proxy, connection, settings, fetchGeoFn, timeoutMs = 8000) {
  return runExclusiveTest(() =>
    withTestProxy(proxy, connection, settings, () => fetchGeoFn(settings, timeoutMs))
  );
}
