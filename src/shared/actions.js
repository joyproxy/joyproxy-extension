import { fetchGeo, countryCode, formatIpLine } from "./geo.js";
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
  loadJoyproxyCatalog,
} from "./joyproxy-api.js";
import {
  applyBrowserProxy,
  getProxySettings,
  installAuthHandler,
  restoreProxy,
  setPendingAuth,
  testViaPac,
} from "./proxy-settings.js";
import { setActionAppearance } from "./icons.js";
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
  const state = await patchState((s) => {
    s.joyproxy = { ...s.joyproxy, ...prefs };
    return s;
  });
  if (prefs.network && prefs.network !== prev.joyproxy?.network) {
    refreshJoyproxyGeo(prefs.network).catch(() => {});
  }
  return decorate(state);
}

function pickCatalogDefaults(jp, catalog) {
  const next = { ...jp, catalog };
  if (next.kind === "dynamic" && !catalog.networks.length && catalog.lines.length) next.kind = "static";
  if (next.kind === "static" && !catalog.lines.length && catalog.networks.length) next.kind = "dynamic";
  if (catalog.networks.length && !catalog.networks.includes(next.network)) next.network = catalog.networks[0];
  if (catalog.lines.length && !catalog.lines.some((l) => l.id === next.selectedId)) next.selectedId = catalog.lines[0].id;
  if (next.countryGeoname && !(catalog.countries || []).some((c) => c.id === next.countryGeoname)) {
    next.countryGeoname = "";
  }
  return next;
}

export async function refreshJoyproxyCatalog() {
  const opened = await loadState();
  const jwt = opened.joyproxy?.token;
  if (!jwt) return decorate(opened);
  await patchState((s) => {
    s.joyproxy.catalogLoading = true;
    s.joyproxy.catalog = { ...(s.joyproxy.catalog || emptyCatalog()), error: "" };
    return s;
  });
  try {
    const { catalog, extractToken, masterToken } = await loadJoyproxyCatalog(jwt);
    const next = await patchState((s) => {
      s.joyproxy.catalogLoading = false;
      s.joyproxy.extractToken = extractToken;
      s.joyproxy.masterToken = masterToken;
      s.joyproxy = pickCatalogDefaults(s.joyproxy, catalog);
      return s;
    });
    refreshJoyproxyGeo(next.joyproxy.network).catch(() => {});
    return decorate(next);
  } catch (err) {
    const next = await patchState((s) => {
      s.joyproxy.catalogLoading = false;
      s.joyproxy.catalog = { ...emptyCatalog(), loaded: true, error: humanizeError(err) };
      pushLog(s, `JoyProxy 产品列表失败：${humanizeError(err)}`, "error");
      return s;
    });
    return decorate(next);
  }
}

export async function refreshJoyproxyGeo(network) {
  const opened = await loadState();
  const token = opened.joyproxy?.extractToken;
  if (!token) return decorate(opened);
  const countries = await fetchGeoCountries(token, network || opened.joyproxy.network).catch(() => []);
  const next = await patchState((s) => {
    s.joyproxy.catalog = { ...(s.joyproxy.catalog || emptyCatalog()), countries };
    if (s.joyproxy.countryGeoname && !countries.some((c) => c.id === s.joyproxy.countryGeoname)) {
      s.joyproxy.countryGeoname = "";
    }
    return s;
  });
  return decorate(next);
}

export async function stopOtherRotators(keep) {
  const state = await patchState((s) => {
    if (keep !== "extract" && s.extract.running) {
      s.extract.running = false;
      pushLog(s, "已停止 API 测试（改为其他更换方式）");
    }
    if (keep !== "joyproxy" && s.joyproxy?.running) {
      s.joyproxy.running = false;
      pushLog(s, "已停止 JoyProxy 定时更换");
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
    if (!cur.joyproxy.catalog?.loaded && !cur.joyproxy.catalogLoading) {
      refreshJoyproxyCatalog().catch(() => {});
    }
    return decorate(cur);
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
        s.joyproxy.catalogLoading = false;
        s.joyproxy.catalog = emptyCatalog();
        s.joyproxy.rows = [];
        pushLog(s, "网站已退出，扩展已同步退出");
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
    pushLog(s, session.email ? `已登录 ${session.email}` : "已登录 JoyProxy");
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
    pushLog(s, "正在打开 JoyProxy 登录页，登录成功后会自动同步到扩展");
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
    if (haveToken && !cur.joyproxy?.catalog?.loaded && !cur.joyproxy?.catalogLoading) {
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
    s.joyproxy.awaitingLogin = false;
    s.joyproxy.ignoreSiteUntilLogin = true;
    s.joyproxy.catalogLoading = false;
    s.joyproxy.catalog = emptyCatalog();
    s.joyproxy.rows = [];
    pushLog(s, "已退出 JoyProxy");
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
      pushLog(s, "已停止 JoyProxy 更换");
    }
    if (s.joyproxy) s.joyproxy.applySession = false;
    return s;
  });
  if (restore) return disconnect();
  return decorate(await loadState());
}

async function failJoyproxy(error) {
  const next = await patchState((s) => {
    pushLog(s, error, "error");
    return s;
  });
  return { ok: false, error, state: decorate(next) };
}

export async function runJoyproxy(opts = {}) {
  let opened = await loadState();
  if (opened.joyproxy?.token && !opened.joyproxy?.extractToken) {
    await refreshJoyproxyCatalog();
    opened = await loadState();
  }
  const jp = opened.joyproxy || {};
  if (!jp.token) return failJoyproxy("请先登录 JoyProxy");
  if (!jp.extractToken) return failJoyproxy("缺少提取令牌，请刷新后再试");

  const kind = jp.kind === "static" ? "static" : "dynamic";
  if (kind === "dynamic" && !(jp.catalog?.networks || []).length) {
    return failJoyproxy("没有可用的动态产品");
  }
  if (kind === "static" && !(jp.catalog?.lines || []).length) {
    return failJoyproxy("没有可用的静态线路");
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
    if (timed && doApply) pushLog(s, "开始 JoyProxy 定时更换：仅测试成功后才会写入");
    else if (timed) pushLog(s, "开始 JoyProxy 定时测试：不改变浏览器代理");
    else if (doApply) pushLog(s, "开始 JoyProxy 测试并设为代理：不通则保持当前设置");
    else pushLog(s, "开始 JoyProxy 测试：不改变浏览器代理");
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
          pushLog(s, `提取失败：${humanizeJoyproxyError(err)}`, "error");
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
        pushLog(s, `已提取 ${shortProxy(extracted)}`);
        return s;
      });

      if (row.protocol === "socks5" && row.username) {
        await patchState((s) => {
          pushLog(s, "SOCKS5 带账密时 Chrome 无法代填，建议改用 HTTP", "warn");
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
          pushLog(s, `JoyProxy #${row.index} ${shortProxy(extracted)} 成功 ${row.latency}ms · ${row.note}`, "ok");
        } else {
          pushLog(s, `JoyProxy #${row.index} ${shortProxy(extracted)} 失败 · ${result.error}`, "error");
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
            pushLog(s, `测试通过但未写入浏览器：${applied.error}`, "error");
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
      const rate = `连通率 ${okCount}/${total}（${pct}%）`;
      if (doApply) pushLog(s, `结束：${rate}，设为代理 ${switched} 次`, okCount ? "ok" : "warn");
      else pushLog(s, `结束：${rate}，未改变浏览器代理`, okCount ? "ok" : "warn");
      return s;
    });
    return { ok: true, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      s.joyproxy.running = false;
      pushLog(s, `JoyProxy 失败：${humanizeJoyproxyError(err)}`, "error");
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

export async function testProxy(input, opts = {}) {
  const proxy = asProxy(input);
  if (!proxy) {
    return { ok: false, error: "请粘贴 host:port 或完整代理链接" };
  }
  if (!opts.quiet && !opts.fromJoyproxy) {
    await stopOtherRotators();
  }
  const state = await loadState();
  await refreshBadge(state, "testing");
  try {
    const geo = await testViaPac(
      proxy,
      state.connection,
      state.settings,
      fetchGeo,
      9000
    );
    const next = await patchState((s) => {
      s.lastTest = {
        ok: true,
        proxy,
        ...geo,
        at: Date.now(),
      };
      if (!opts.skipRecent) {
        pushRecent(s, {
          ...proxy,
          latency: geo.latency,
          country: geo.country,
        });
      }
      if (!opts.quiet) {
        pushLog(
          s,
          `测试成功 ${shortProxy(proxy)} · ${geo.ip} · ${geo.country || ""} · ${geo.latency}ms`,
          "ok"
        );
      }
      return s;
    });
    await refreshBadge(next);
    return { ok: true, geo, proxy, state: decorate(next) };
  } catch (err) {
    const message = humanizeError(err);
    const next = await patchState((s) => {
      s.lastTest = { ok: false, proxy, error: message, at: Date.now() };
      if (!opts.quiet) pushLog(s, `测试失败 ${shortProxy(proxy)} · ${message}`, "error");
      return s;
    });
    await refreshBadge(next);
    return { ok: false, error: message, proxy, state: decorate(next) };
  }
}

export async function connectProxy(input, opts = {}) {
  const proxy = asProxy(input);
  if (!proxy) return { ok: false, error: "没有可连接的代理" };
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
      exitIp: geo.ip,
      country: geo.country,
      countryCode: geo.countryCode || countryCode(geo.country),
      latency: geo.latency,
      connectedAt: Date.now(),
    };
    s.source = opts.fromJoyproxy ? "joyproxy" : "own";
    const saved = s.profiles.find(
      (p) => p.host === proxy.host && Number(p.port) === Number(proxy.port) && asProto(p.protocol) === asProto(proxy.protocol)
    );
    if (saved) {
      saved.lastResult = "通";
      saved.lastLatency = geo?.latency ?? saved.lastLatency;
    }
    pushLog(s, `已设为代理 ${shortProxy(proxy)} · ${formatIpLine(geo.ip, geo.country, "?")}`, "ok");
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
  const state = await loadState();
  await restoreProxy(state.savedProxySettings);
  setPendingAuth(null);
  await applyWebRtc(false);
  const next = await patchState((s) => {
    pushLog(s, "已恢复浏览器直连");
    s.connection = null;
    return s;
  });
  await refreshBadge(next);
  refreshRealIp().catch(() => {});
  return { ok: true, state: decorate(next) };
}

export async function retestCurrent() {
  const state = await loadState();
  if (!state.connection) return { ok: false, error: "当前未连接" };
  return testProxy(state.connection);
}

export async function applyProfile(id) {
  const state = await loadState();
  if (state.extract?.mode === "apply" || state.extract?.mode === "switch") {
    return { ok: false, error: "当前为「测通后设为代理」，请先改回「仅测试」" };
  }
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return { ok: false, error: "保存的代理不存在" };
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
    pushLog(s, `已保存 ${profile.host}:${profile.port}`);
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
    pushLog(s, "已删除保存的代理");
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
    pushLog(s, `导入 ${added.length} 条代理`);
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
    protocol: asProto(extract.protocol),
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
    return new URL(url).hostname || "未命名 API";
  } catch {
    return (url || "").slice(0, 40) || "未命名 API";
  }
}

export async function upsertExtractApi() {
  const current = await loadState();
  const fields = extractFields(current.extract);
  if (!fields.url) return { ok: false, error: "请填写 API 地址" };
  if (!fields.name) fields.name = nameFromUrl(fields.url);

  const state = await patchState((s) => {
    const list = Array.isArray(s.extractApis) ? s.extractApis : [];
    if (s.extract.activeId) {
      const hit = list.find((a) => a.id === s.extract.activeId);
      if (hit) {
        Object.assign(hit, fields);
        s.extractApis = list;
        s.extract = { ...s.extract, ...fields };
        pushLog(s, `已更新 API「${fields.name}」`);
        return s;
      }
    }
    const same = list.find((a) => (a.url || "").trim() === fields.url);
    if (same) {
      Object.assign(same, fields);
      s.extractApis = list;
      s.extract = { ...s.extract, ...fields, activeId: same.id };
      pushLog(s, `已保存 API「${fields.name}」`);
      return s;
    }
    const id = `api${Date.now()}`;
    s.extractApis = [{ id, ...fields }, ...list];
    s.extract = { ...s.extract, ...fields, activeId: id };
    pushLog(s, `已保存 API「${fields.name}」`);
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
    pushLog(s, "已删除 API");
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
    pushLog(s, `导入 ${added.length} 条 API`);
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
      pushLog(s, "已停止");
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
  if (!url) return { ok: false, error: "请填写 API 地址" };

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
    if (applyOnOk && timed) pushLog(s, "开始定时更换浏览器代理：仅测试成功后才会写入");
    else if (applyOnOk) pushLog(s, "开始测试并设为代理：不通则保持当前设置");
    else if (timed) pushLog(s, "开始定时测试：不改变浏览器代理");
    else pushLog(s, "开始测试：只统计连通率，不改变浏览器代理");
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
            pushLog(s, "提取接口没有返回 host:port", "error");
            return s;
          });
          break;
        }
        await patchState((s) => {
          pushLog(s, `提取到 ${queue.length} 条`);
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
          pushLog(
            s,
            `API #${row.index} ${item.host}:${item.port} 成功 ${row.latency}ms · ${row.note}`,
            "ok"
          );
        } else {
          pushLog(s, `API #${row.index} ${item.host}:${item.port} 失败 · ${result.error}`, "error");
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
              pushLog(
                s,
                `已设为代理 ${item.host}:${item.port} · ${formatIpLine(result.geo.ip, result.geo.country)}`,
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
            pushLog(s, `测试通过但未写入浏览器：${applied.error}`, "error");
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
      const rate = `连通率 ${okCount}/${total}（${pct}%）`;
      if (applyOnOk) pushLog(s, `结束：${rate}，设为代理 ${switched} 次`, okCount ? "ok" : "warn");
      else pushLog(s, `结束：${rate}，未改变浏览器代理`, okCount ? "ok" : "warn");
      return s;
    });
    return { ok: true, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      s.extract.running = false;
      pushLog(s, `提取失败：${humanizeError(err)}`, "error");
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
      return logCleanup(`已清理 ${origin} 的 Cookie`);
    }
    if (kind === "site") {
      const origin = await clearSiteData(tab);
      return logCleanup(`已清理 ${origin} 的 Cookie、本地存储与缓存`);
    }
    if (kind === "cookies-all") {
      await clearAllCookies();
      return logCleanup("已清理全部 Cookie");
    }
    if (kind === "cache") {
      await clearCache();
      return logCleanup("已清理浏览器缓存");
    }
    return { ok: false, error: "未知清理类型" };
  } catch (err) {
    const message = humanizeError(err);
    const next = await patchState((s) => {
      pushLog(s, `清理失败：${message}`, "error");
      return s;
    });
    return { ok: false, error: message, state: decorate(next) };
  }
}

async function logCleanup(text) {
  const next = await patchState((s) => {
    pushLog(s, text, "ok");
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
      pushLog(s, `「测试此站」${host || url}：当前直连，请先连接代理`, "warn");
      return s;
    });
    return { ok: false, error: "请先连接代理", state: decorate(next) };
  }
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ms = Date.now() - started;
    const next = await patchState((s) => {
      pushLog(s, `当前站 ${host} → ${res.status} · ${ms}ms`);
      return s;
    });
    return { ok: true, status: res.status, latency: ms, state: decorate(next) };
  } catch (err) {
    const next = await patchState((s) => {
      pushLog(s, `当前站 ${host} 失败：${humanizeError(err)}`, "error");
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
      title: "JoyProxy · 测试中",
    });
    return;
  }
  if (failed && !connected) {
    await setActionAppearance({
      variant: "color",
      badge: "!",
      color: "#ef4444",
      title: `JoyProxy · 失败 ${s.lastTest.error || ""}`.trim(),
    });
    return;
  }
  if (!connected) {
    const ip = s.realIp?.ip ? ` 真实 IP ${s.realIp.ip}` : "";
    await setActionAppearance({
      variant: "gray",
      badge: "",
      title: `JoyProxy · 直连${ip}`,
    });
    return;
  }
  const cc = (s.connection.countryCode || countryCode(s.connection.country) || "ON").slice(0, 4);
  await setActionAppearance({
    variant: "color",
    badge: cc,
    color: "#6366f1",
    title: `浏览器代理 ${s.connection.exitIp || s.connection.host} ${s.connection.country || ""} ${
      s.connection.latency ? s.connection.latency + "ms" : ""
    }`.trim(),
  });
}

function humanizeError(err) {
  const msg = err?.message || String(err || "未知错误");
  if (/abort/i.test(msg)) return "超时，代理未响应";
  if (/Failed to fetch|NetworkError|net::/i.test(msg)) return "连不上检测通道（代理可能无效）";
  return msg;
}

function humanizeJoyproxyError(err) {
  const msg = humanizeError(err);
  const key = String(msg || "").toLowerCase();
  if (key.includes("all_short_orders_inactive")) return "动态流量包已失效或用尽，请在网站续费或重新购买";
  if (key.includes("short_traffic_exhausted")) return "动态流量已用尽";
  if (key.includes("no_short_orders") || key.includes("no_orders_for_network")) return "没有可用的动态流量包，请换网络类型或先在网站购买";
  if (key.includes("proxy_credentials_required")) return "当前格式需要账密，请改用 HTTP 提取";
  if (key.includes("no_extract_token")) return "缺少 API 令牌，请重新登录";
  if (key.includes("insufficient") || key.includes("traffic")) return "流量不足";
  if (key.includes("no_ip_for_network")) return "该网络类型当前没有可分配的 IP，请换国家或稍后重试";
  return msg;
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
  try {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
  } catch {
    /* older chrome */
  }
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "joyproxy-test-site",
        title: "用当前代理测试此站",
        contexts: ["page", "action"],
      });
    });
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "joyproxy-test-site" && tab?.url) {
      testCurrentSite(tab.url);
    }
  });
  chrome.runtime.onStartup?.addListener(() => {
    refreshBadge();
    refreshRealIp();
    loadState().then((s) => applyHeaderOverrides(s.settings.privacy)).catch(() => {});
  });
  refreshBadge();
  refreshRealIp();
  loadState().then((s) => applyHeaderOverrides(s.settings.privacy)).catch(() => {});
}
