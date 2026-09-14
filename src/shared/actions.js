import { fetchGeo, countryCode, formatIpLine, verifyAuthTunnel } from "./geo.js";
import { ensureOffscreenDocument, fetchThroughOffscreen } from "./offscreen-fetch.js";
import { extractHostPorts, parseProxyInput, shortProxy } from "./parse.js";
import {
  loadState,
  patchState,
  personaMeta,
  pushLog,
  pushRecent,
} from "./store.js";
import {
  JP_LOGIN,
  JP_DASHBOARD,
  emptyCatalog,
  extractOneProxy,
  fetchGeoCountries,
  fetchGeoCountryTree,
  joySessionType,
  liveCatalogLines,
  loadJoyproxyCatalog,
  snapJoyDuration,
} from "./joyproxy-api.js";
import {
  applyBrowserProxy,
  clearProxyConfig,
  getProxySettings,
  hasHttpAuth,
  installAuthHandler,
  restoreProxy,
  setPendingAuth,
  testViaPac,
} from "./proxy-settings.js";
import { buildLocalProxyCommand, localRelayRequiredError, shouldUseLocalRelay } from "./local-relay.js";
import { ensureLocalRelay } from "./native-relay.js";
import { setActionAppearance } from "./icons.js";
import { t } from "./i18n.js";
import {
  applyHeaderOverrides,
  applyWebRtc,
  clearAllCookies,
  clearCache,
  clearSiteCookies,
  clearSiteData,
  findHttpTab,
  hasRandomPrivacy,
  installPrivacyInjection,
  resolveLivePrivacy,
} from "./privacy.js";

function logLine(state, key, params = {}, level = "info") {
  if (typeof params === "string") {
    level = params;
    params = {};
  }
  pushLog(state, { key, params }, level);
}

function asProto(v) {
  return v === "socks5" ? "socks5" : "http";
}

export async function getPublicState() {
  const state = await loadState();
  return decorate(state);
}

function decorate(state) {
  const account = {
    ...personaMeta(state.persona),
    email: state.joyproxy?.email || "",
  };
  return {
    ...state,
    account,
  };
}

export async function saveDraft(draft) {
  const state = await patchState((s) => {
    s.pendingDraft = { ...s.pendingDraft, ...draft };
    return s;
  });
  return decorate(state);
}

export async function newDraft() {
  const state = await patchState((s) => {
    s.pendingDraft = {
      raw: "",
      protocol: "http",
      username: "",
      password: "",
      activeId: "",
    };
    return s;
  });
  return decorate(state);
}

export async function selectProfile(id) {
  const state = await patchState((s) => {
    const profile = s.profiles.find((p) => p.id === id);
    if (!profile) {
      s.pendingDraft.activeId = "";
      return s;
    }
    s.pendingDraft = {
      raw: `${profile.host}:${profile.port}`,
      protocol: asProto(profile.protocol),
      username: profile.username || "",
      password: profile.password || "",
      activeId: profile.id,
    };
    return s;
  });
  return decorate(state);
}

export async function setSource(source) {
  const state = await patchState((s) => {
    s.source = source === "joyproxy" ? "joyproxy" : "own";
    return s;
  });
  return decorate(state);
}

export async function setJoyproxyPrefs(prefs) {
  const prev = await loadState();
  const countryChanged =
    prefs.countryGeoname !== undefined && prefs.countryGeoname !== prev.joyproxy?.countryGeoname;
  const stateChanged = prefs.stateGeoname !== undefined && prefs.stateGeoname !== prev.joyproxy?.stateGeoname;
  const state = await patchState((s) => {
    s.joyproxy = { ...s.joyproxy, ...prefs };
    s.joyproxy.sessionType = joySessionType(s.joyproxy.sessionType);
    if (s.joyproxy.sessionType === "sticky") {
      s.joyproxy.duration = snapJoyDuration(s.joyproxy.duration, "sticky") || "1m";
    }
    s.joyproxy.protocol = "http";
    if (countryChanged) {
      if (prefs.stateGeoname === undefined) s.joyproxy.stateGeoname = "";
      if (prefs.cityGeoname === undefined) s.joyproxy.cityGeoname = "";
    } else if (stateChanged && prefs.cityGeoname === undefined) {
      s.joyproxy.cityGeoname = "";
    }
    return s;
  });
  if (prefs.network && prefs.network !== prev.joyproxy?.network) {
    refreshJoyproxyGeo(prefs.network).catch(() => {});
  } else if (countryChanged) {
    refreshJoyproxyGeo().catch(() => {});
  }
  return decorate(state);
}

function pickCatalogDefaults(jp, catalog) {
  const next = { ...jp, catalog: { ...catalog, lines: liveCatalogLines(catalog.lines) } };
  catalog = next.catalog;
  if (next.kind === "dynamic" && !catalog.networks.length && catalog.lines.length) next.kind = "static";
  if (next.kind === "static" && !catalog.lines.length && catalog.networks.length) next.kind = "dynamic";
  if (catalog.networks.length && !catalog.networks.includes(next.network)) next.network = catalog.networks[0];
  if (catalog.lines.length && !catalog.lines.some((l) => l.id === next.selectedId)) next.selectedId = catalog.lines[0].id;
  if (!(catalog.countries || []).length && (jp.catalog?.countries || []).length) {
    catalog.countries = jp.catalog.countries;
    catalog.states = jp.catalog.states || [];
    catalog.cities = jp.catalog.cities || {};
    catalog.geoTreeCountry = jp.catalog.geoTreeCountry || "";
  } else if (jp.catalog?.geoTreeCountry && jp.catalog.geoTreeCountry === next.countryGeoname) {
    catalog.states = jp.catalog.states || [];
    catalog.cities = jp.catalog.cities || {};
    catalog.geoTreeCountry = jp.catalog.geoTreeCountry;
  }
  if ((catalog.countries || []).length && next.countryGeoname && !catalog.countries.some((c) => c.id === next.countryGeoname)) {
    next.countryGeoname = "";
    next.stateGeoname = "";
    next.cityGeoname = "";
  }
  if (next.stateGeoname && (catalog.geoTreeCountry || "") === next.countryGeoname) {
    if (!(catalog.states || []).some((s) => s.id === next.stateGeoname)) {
      next.stateGeoname = "";
      next.cityGeoname = "";
    }
  }
  return next;
}

let catalogRefreshAt = 0;

export async function refreshJoyproxyCatalog(opts = {}) {
  const opened = await loadState();
  const jwt = opened.joyproxy?.token;
  if (!jwt) return decorate(opened);
  if (
    !opts.force &&
    Date.now() - catalogRefreshAt < 2500 &&
    opened.joyproxy?.catalog?.loaded &&
    !opened.joyproxy?.catalogLoading
  ) {
    return decorate(opened);
  }
  catalogRefreshAt = Date.now();
  await patchState((s) => {
    s.joyproxy.catalogLoading = true;
    s.joyproxy.catalog = { ...(s.joyproxy.catalog || emptyCatalog()), error: "" };
    return s;
  });
  try {
    const { catalog, extractToken, masterToken, proxyCredentials } = await loadJoyproxyCatalog(jwt);
    const next = await patchState((s) => {
      s.joyproxy.catalogLoading = false;
      s.joyproxy.extractToken = extractToken;
      s.joyproxy.masterToken = masterToken;
      s.joyproxy.proxyUsername = proxyCredentials?.username || "";
      s.joyproxy.proxyPassword = proxyCredentials?.password || "";
      s.joyproxy = pickCatalogDefaults(s.joyproxy, catalog);
      return s;
    });
    refreshJoyproxyGeo(next.joyproxy.network).catch(() => {});
    return decorate(next);
  } catch (err) {
    const next = await patchState((s) => {
      s.joyproxy.catalogLoading = false;
      s.joyproxy.catalog = { ...emptyCatalog(), loaded: true, error: humanizeError(err) };
      logLine(s, "log.catalogFail", errorParams(err), "error");
      return s;
    });
    return decorate(next);
  }
}

export async function refreshJoyproxyGeo() {
  const opened = await loadState();
  let countries = await fetchGeoCountries().catch(() => []);
  if (!countries.length) countries = opened.joyproxy?.catalog?.countries || [];
  const wanted = opened.joyproxy?.countryGeoname || "";
  const country = countries.find((c) => c.id === wanted) || null;
  let tree = { countryId: "", states: [], cities: {} };
  if (country) {
    tree = await fetchGeoCountryTree(country).catch(() => tree);
  }
  const next = await patchState((s) => {
    const catalog = { ...(s.joyproxy.catalog || emptyCatalog()) };
    if (countries.length) catalog.countries = countries;
    if (countries.length && s.joyproxy.countryGeoname && !countries.some((c) => c.id === s.joyproxy.countryGeoname)) {
      s.joyproxy.countryGeoname = "";
      s.joyproxy.stateGeoname = "";
      s.joyproxy.cityGeoname = "";
    }
    if (s.joyproxy.countryGeoname && country && tree.countryId === country.id) {
      catalog.states = tree.states;
      catalog.cities = tree.cities;
      catalog.geoTreeCountry = tree.countryId;
      if (s.joyproxy.stateGeoname && !tree.states.some((st) => st.id === s.joyproxy.stateGeoname)) {
        s.joyproxy.stateGeoname = "";
        s.joyproxy.cityGeoname = "";
      }
    } else {
      catalog.states = [];
      catalog.cities = {};
      catalog.geoTreeCountry = "";
      if (!s.joyproxy.countryGeoname) {
        s.joyproxy.stateGeoname = "";
        s.joyproxy.cityGeoname = "";
      }
    }
    s.joyproxy.catalog = catalog;
    return s;
  });
  return decorate(next);
}

export async function stopOtherRotators(keep) {
  const state = await patchState((s) => {
    if (keep !== "extract" && s.extract.running) {
      s.extract.running = false;
      logLine(s, "log.stopExtractSwitch");
    }
    if (keep !== "joyproxy" && s.joyproxy?.running) {
      s.joyproxy.running = false;
      logLine(s, "log.stopJoySwitch");
    }
    return s;
  });
  return decorate(state);
}

function siteSessionFrom(raw) {
  const token = String(raw?.token || "").trim();
  const email = String(raw?.email || "").trim();
  const username = String(raw?.username || "").trim();
  return {
    token,
    email: email || username,
    username,
  };
}

export async function applySiteSession(raw, opts = {}) {
  const session = siteSessionFrom(raw);
  const cur = await loadState();
  const force = Boolean(opts.force);
  if (!session.token) {
    if (cur.joyproxy.awaitingLogin) return decorate(cur);
    if (!(cur.joyproxy.method === "site" && cur.persona === "purchased" && !cur.joyproxy.ignoreSiteUntilLogin)) {
      return decorate(cur);
    }
  } else if (!force && cur.joyproxy.ignoreSiteUntilLogin && !cur.joyproxy.awaitingLogin) {
    return decorate(cur);
  } else if (
    cur.persona === "purchased" &&
    cur.joyproxy.method === "site" &&
    cur.joyproxy.token === session.token &&
    (!session.email || session.email === cur.joyproxy.email)
  ) {
    if (session.email && session.email !== cur.joyproxy.email) {
      await patchState((s) => {
        s.joyproxy.email = session.email;
        return s;
      });
    }
    if (!cur.joyproxy.catalogLoading) {
      refreshJoyproxyCatalog().catch(() => {});
    }
    return decorate(await loadState());
  }

  const state = await patchState((s) => {
    if (!session.token) {
      if (s.joyproxy.awaitingLogin) return s;
      if (s.joyproxy.method === "site" && s.persona === "purchased" && !s.joyproxy.ignoreSiteUntilLogin) {
        s.persona = "guest";
        s.source = "own";
        s.joyproxy.running = false;
        s.joyproxy.email = "";
        s.joyproxy.method = "";
        s.joyproxy.token = "";
        s.joyproxy.extractToken = "";
        s.joyproxy.masterToken = "";
        s.joyproxy.proxyUsername = "";
        s.joyproxy.proxyPassword = "";
        s.joyproxy.catalogLoading = false;
        s.joyproxy.catalog = emptyCatalog();
        s.joyproxy.rows = [];
        logLine(s, "log.siteLogout");
      }
      return s;
    }
    if (!force && s.joyproxy.ignoreSiteUntilLogin && !s.joyproxy.awaitingLogin) return s;
    if (s.persona === "purchased" && s.joyproxy.method === "site" && s.joyproxy.token === session.token) {
      if (session.email && session.email !== s.joyproxy.email) s.joyproxy.email = session.email;
      return s;
    }
    s.persona = "purchased";
    s.joyproxy.method = "site";
    s.joyproxy.token = session.token;
    s.joyproxy.email = session.email;
    s.joyproxy.running = false;
    s.joyproxy.awaitingLogin = false;
    s.joyproxy.ignoreSiteUntilLogin = false;
    s.joyproxy.catalogLoading = true;
    s.joyproxy.catalog = emptyCatalog();
    if (session.email) logLine(s, "log.signedInEmail", { email: session.email });
    else logLine(s, "log.signedIn");
    return s;
  });
  await refreshBadge(state);
  if (session.token && state.persona === "purchased") {
    refreshJoyproxyCatalog().catch((err) => console.warn("joyproxy catalog", err));
  }
  return decorate(state);
}

async function readSessionFromTab(tabId) {
  try {
    const [got] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        token: localStorage.getItem("joypyroxy_token") || "",
        email: localStorage.getItem("joypyroxy_email") || "",
        username: localStorage.getItem("joypyroxy_username") || "",
      }),
    });
    return got?.result || null;
  } catch {
    return null;
  }
}

export async function joyproxyWebLogin() {
  const pre = await patchState((s) => {
    s.joyproxy.awaitingLogin = true;
    s.joyproxy.ignoreSiteUntilLogin = false;
    logLine(s, "log.openingLogin");
    return s;
  });

  const session = await findSiteSession({ probe: false });
  if (session?.token) return applySiteSession(session, { force: true });

  const url = `${JP_LOGIN}?from=extension`;
  try {
    await chrome.tabs.create({ url });
  } catch (err) {
    console.warn("open login", err);
  }
  return decorate(pre);
}

let siteSyncBusy = false;

export async function syncJoyproxyFromBrowser() {
  if (siteSyncBusy) return getPublicState();
  siteSyncBusy = true;
  try {
    const cur = await loadState();
    const haveToken = Boolean(cur.persona === "purchased" && cur.joyproxy?.token);
    const session = await findSiteSession({ probe: !haveToken });
    if (session?.token) return applySiteSession(session, { force: true });
    if (haveToken && !cur.joyproxy?.catalogLoading) {
      refreshJoyproxyCatalog().catch(() => {});
    }
    return decorate(await loadState());
  } finally {
    siteSyncBusy = false;
  }
}

export async function openJoyproxyDashboard() {
  const url = JP_DASHBOARD;
  try {
    const tabs = await chrome.tabs.query({ url: ["https://www.joyproxy.com/*", "https://joyproxy.com/*"] });
    const hit = tabs.find((t) => /admin-overview\.html/i.test(String(t.url || "")));
    if (hit?.id) {
      await chrome.tabs.update(hit.id, { active: true });
      if (hit.windowId) await chrome.windows.update(hit.windowId, { focused: true });
      return { ok: true };
    }
    await chrome.tabs.create({ url });
    return { ok: true };
  } catch (err) {
    console.warn("open dashboard", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function findSiteSession({ probe = false } = {}) {
  try {
    const tabs = await chrome.tabs.query({ url: ["https://www.joyproxy.com/*", "https://joyproxy.com/*"] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      const session = await readSessionFromTab(tab.id);
      if (session?.token) return session;
    }
  } catch (err) {
    console.warn("read site session", err);
  }
  if (!probe) return null;
  return probeSiteSession();
}

function waitTabComplete(tabId, ms = 12000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab?.status === "complete") finish();
      })
      .catch(finish);
  });
}

async function probeSiteSession() {
  let tabId = 0;
  try {
    const tab = await chrome.tabs.create({ url: JP_LOGIN, active: false });
    tabId = tab?.id || 0;
    if (!tabId) return null;
    await waitTabComplete(tabId);
    let session = await readSessionFromTab(tabId);
    if (session?.token) return session;
    try {
      const live = await chrome.tabs.get(tabId);
      if (live.status !== "complete") {
        await waitTabComplete(tabId, 5000);
        session = await readSessionFromTab(tabId);
        if (session?.token) return session;
      }
    } catch {
      return null;
    }
    await sleep(400);
    return await readSessionFromTab(tabId);
  } catch (err) {
    console.warn("probe site session", err);
    return null;
  } finally {
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function joyproxyLogout() {
  const state = await patchState((s) => {
    s.persona = "guest";
    s.source = "own";
    s.joyproxy.running = false;
    s.joyproxy.email = "";
    s.joyproxy.method = "";
    s.joyproxy.token = "";
    s.joyproxy.extractToken = "";
    s.joyproxy.masterToken = "";
    s.joyproxy.proxyUsername = "";
    s.joyproxy.proxyPassword = "";
    s.joyproxy.awaitingLogin = false;
    s.joyproxy.ignoreSiteUntilLogin = true;
    s.joyproxy.catalogLoading = false;
    s.joyproxy.catalog = emptyCatalog();
    s.joyproxy.rows = [];
    logLine(s, "log.signedOut");
    return s;
  });
  await refreshBadge(state);
  return decorate(state);
}

async function stillJoyRunning() {
  const s = await loadState();
  return Boolean(s.joyproxy?.running);
}

async function dwellJoy(ms) {
  const end = Date.now() + Math.max(0, Number(ms) || 0);
  while (Date.now() < end) {
    if (!(await stillJoyRunning())) return false;
    await sleep(Math.min(250, end - Date.now()));
  }
  return stillJoyRunning();
}

export async function stopJoyproxy() {
  const opened = await loadState();
  const restore = Boolean(
    opened.joyproxy?.running &&
      (opened.joyproxy.mode === "apply" || opened.joyproxy.applySession) &&
      opened.connection?.fromJoyproxy
  );
  await patchState((s) => {
    if (s.joyproxy?.running) {
      s.joyproxy.running = false;
      logLine(s, "log.stopJoy");
    }
    if (s.joyproxy) s.joyproxy.applySession = false;
    return s;
  });
  if (restore) return disconnect();
  return decorate(await loadState());
}

async function failJoyproxy(key, params = {}) {
  const next = await patchState((s) => {
    logLine(s, key, params, "error");
    return s;
  });
  return { ok: false, error: t(key, params), state: decorate(next) };
}

export async function runJoyproxy(opts = {}) {
  let opened = await loadState();
  if (opened.joyproxy?.token && !opened.joyproxy?.extractToken) {
    await refreshJoyproxyCatalog();
    opened = await loadState();
  }
  const jp = opened.joyproxy || {};
  if (!jp.token) return failJoyproxy("err.needLogin");
  if (!jp.extractToken) return failJoyproxy("err.needExtractToken");

  const kind = jp.kind === "static" ? "static" : "dynamic";
  if (kind === "dynamic" && !(jp.catalog?.networks || []).length) {
    return failJoyproxy("err.noDynamic");
  }
  if (kind === "static" && !(jp.catalog?.lines || []).length) {
    return failJoyproxy("err.noStatic");
  }

  const doApply = opts.apply !== undefined ? Boolean(opts.apply) : jp.mode === "apply";
  const once = Boolean(opts.once);
  const timed = !once && kind === "dynamic" && Boolean(jp.timed);
  const intervalMs = timed ? Math.max(0, Number(jp.intervalSec) || 0) * 1000 : 0;
  const count = Number(jp.count) || 0;
  const maxTests = timed ? (count > 0 ? count : Number.POSITIVE_INFINITY) : 1;

  await stopOtherRotators("joyproxy");
  await patchState((s) => {
    s.joyproxy.running = true;
    s.joyproxy.applySession = doApply;
    s.joyproxy.rows = [];
    if (timed && doApply) logLine(s, "log.jpStartTimedApply");
    else if (timed) logLine(s, "log.jpStartTimedTest");
    else if (doApply) logLine(s, "log.jpStartApply");
    else logLine(s, "log.jpStartTest");
    return s;
  });

  const rows = [];
  let okCount = 0;
  let switched = 0;

  try {
    while ((await stillJoyRunning()) && rows.length < maxTests) {
      const fresh = await loadState();
      let extracted;
      try {
        extracted = await extractOneProxy(fresh.joyproxy);
      } catch (err) {
        await patchState((s) => {
          logLine(s, "log.extractFail", errorParams(err, true), "error");
          return s;
        });
        if (!timed) break;
        if (!(await dwellJoy(intervalMs))) break;
        continue;
      }

      const row = {
        id: `j${Date.now()}-${rows.length}`,
        index: rows.length + 1,
        host: extracted.host,
        port: extracted.port,
        protocol: asProto(extracted.protocol || fresh.joyproxy.protocol),
        username: extracted.username || "",
        password: extracted.password || "",
        status: "测试中",
        latency: null,
        note: "",
      };
      rows.push(row);
      await patchState((s) => {
        s.joyproxy.rows = rows.slice(-50);
        logLine(s, "log.extracted", { proxy: shortProxy(extracted) });
        return s;
      });

      if (row.protocol === "socks5" && row.username) {
        await patchState((s) => {
          logLine(s, "log.socksAuth", "warn");
          return s;
        });
      }

      const result = await testProxy(row, { quiet: true, skipRecent: true, fromJoyproxy: true });
      row.status = result.ok ? "成功" : "失败";
      row.latency = result.ok ? result.geo.latency : null;
      row.note = result.ok ? formatIpLine(result.geo.ip, result.geo.country) : result.error;
      row.proxy = result.ok ? result.proxy : { ...extracted, protocol: row.protocol };
      row.geo = result.ok ? result.geo : null;
      await patchState((s) => {
        s.joyproxy.rows = rows.slice(-50);
        if (result.ok) {
          logLine(
            s,
            "log.jpRowOk",
            { n: row.index, proxy: shortProxy(extracted), ms: row.latency, note: row.note },
            "ok"
          );
        } else {
          logLine(
            s,
            "log.jpRowFail",
            { n: row.index, proxy: shortProxy(extracted), detail: result.error },
            "error"
          );
        }
        return s;
      });

      if (!(await stillJoyRunning())) break;

      if (result.ok) {
        okCount += 1;
        if (doApply && (timed || switched === 0)) {
          const applied = await connectProxy(row.proxy, {
            skipTest: true,
            geo: result.geo,
            fromJoyproxy: true,
          });
          if (applied.ok) {
            switched += 1;
            if (!(await stillJoyRunning()) && doApply) {
              await disconnect();
              break;
            }
            if (timed && rows.length < maxTests && !(await dwellJoy(intervalMs))) break;
            continue;
          }
          await patchState((s) => {
            logLine(s, "log.applyFail", { detail: applied.error }, "error");
            return s;
          });
        }
      }

      if (timed && rows.length < maxTests && !(await dwellJoy(intervalMs))) break;
    }

    const total = rows.length;
    const pct = total ? Math.round((okCount / total) * 100) : 0;
    const next = await patchState((s) => {
      s.joyproxy.running = false;
      s.joyproxy.rows = rows.slice(-50);
      if (doApply) logLine(s, "log.doneApply", { ok: okCount, total, pct, switched }, okCount ? "ok" : "warn");
      else logLine(s, "log.doneProbe", { ok: okCount, total, pct }, okCount ? "ok" : "warn");
      return s;
    });
    return { ok: true, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      s.joyproxy.running = false;
      logLine(s, "log.jpFail", errorParams(err, true), "error");
      return s;
    });
    return { ok: false, error: humanizeJoyproxyError(err), state: decorate(next) };
  }
}

export async function refreshRealIp() {
  const state = await loadState();
  try {
    const geo = await fetchGeo(state.settings, 6000);
    const next = await patchState((s) => {
      s.realIp = { ...geo, at: Date.now() };
      return s;
    });
    await refreshBadge(next);
    return decorate(next);
  } catch (err) {
    const next = await patchState((s) => {
      s.realIp = { ip: "", country: "", error: err.message || String(err), at: Date.now() };
      return s;
    });
    return decorate(next);
  }
}

function asProxy(input) {
  if (!input) return null;
  if (input.host && input.port) {
    return {
      host: input.host,
      port: Number(input.port),
      protocol: asProto(input.protocol),
      username: input.username || "",
      password: input.password || "",
    };
  }
  return parseProxyInput(input.raw || "", asProto(input.protocol));
}

async function probeProxy(proxy, connection, settings, opts = {}) {
  const run = (item, authTest = false) =>
    testViaPac(
      item,
      connection,
      settings,
      (s, ms) => fetchGeo(s, ms, { authTest }),
      authTest ? 15000 : 9000
    );
  if (!hasHttpAuth(proxy)) {
    if (opts.fromJoyproxy) {
      throw new Error("extract_missing_auth");
    }
    return { geo: await run(proxy, false), proxy, via: "whitelist" };
  }
  try {
    return { geo: await run(proxy, true), proxy, via: "auth" };
  } catch (authErr) {
    if (opts.fromJoyproxy) throw authErr;
    const bare = { ...proxy, username: "", password: "" };
    try {
      return { geo: await run(bare, false), proxy: bare, via: "whitelist" };
    } catch {
      throw authErr;
    }
  }
}

async function ensureRelayReady(proxy, settings) {
  if (!shouldUseLocalRelay(proxy, settings)) return;
  const ok = await ensureLocalRelay(proxy, settings);
  if (!ok) {
    throw new Error(localRelayRequiredError(proxy, settings, chrome.runtime.id));
  }
}

export async function testProxy(input, opts = {}) {
  const proxy = asProxy(input);
  if (!proxy) {
    return { ok: false, error: t("err.needPaste") };
  }
  if (!opts.quiet && !opts.fromJoyproxy) {
    await stopOtherRotators();
  }
  const state = await loadState();
  await refreshBadge(state, "testing");
  try {
    await ensureRelayReady(proxy, state.settings);
    const probed = await probeProxy(proxy, state.connection, state.settings, opts);
    const used = probed.proxy;
    const geo = probed.geo;
    const next = await patchState((s) => {
      s.lastTest = {
        ok: true,
        proxy: used,
        via: probed.via,
        ...geo,
        at: Date.now(),
      };
      if (!opts.skipRecent) {
        pushRecent(s, {
          ...used,
          latency: geo.latency,
          country: geo.country,
        });
      }
      if (!opts.quiet) {
        logLine(
          s,
          "log.testOk",
          {
            proxy: shortProxy(used),
            ip: geo.ip,
            country: geo.country || "",
            ms: geo.latency,
            howKey: probed.via === "whitelist" && hasHttpAuth(proxy) ? "log.testOkWhitelist" : "",
          },
          "ok"
        );
      } else if (probed.via === "whitelist" && hasHttpAuth(proxy)) {
        logLine(s, "log.testWhitelist", { proxy: shortProxy(used) }, "warn");
      }
      return s;
    });
    await refreshBadge(next);
    return { ok: true, geo, proxy: used, via: probed.via, state: decorate(next) };
  } catch (err) {
    const message = hasHttpAuth(proxy)
      ? chromeProxyAuthHelp(err, proxy, state.settings)
      : humanizeError(err);
    const next = await patchState((s) => {
      s.lastTest = { ok: false, proxy, error: message, at: Date.now() };
      if (!opts.quiet) logLine(s, "log.testFail", { proxy: shortProxy(proxy), detail: message }, "error");
      return s;
    });
    await refreshBadge(next);
    return { ok: false, error: message, proxy, state: decorate(next) };
  }
}

export async function connectProxy(input, opts = {}) {
  let proxy = asProxy(input);
  if (!proxy) return { ok: false, error: t("err.noProxy") };
  if (!opts.fromExtract && !opts.fromJoyproxy) {
    await stopOtherRotators();
  }

  let geo = opts.geo || null;
  if (!opts.skipTest) {
    const pre = await loadState();
    let tested = pre.lastTest;
    const same =
      tested?.ok &&
      tested.proxy?.host === proxy.host &&
      Number(tested.proxy?.port) === Number(proxy.port) &&
      Date.now() - (tested.at || 0) < 60_000;
    if (!same) {
      const result = await testProxy(proxy, {
        fromJoyproxy: Boolean(opts.fromJoyproxy),
        skipRecent: Boolean(opts.fromJoyproxy || opts.fromExtract),
      });
      if (!result.ok) return result;
      tested = result.state.lastTest;
    }
    geo = tested;
    if (tested?.proxy) proxy = tested.proxy;
  }

  return commitConnection(proxy, geo || {}, opts);
}

async function commitConnection(proxy, geo, opts = {}) {
  const state = await loadState();
  if (!state.savedProxySettings) {
    const current = await getProxySettings();
    await patchState((s) => {
      s.savedProxySettings = {
        value: current?.levelOfControl === "controlled_by_this_extension" ? null : current?.value || null,
        capturedAt: Date.now(),
      };
      return s;
    });
  }

  try {
    await applyBrowserProxy(proxy, state.settings);
  } catch (err) {
    return { ok: false, error: humanizeError(err) };
  }

  let verifiedGeo = geo;
  if (hasHttpAuth(proxy)) {
    try {
      await ensureRelayReady(proxy, state.settings);
      await ensureOffscreenDocument();
      await sleep(800);
      verifiedGeo = await verifyAuthTunnel(15000);
    } catch (err) {
      setPendingAuth(null);
      try {
        await clearProxyConfig();
      } catch {
        /* ignore */
      }
      return { ok: false, error: chromeProxyAuthHelp(err, proxy, state.settings) };
    }
  }

  const rolled = hasRandomPrivacy(state.settings.privacy)
    ? resolveLivePrivacy(state.settings.privacy, state.settings)
    : null;
  await applyWebRtc(rolled ? rolled.restrictWebRTC : state.settings.restrictWebRTC);
  await applyHeaderOverrides(rolled || state.settings.privacy);

  const next = await patchState((s) => {
    if (rolled) {
      s.settings.privacy = rolled;
      s.settings.restrictWebRTC = Boolean(rolled.restrictWebRTC);
    }
    s.connection = {
      ...proxy,
      source: opts.fromJoyproxy ? "joyproxy" : "own",
      fromExtract: Boolean(opts.fromExtract),
      fromJoyproxy: Boolean(opts.fromJoyproxy),
      productName: opts.productName || "",
      exitIp: verifiedGeo.ip,
      country: verifiedGeo.country,
      countryCode: verifiedGeo.countryCode || countryCode(verifiedGeo.country),
      latency: verifiedGeo.latency,
      connectedAt: Date.now(),
    };
    s.source = opts.fromJoyproxy ? "joyproxy" : "own";
    const saved = s.profiles.find(
      (p) => p.host === proxy.host && Number(p.port) === Number(proxy.port) && asProto(p.protocol) === asProto(proxy.protocol)
    );
    if (saved) {
      saved.lastResult = "通";
      saved.lastLatency = verifiedGeo?.latency ?? saved.lastLatency;
    }
    pushLog(
      s,
      {
        key: "log.connected",
        params: {
          proxy: shortProxy(proxy),
          geo: formatIpLine(verifiedGeo.ip, verifiedGeo.country, opts.skipTest ? "—" : "?"),
          skipKey: opts.skipTest ? "log.skipTest" : "",
        },
      },
      "ok"
    );
    return s;
  });
  await refreshBadge(next);
  refreshRealIp().catch(() => {});
  return { ok: true, state: decorate(next) };
}

export async function disconnect() {
  await patchState((s) => {
    s.extract.running = false;
    if (s.joyproxy) s.joyproxy.running = false;
    return s;
  });
  setPendingAuth(null);
  try {
    await clearProxyConfig();
  } catch {
    const state = await loadState();
    try {
      await restoreProxy(state.savedProxySettings);
    } catch {
      /* ignore */
    }
  }
  await applyWebRtc(false);
  const next = await patchState((s) => {
    logLine(s, "log.direct");
    s.connection = null;
    return s;
  });
  await refreshBadge(next);
  refreshRealIp().catch(() => {});
  return { ok: true, state: decorate(next) };
}

export async function retestCurrent() {
  const state = await loadState();
  if (!state.connection) return { ok: false, error: t("err.notConnected") };
  return testProxy(state.connection);
}

export async function applyProfile(id) {
  const state = await loadState();
  if (state.extract?.mode === "apply" || state.extract?.mode === "switch") {
    return { ok: false, error: t("err.applyLocked") };
  }
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return { ok: false, error: t("err.profileMissing") };
  await patchState((s) => {
    s.source = "own";
    s.pendingDraft = {
      raw: `${profile.host}:${profile.port}`,
      protocol: asProto(profile.protocol),
      username: profile.username || "",
      password: profile.password || "",
      activeId: profile.id,
    };
    return s;
  });
  return connectProxy(profile);
}

export async function upsertProfile(profile) {
  const state = await patchState((s) => {
    let id = profile.id;
    if (id && s.profiles.some((p) => p.id === id)) {
      s.profiles = s.profiles.map((p) =>
        p.id === id ? { ...p, ...profile, id, protocol: asProto(profile.protocol) } : p
      );
    } else {
      id = `p${Date.now()}`;
      s.profiles.unshift({
        ...profile,
        id,
        protocol: asProto(profile.protocol),
        lastResult: profile.lastResult || "未测",
      });
    }
    s.pendingDraft = {
      ...s.pendingDraft,
      raw: `${profile.host}:${profile.port}`,
      protocol: asProto(profile.protocol),
      username: profile.username || "",
      password: profile.password || "",
      activeId: id,
    };
    logLine(s, "log.savedProxy", { addr: `${profile.host}:${profile.port}` });
    return s;
  });
  return decorate(state);
}

export async function removeProfile(id) {
  const state = await patchState((s) => {
    s.profiles = s.profiles.filter((p) => p.id !== id);
    if (s.pendingDraft.activeId === id) {
      s.pendingDraft = {
        raw: "",
        protocol: "http",
        username: "",
        password: "",
        activeId: "",
      };
    }
    logLine(s, "log.deletedProxy");
    return s;
  });
  return decorate(state);
}

export async function importProfiles(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const added = [];
  const state = await patchState((s) => {
    const have = new Set(s.profiles.map((p) => `${p.host}:${Number(p.port)}`));
    for (const line of lines) {
      const parsed = parseProxyInput(line, "http");
      if (!parsed) continue;
      const key = `${parsed.host}:${Number(parsed.port)}`;
      if (have.has(key)) continue;
      have.add(key);
      added.push({
        id: `p${Date.now()}-${added.length}`,
        name: `${parsed.host}:${parsed.port}`,
        ...parsed,
        lastResult: "未测",
      });
    }
    s.profiles = [...added, ...s.profiles];
    logLine(s, "log.importedProxies", { n: added.length });
    return s;
  });
  return { ok: true, count: added.length, state: decorate(state) };
}

export async function saveExtractConfig(cfg) {
  const next = { ...cfg };
  if (next.mode === "switch") next.mode = "apply";
  const state = await patchState((s) => {
    s.extract = { ...s.extract, ...next, running: s.extract.running };
    return s;
  });
  return decorate(state);
}

function extractFields(extract) {
  return {
    name: (extract.name || "").trim(),
    url: (extract.url || "").trim(),
    regex: extract.regex || "",
    protocol: "http",
    username: extract.username || "",
    password: extract.password || "",
    timed: Boolean(extract.timed),
    count: Number(extract.count) || 0,
    intervalSec: Number(extract.intervalSec) || 0,
    mode: extract.mode === "apply" || extract.mode === "switch" ? "apply" : "probe",
  };
}

function nameFromUrl(url) {
  try {
    return new URL(url).hostname || t("err.unnamedApi");
  } catch {
    return (url || "").slice(0, 40) || t("err.unnamedApi");
  }
}

export async function upsertExtractApi() {
  const current = await loadState();
  const fields = extractFields(current.extract);
  if (!fields.url) return { ok: false, error: t("err.needApiUrl") };
  if (!fields.name) fields.name = nameFromUrl(fields.url);

  const state = await patchState((s) => {
    const list = Array.isArray(s.extractApis) ? s.extractApis : [];
    if (s.extract.activeId) {
      const hit = list.find((a) => a.id === s.extract.activeId);
      if (hit) {
        Object.assign(hit, fields);
        s.extractApis = list;
        s.extract = { ...s.extract, ...fields };
        logLine(s, "log.updatedApi", { name: fields.name });
        return s;
      }
    }
    const same = list.find((a) => (a.url || "").trim() === fields.url);
    if (same) {
      Object.assign(same, fields);
      s.extractApis = list;
      s.extract = { ...s.extract, ...fields, activeId: same.id };
      logLine(s, "log.savedApi", { name: fields.name });
      return s;
    }
    const id = `api${Date.now()}`;
    s.extractApis = [{ id, ...fields }, ...list];
    s.extract = { ...s.extract, ...fields, activeId: id };
    logLine(s, "log.savedApi", { name: fields.name });
    return s;
  });
  return { ok: true, state: decorate(state) };
}

export async function selectExtractApi(id) {
  const state = await patchState((s) => {
    const api = (s.extractApis || []).find((a) => a.id === id);
    if (!api) {
      s.extract.activeId = "";
      return s;
    }
    s.extract = {
      ...s.extract,
      ...extractFields(api),
      activeId: api.id,
      rows: [],
      lastSummary: null,
    };
    return s;
  });
  return decorate(state);
}

export async function newExtractApi() {
  const state = await patchState((s) => {
    s.extract = {
      ...s.extract,
      activeId: "",
      name: "",
      url: "",
      regex: "",
      username: "",
      password: "",
      protocol: "http",
      timed: false,
      count: 0,
      intervalSec: 0,
      rows: [],
      lastSummary: null,
    };
    return s;
  });
  return decorate(state);
}

export async function removeExtractApi(id) {
  const state = await patchState((s) => {
    s.extractApis = (s.extractApis || []).filter((a) => a.id !== id);
    s.extract = {
      ...s.extract,
      activeId: "",
      name: "",
      url: "",
      regex: "",
      username: "",
      password: "",
      protocol: "http",
      timed: false,
      count: 0,
      intervalSec: 0,
      rows: [],
      lastSummary: null,
    };
    logLine(s, "log.deletedApi");
    return s;
  });
  return decorate(state);
}

export async function importExtractApis(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const added = [];
  const state = await patchState((s) => {
    const list = Array.isArray(s.extractApis) ? s.extractApis : [];
    const have = new Set(list.map((a) => (a.url || "").trim()));
    for (const line of lines) {
      let url = line;
      let name = "";
      const httpAt = line.search(/https?:\/\//i);
      if (httpAt > 0) {
        name = line.slice(0, httpAt).trim();
        url = line.slice(httpAt).trim();
      }
      if (!/^https?:\/\//i.test(url)) continue;
      if (have.has(url)) continue;
      have.add(url);
      added.push({
        id: `api${Date.now()}-${added.length}`,
        name: name || nameFromUrl(url),
        url,
        regex: "",
        protocol: "http",
        username: "",
        password: "",
        timed: false,
        count: 0,
        intervalSec: 0,
        mode: "probe",
      });
    }
    s.extractApis = [...added, ...list];
    logLine(s, "log.importedApis", { n: added.length });
    return s;
  });
  return { ok: true, count: added.length, state: decorate(state) };
}

export async function stopExtract() {
  const opened = await loadState();
  const restore = Boolean(
    opened.extract?.running &&
      (opened.extract.mode === "apply" || opened.extract.mode === "switch" || opened.extract.applySession) &&
      opened.connection?.fromExtract
  );
  await patchState((s) => {
    if (s.extract.running) {
      s.extract.running = false;
      logLine(s, "log.stopped");
    }
    s.extract.applySession = false;
    return s;
  });
  if (restore) return disconnect();
  return decorate(await loadState());
}

async function stillRunning() {
  const s = await loadState();
  return Boolean(s.extract.running);
}

async function dwell(ms) {
  const end = Date.now() + Math.max(0, Number(ms) || 0);
  while (Date.now() < end) {
    if (!(await stillRunning())) return false;
    await sleep(Math.min(250, end - Date.now()));
  }
  return stillRunning();
}

async function fetchExtractBatch(extract) {
  const url = (extract.url || "").trim();
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  return extractHostPorts(text, extract.regex);
}

export async function runExtract() {
  const opened = await loadState();
  const url = (opened.extract.url || "").trim();
  if (!url) return { ok: false, error: t("err.needApiUrl") };

  const applyOnOk = opened.extract.mode === "apply" || opened.extract.mode === "switch";
  const timed = Boolean(opened.extract.timed);
  const protocol = asProto(opened.extract.protocol);
  const auth = {
    username: opened.extract.username || "",
    password: opened.extract.password || "",
  };
  const count = Number(opened.extract.count) || 0;
  const intervalMs = timed ? Math.max(0, Number(opened.extract.intervalSec) || 0) * 1000 : 0;
  const maxTests = timed ? (count > 0 ? count : Number.POSITIVE_INFINITY) : 50;

  await stopOtherRotators("extract");
  await patchState((s) => {
    s.extract.running = true;
    s.extract.applySession = applyOnOk;
    s.extract.rows = [];
    if (applyOnOk && timed) logLine(s, "log.exStartTimedApply");
    else if (applyOnOk) logLine(s, "log.exStartApply");
    else if (timed) logLine(s, "log.exStartTimedTest");
    else logLine(s, "log.exStartTest");
    return s;
  });

  const rows = [];
  let okCount = 0;
  let switched = 0;
  let queue = [];
  let refetch = true;

  try {
    while ((await stillRunning()) && rows.length < maxTests) {
      if (!queue.length) {
        if (!refetch) break;
        const fresh = await loadState();
        queue = await fetchExtractBatch(fresh.extract);
        if (!timed) refetch = false;
        if (!queue.length) {
          await patchState((s) => {
            logLine(s, "log.extractEmpty", "error");
            return s;
          });
          break;
        }
        await patchState((s) => {
          logLine(s, "log.extractCount", { n: queue.length });
          return s;
        });
      }

      const item = queue.shift();
      const row = {
        id: `e${Date.now()}-${rows.length}`,
        index: rows.length + 1,
        host: item.host,
        port: item.port,
        protocol,
        username: auth.username,
        password: auth.password,
        status: "测试中",
        latency: null,
        note: "",
      };
      rows.push(row);
      await patchState((s) => {
        s.extract.rows = rows.slice();
        return s;
      });

      const result = await testProxy(
        {
          host: item.host,
          port: item.port,
          protocol,
          username: auth.username,
          password: auth.password,
        },
        { quiet: true }
      );
      row.status = result.ok ? "成功" : "失败";
      row.latency = result.ok ? result.geo.latency : null;
      row.note = result.ok ? formatIpLine(result.geo.ip, result.geo.country) : result.error;
      row.proxy = result.ok
        ? result.proxy
        : { ...item, protocol, username: auth.username, password: auth.password };
      row.geo = result.ok ? result.geo : null;
      await patchState((s) => {
        s.extract.rows = rows.slice();
        if (result.ok) {
          logLine(
            s,
            "log.apiRowOk",
            { n: row.index, addr: `${item.host}:${item.port}`, ms: row.latency, note: row.note },
            "ok"
          );
        } else {
          logLine(
            s,
            "log.apiRowFail",
            { n: row.index, addr: `${item.host}:${item.port}`, detail: result.error },
            "error"
          );
        }
        return s;
      });

      if (!(await stillRunning())) break;

      if (result.ok) {
        okCount += 1;
        if (applyOnOk && (timed || switched === 0)) {
          const applied = await connectProxy(row.proxy, { skipTest: true, geo: result.geo, fromExtract: true });
          if (applied.ok) {
            switched += 1;
            await patchState((s) => {
              logLine(
                s,
                "log.connected",
                {
                  proxy: `${item.host}:${item.port}`,
                  geo: formatIpLine(result.geo.ip, result.geo.country),
                },
                "ok"
              );
              return s;
            });
            if (!(await stillRunning()) && applyOnOk) {
              await disconnect();
              break;
            }
            if (timed && rows.length < maxTests && !(await dwell(intervalMs))) break;
            continue;
          }
          await patchState((s) => {
            logLine(s, "log.applyFail", { detail: applied.error }, "error");
            return s;
          });
        }
      }

      if (timed && rows.length < maxTests && !(await dwell(intervalMs))) break;
    }

    const total = rows.length;
    const pct = total ? Math.round((okCount / total) * 100) : 0;
    const next = await patchState((s) => {
      s.extract.running = false;
      s.extract.rows = rows;
      s.extract.lastSummary = {
        total,
        ok: okCount,
        switched,
        pct,
        mode: applyOnOk ? "apply" : "probe",
        timed,
      };
      if (applyOnOk) logLine(s, "log.doneApply", { ok: okCount, total, pct, switched }, okCount ? "ok" : "warn");
      else logLine(s, "log.doneProbe", { ok: okCount, total, pct }, okCount ? "ok" : "warn");
      return s;
    });
    return { ok: true, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      s.extract.running = false;
      logLine(s, "log.extractFail", errorParams(err), "error");
      return s;
    });
    return { ok: false, error: humanizeError(err), state: decorate(next) };
  }
}

export async function clearLogs() {
  const state = await patchState((s) => {
    s.logs = [];
    return s;
  });
  return decorate(state);
}

const ACTION_POPUP = "src/popup/popup.html";

export async function applyPanelUiMode(mode = "side") {
  const canSide = Boolean(chrome.sidePanel?.setPanelBehavior);
  const useSide = mode === "side" && canSide;
  try {
    if (canSide) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: useSide });
    }
    if (chrome.action?.setPopup) {
      await chrome.action.setPopup({ popup: useSide ? "" : ACTION_POPUP });
    }
  } catch {
    try {
      if (chrome.action?.setPopup) await chrome.action.setPopup({ popup: ACTION_POPUP });
    } catch {
      /* older chrome */
    }
  }
}

let contextMenuInstallSeq = 0;

function installContextMenu() {
  if (!chrome.contextMenus?.create) return;
  const seq = ++contextMenuInstallSeq;
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    if (seq !== contextMenuInstallSeq) return;
    chrome.contextMenus.create(
      {
        id: "joyproxy-test-site",
        title: t("menu.testSite"),
        contexts: ["page", "action"],
      },
      () => {
        void chrome.runtime.lastError;
      }
    );
  });
}

export async function saveSettings(settings) {
  const state = await patchState((s) => {
    const incoming = settings.privacy;
    const privacy = incoming
      ? {
          ...s.settings.privacy,
          ...incoming,
          random: { ...(s.settings.privacy.random || {}), ...(incoming.random || {}) },
        }
      : s.settings.privacy;
    s.settings = { ...s.settings, ...settings, privacy };
    return s;
  });
  if (settings.panelMode !== undefined) {
    await applyPanelUiMode(state.settings.panelMode);
  }
  if (settings.uiLocale !== undefined) {
    installContextMenu();
    await refreshBadge(state);
  }
  if (state.connection) {
    await applyBrowserProxy(state.connection, state.settings);
  }
  await applyWebRtc(state.settings.restrictWebRTC);
  await applyHeaderOverrides(state.settings.privacy);
  return decorate(state);
}

export async function savePrivacy(privacy) {
  return saveSettings({ privacy });
}

export async function runSiteCleanup(kind) {
  const tab = await findHttpTab();
  try {
    if (kind === "cookies") {
      const origin = await clearSiteCookies(tab);
      return logCleanup("log.cleanedCookies", { origin });
    }
    if (kind === "site") {
      const origin = await clearSiteData(tab);
      return logCleanup("log.cleanedSite", { origin });
    }
    if (kind === "cookies-all") {
      await clearAllCookies();
      return logCleanup("log.cleanedAllCookies");
    }
    if (kind === "cache") {
      await clearCache();
      return logCleanup("log.cleanedCache");
    }
    return { ok: false, error: t("err.unknown") };
  } catch (err) {
    const next = await patchState((s) => {
      logLine(s, "log.cleanFail", errorParams(err), "error");
      return s;
    });
    return { ok: false, error: humanizeError(err), state: decorate(next) };
  }
}

async function logCleanup(key, params = {}) {
  const next = await patchState((s) => {
    logLine(s, key, params, "ok");
    return s;
  });
  return { ok: true, state: decorate(next) };
}

export async function restorePreviousProxy() {
  return disconnect();
}

export async function testCurrentSite(url) {
  const host = safeHost(url);
  const state = await loadState();
  if (!state.connection) {
    const next = await patchState((s) => {
      logLine(s, "log.testSiteDirect", { host: host || url }, "warn");
      return s;
    });
    return { ok: false, error: t("err.needProxyFirst"), state: decorate(next) };
  }
  const started = Date.now();
  try {
    const res = await fetchThroughOffscreen(url, 8000, { method: "HEAD" });
    const ms = Date.now() - started;
    const next = await patchState((s) => {
      logLine(s, "log.testSiteOk", { host, status: res.status, ms });
      return s;
    });
    return { ok: true, status: res.status, latency: ms, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      logLine(s, "log.testSiteFail", errorParams(err, { host }), "error");
      return s;
    });
    return { ok: false, error: humanizeError(err), state: decorate(next) };
  }
}

export async function refreshBadge(state, phase) {
  const s = state || (await loadState());
  const connected = Boolean(s.connection);
  const failed = s.lastTest && s.lastTest.ok === false && Date.now() - s.lastTest.at < 8000;

  if (phase === "testing" && !connected) {
    await setActionAppearance({
      variant: "gray",
      badge: "..",
      color: "#64748b",
      title: t("badge.testing"),
    });
    return;
  }
  if (failed && !connected) {
    await setActionAppearance({
      variant: "color",
      badge: "!",
      color: "#ef4444",
      title: t("badge.fail", { detail: s.lastTest.error || "" }).trim(),
    });
    return;
  }
  if (!connected) {
    const title = s.realIp?.ip ? t("badge.directIp", { ip: s.realIp.ip }) : t("badge.direct");
    await setActionAppearance({
      variant: "gray",
      badge: "",
      title,
    });
    return;
  }
  const cc = (s.connection.countryCode || countryCode(s.connection.country) || "ON").slice(0, 4);
  const ms = s.connection.latency ? `${s.connection.latency}ms` : "";
  await setActionAppearance({
    variant: "color",
    badge: cc,
    color: "#6366f1",
    title: t("badge.proxy", {
      ip: s.connection.exitIp || s.connection.host,
      country: s.connection.country || "",
      ms,
    }).trim(),
  });
}

function geoErrorParts(err) {
  const msg = err?.message || String(err || "");
  if (/abort/i.test(msg)) return { detailKey: "err.timeout" };
  if (/ECONNREFUSED|connection refused|127\.0\.0\.1:17890|127\.0\.0\.1/i.test(msg)) {
    return { detailKey: "err.relayDown" };
  }
  if (/TUNNEL|ERR_TUNNEL/i.test(msg)) return { detailKey: "err.tunnel" };
  if (/Failed to fetch|NetworkError|net::|407|ERR_PROXY|PROXY|showing error page|chrome-error/i.test(msg)) {
    return { detailKey: "err.fetch" };
  }
  if (/检测通道 HTTP 5\d\d|lookup channel HTTP 5\d\d/i.test(msg)) return { detailKey: "err.geo5xx" };
  if (/extract_missing_auth|提取结果缺少账密/i.test(msg)) return { detailKey: "err.extractNoAuth" };
  if (/检测通道未返回内容/i.test(msg)) return { detailKey: "err.geoEmpty" };
  if (/检测通道未返回 IP/i.test(msg)) return { detailKey: "err.geoNoIp" };
  if (/检测通道返回失败/i.test(msg)) return { detailKey: "err.geoFail" };
  if (/请先填写自定义检测地址/i.test(msg)) return { detailKey: "err.geoCustom" };
  if (/登录已过期/i.test(msg)) return { detailKey: "err.loginExpired" };
  if (/无法读取 API 令牌|缺少提取令牌/i.test(msg)) return { detailKey: "err.jpNoToken" };
  if (/创建账密失败/i.test(msg)) return { detailKey: "err.createCreds" };
  if (/请先打开一个 http/i.test(msg)) return { detailKey: "err.needHttpTab" };
  if (/不支持清理 Cookie/i.test(msg)) return { detailKey: "err.noCookieApi" };
  if (/后台无响应/i.test(msg)) return { detailKey: "err.swGone" };
  if (/请求失败/i.test(msg)) return { detailKey: "err.requestFail" };
  if (!msg) return { detailKey: "err.unknown" };
  return { detailKey: "err.raw", msg };
}

function joyErrorParts(err) {
  const key = String(err?.message || err || "").toLowerCase();
  if (key.includes("all_short_orders_inactive")) return { detailKey: "err.jpInactive" };
  if (key.includes("short_traffic_exhausted")) return { detailKey: "err.jpTraffic" };
  if (key.includes("no_short_orders") || key.includes("no_orders_for_network")) return { detailKey: "err.jpNoOrders" };
  if (key.includes("proxy_credentials_required")) return { detailKey: "err.jpCreds" };
  if (key.includes("no_extract_token")) return { detailKey: "err.jpNoToken" };
  if (key.includes("no_ip_for_network")) return { detailKey: "err.jpNoIp" };
  if (key.includes("insufficient") || key.includes("traffic")) return { detailKey: "err.jpInsufficient" };
  return geoErrorParts(err);
}

function errorParams(err, extra = {}) {
  const joy = extra === true || extra.joy;
  const rest = extra === true ? {} : { ...extra };
  delete rest.joy;
  return { ...(joy ? joyErrorParts(err) : geoErrorParts(err)), ...rest };
}

function authProxyFailure(err, proxy) {
  const msg = String(err?.message || err || "");
  if (!hasHttpAuth(proxy)) return humanizeError(err);
  if (/abort|超时|timeout|timed out|TUNNEL|ERR_TUNNEL|407|检测通道|lookup channel|Failed to fetch|net::/i.test(msg)) {
    return t("err.authNo407");
  }
  return humanizeError(err);
}

function chromeProxyAuthHelp(err, proxy, settings) {
  const raw = String(err?.message || err || "");
  if (shouldUseLocalRelay(proxy, settings)) {
    if (/本地转发未启动|Local relay is not running/i.test(raw)) return raw;
    if (/refused|17890|LOCAL_RELAY/i.test(raw)) {
      return localRelayRequiredError(proxy, settings, chrome.runtime.id);
    }
    return t("err.relayRetry", { detail: humanizeError(err) });
  }
  return authProxyFailure(err, proxy);
}

function humanizeError(err) {
  const p = geoErrorParts(err);
  return t(p.detailKey, p);
}

function humanizeJoyproxyError(err) {
  const p = joyErrorParts(err);
  return t(p.detailKey, p);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function initBackground() {
  installAuthHandler();
  installPrivacyInjection();
  applyPanelUiMode("side").catch(() => {});
  loadState()
    .then((s) => {
      installContextMenu();
      return applyPanelUiMode(s.settings?.panelMode || "side");
    })
    .catch(() => applyPanelUiMode("side"));
  chrome.runtime.onInstalled.addListener(() => {
    installContextMenu();
    loadState()
      .then((s) => applyPanelUiMode(s.settings?.panelMode || "side"))
      .catch(() => applyPanelUiMode("side"));
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "joyproxy-test-site" && tab?.url) {
      testCurrentSite(tab.url);
    }
  });
  chrome.runtime.onStartup?.addListener(() => {
    refreshBadge();
    refreshRealIp();
    loadState()
      .then((s) => {
        applyPanelUiMode(s.settings?.panelMode || "side");
        return applyHeaderOverrides(s.settings.privacy);
      })
      .catch(() => {});
  });
  refreshBadge();
  refreshRealIp();
  loadState().then((s) => applyHeaderOverrides(s.settings.privacy)).catch(() => {});
}
