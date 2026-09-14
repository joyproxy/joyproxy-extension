import { parseProxyInput } from "./parse.js";

export const JP_LOGIN = "https://www.joyproxy.com/login.html";
export const JP_SITE = "https://www.joyproxy.com";
export const JP_API = "https://api.joyproxy.com";
export const JP_DASHBOARD = "https://www.joyproxy.com/admin-overview.html";

export const JP_DURATIONS = [
  ["1m", "jp.dur.1m"],
  ["2m", "jp.dur.2m"],
  ["3m", "jp.dur.3m"],
  ["5m", "jp.dur.5m"],
  ["10m", "jp.dur.10m"],
  ["15m", "jp.dur.15m"],
  ["30m", "jp.dur.30m"],
];

export const JP_STICKY_MIN = 1;
export const JP_STICKY_MAX = 30;

export function normalizeJoyDuration(raw, sessionType = "sticky") {
  if (sessionType === "rotating") return "";
  const s = String(raw || "").trim().toLowerCase();
  if (s === "30s") return "1m";
  if (/^\d+m$/.test(s)) {
    const n = Math.min(JP_STICKY_MAX, Math.max(JP_STICKY_MIN, parseInt(s, 10) || 1));
    return `${n}m`;
  }
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) {
    const mins = s.endsWith("s") ? Math.max(1, Math.round(n / 60)) : n;
    return `${Math.min(JP_STICKY_MAX, Math.max(JP_STICKY_MIN, mins))}m`;
  }
  return "1m";
}

export function snapJoyDuration(raw, sessionType = "sticky") {
  const n = normalizeJoyDuration(raw, sessionType);
  if (!n) return "";
  if (JP_DURATIONS.some(([id]) => id === n)) return n;
  const mins = parseInt(n, 10) || 1;
  let best = JP_DURATIONS[0][0];
  let bestDiff = Infinity;
  for (const [id] of JP_DURATIONS) {
    const d = Math.abs((parseInt(id, 10) || 0) - mins);
    if (d < bestDiff) {
      best = id;
      bestDiff = d;
    }
  }
  return best;
}

export function joySessionType(raw) {
  return raw === "rotating" ? "rotating" : "sticky";
}

export const JP_NETWORKS = [
  ["residential", "jp.net.residential"],
  ["cellular", "jp.net.mobile"],
  ["business", "jp.net.business"],
  ["hosting", "jp.net.datacenter"],
];

export function emptyCatalog() {
  return { loaded: false, networks: [], lines: [], countries: [], states: [], cities: {}, geoTreeCountry: "", error: "" };
}

export function normNetwork(raw) {
  const s = String(raw || "residential").toLowerCase();
  if (s === "cellular" || s === "mobile") return "cellular";
  if (s === "business" || s === "isp" || s === "enterprise") return "business";
  if (s === "datacenter" || s === "dc" || s === "hosting" || s === "data-center") return "hosting";
  return "residential";
}

export function networkLabelKey(raw) {
  const n = normNetwork(raw);
  if (n === "cellular") return "jp.net.mobile";
  if (n === "hosting") return "jp.net.datacenter";
  if (n === "business") return "jp.net.business";
  return "jp.net.residential";
}

export function orderKind(order) {
  const t = String(order?.product_type || order?.product_id || "").toLowerCase();
  if (t.includes("custom")) return "custom";
  if (t.includes("long")) return "static";
  if (t.includes("short") || t.includes("rotat")) return "dynamic";
  return "";
}

export function extractNetworkQuery(raw) {
  const n = normNetwork(raw);
  return n === "residential" ? "" : n;
}

function authHeaders(jwt) {
  return { Authorization: `Bearer ${jwt}`, Accept: "application/json" };
}

function isHtmlBody(text) {
  const s = String(text || "").trim().slice(0, 80).toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html") || s.startsWith("<head") || s.startsWith("<body");
}

async function readJson(res) {
  const text = await res.text();
  if (isHtmlBody(text)) {
    return { success: false, _html: true, error: `接口未返回数据（HTTP ${res.status}）` };
  }
  try {
    return JSON.parse(text);
  } catch {
    const msg = String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    return { success: false, error: msg || `无法解析接口响应（HTTP ${res.status}）` };
  }
}

async function jwtTry(path, jwt, init = {}) {
  const origins = path.startsWith("/v1/") || path.startsWith("/v2/") ? [JP_API, JP_SITE] : [JP_SITE, JP_API];
  let lastError = "";
  for (const origin of origins) {
    try {
      const res = await fetch(`${origin}${path}`, {
        cache: "no-store",
        ...init,
        headers: { ...authHeaders(jwt), ...(init.headers || {}) },
      });
      const data = await readJson(res);
      if (data?._html) {
        lastError = data.error;
        continue;
      }
      if (res.status === 401) throw new Error("登录已过期，请重新登录");
      return { res, data };
    } catch (err) {
      if (String(err?.message || "").includes("登录已过期")) throw err;
      lastError = err?.message || lastError;
    }
  }
  return { res: null, data: { success: false, error: lastError || "无法连接 JoyProxy 接口" } };
}

function randomJoyproxyUsername() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "jp_";
  for (let i = 0; i < 8; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomJoyproxyPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function pickPrimaryCredential(rows) {
  return (rows || []).find(
    (c) => c && !c.is_ai_managed && String(c.username || "").trim() && String(c.password || "").trim()
  );
}

function credentialFromApiRow(row) {
  if (!row?.username) return null;
  return {
    username: String(row.username).trim(),
    password: String(row.password || "").trim(),
  };
}

export async function fetchProxyCredentials(jwt) {
  const got = await jwtTry("/api/credentials/list", jwt);
  if (!got.data?.success) return null;
  return credentialFromApiRow(pickPrimaryCredential(got.data.credentials));
}

export async function createProxyCredentials(jwt, opts = {}) {
  const username = String(opts.username || randomJoyproxyUsername()).trim();
  const password = String(opts.password || randomJoyproxyPassword()).trim();
  const got = await jwtTry("/api/credentials/create", jwt, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      remark: String(opts.remark || "JoyProxy Extension").trim() || undefined,
    }),
  });
  const data = got.data || {};
  if (!got.res?.ok || data.success === false) {
    throw new Error(data.error || data.message || "创建账密失败");
  }
  const created = credentialFromApiRow(data.credential) || credentialFromApiRow(pickPrimaryCredential(data.credentials));
  if (created?.username && created.password) return created;
  if (created?.username) return { username: created.username, password };
  return { username, password };
}

export async function ensureProxyCredentials(jwt) {
  const existing = await fetchProxyCredentials(jwt);
  if (existing?.username && existing.password) return existing;
  return createProxyCredentials(jwt);
}

function accountCreds(jp) {
  const user = jp?.proxyUsername || jp?.proxyCredentials?.username;
  if (!user) return null;
  return {
    username: String(user),
    password: String(jp.proxyPassword || jp.proxyCredentials?.password || ""),
  };
}

function withAccountCreds(proxy, jp) {
  return mergeProxyCredentials(proxy, accountCreds(jp));
}

export async function fetchSessionTokens(jwt) {
  const session = await jwtTry("/v1/session/tokens", jwt);
  const extractFromSession = String(session.data?.extract_token || "");
  const masterFromSession = String(session.data?.master_token || "");
  if (session.data?.success && (extractFromSession || masterFromSession)) {
    return { extractToken: extractFromSession, masterToken: masterFromSession };
  }

  const tokenGot = await jwtTry("/api/token/get", jwt);
  const masterGot = await jwtTry("/api/master-token/status", jwt);
  const extractToken = String(tokenGot.data?.token || tokenGot.data?.extract_token || "");
  const masterToken = String(masterGot.data?.master_token || "");
  if (!extractToken) {
    throw new Error(session.data?.error || tokenGot.data?.error || "无法读取 API 令牌");
  }
  return { extractToken, masterToken };
}

export async function fetchOrders(jwt) {
  const got = await jwtTry("/api/orders/list", jwt, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status_valid: "valid" }),
  });
  const data = got.data;
  if (!data?.success) return [];
  return Array.isArray(data.orders) ? data.orders : [];
}

export async function fetchShortTrafficNetworks(jwt) {
  const got = await jwtTry("/api/user/short-traffic-stats", jwt);
  const data = got.data;
  if (!data?.success) return [];
  const nets = [];
  const rem = Number(data.remaining_bytes || data.remaining || data.remaining_gb || 0);
  if (rem > 0) nets.push("residential");
  const by = data.by_network || {};
  for (const key of Object.keys(by)) {
    const bucket = by[key] || {};
    const left = Number(bucket.remaining_gb || 0) > 0 || Number(bucket.remaining_bytes || bucket.remaining || 0) > 0;
    if (!left) continue;
    const nt = normNetwork(key);
    if (nt === "residential" || nt === "cellular" || nt === "business") nets.push(nt);
  }
  return [...new Set(nets)];
}

function allocRows(data) {
  if (Array.isArray(data?.allocations)) return data.allocations;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function isExpiredAt(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ts + 86400000 - 1 < Date.now();
  return ts <= Date.now();
}

function isLiveAllocation(row) {
  if (row?.enabled === false || row?.active === false) return false;
  const expire = row?.expire_at || row?.expired_at || row?.expires_at || row?.expire || row?.valid_until || row?.end_at;
  if (isExpiredAt(expire)) return false;
  const status = String(row?.status || "").toLowerCase();
  if (!status) return true;
  if (/expir|inactive|released|deleted|disabled|stopped|cancel|terminat|invalid|dead|complete/.test(status)) {
    return false;
  }
  return /active|allocat|bound|valid|running|ok|online/.test(status);
}

function isIpv4Host(h) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(String(h || ""));
}

const JOY_EDGE_PROXY_DOMAIN = "edge.joyproxy.com";
const JOY_EDGE_STD_PROXY_DOMAIN = "std.joyproxy.com";
const JOY_EDGE_PRO_PROXY_DOMAIN = "pro.joyproxy.com";

function joyExtractProxyPortFromLine(line) {
  const m = String(line || "").trim().match(/:(\d+)\s*$/);
  return m ? m[1] : "";
}

function joyLongAllocIsAssigned(row) {
  return Boolean(row && typeof row === "object" && String(row.country_iso || "").trim());
}

function joyEdgeProxyDomainForAlloc(row) {
  if (!row || typeof row !== "object") return JOY_EDGE_PROXY_DOMAIN;
  const explicit = String(row.proxy_domain || row.edge_proxy_domain || "").trim();
  if (explicit) return explicit;
  const host = String(
    row.edge_host_internal || row._edge_internal || row.edge_host_public || row.edge_ip || ""
  ).trim();
  if (host === "170.9.18.192" || host === "147.224.36.155") return JOY_EDGE_PRO_PROXY_DOMAIN;
  if (
    host === "172.28.192.117" ||
    host === "130.210.50.87" ||
    host === "172.28.192.118" ||
    host === "130.210.40.114"
  ) {
    return JOY_EDGE_STD_PROXY_DOMAIN;
  }
  return JOY_EDGE_PROXY_DOMAIN;
}

function joyEdgeProxyEndpoint(cc, rc, port, domain) {
  const d = String(domain || "").trim() || JOY_EDGE_PROXY_DOMAIN;
  const country = String(cc || "xx").trim().toLowerCase().slice(0, 2) || "xx";
  let region = String(rc || "xx").trim().toLowerCase();
  if (region.length > 2) region = region.slice(0, 2);
  if (!region) region = "xx";
  return `${country}-${region}.${d}:${port}`;
}

function joyBuildLongEdgeJoyproxyDisplay(row) {
  if (!joyLongAllocIsAssigned(row)) return null;
  const rawConn = String(row.connection || row.pwa_proxy || row.edge_proxy || "").trim();
  let port = joyExtractProxyPortFromLine(rawConn);
  if (!port && row.pwa_listen_port != null && row.pwa_listen_port !== "") port = String(row.pwa_listen_port);
  if (!port && row.edge_port != null && row.edge_port !== "") port = String(row.edge_port);
  if (!port) return null;
  const cc = String(row.country_iso || "xx").trim().toLowerCase().slice(0, 2) || "xx";
  let rc = String(row.province_iso || "xx").trim().toLowerCase();
  if (rc.length > 2) rc = rc.slice(0, 2);
  if (!rc) rc = "xx";
  return joyEdgeProxyEndpoint(cc, rc, port, joyEdgeProxyDomainForAlloc(row));
}

function findDomainEndpointInRow(row) {
  const seen = new Set();
  const stack = [row];
  while (stack.length) {
    const v = stack.pop();
    if (v == null) continue;
    if (typeof v === "string") {
      const raw = v.trim();
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      const parsed = parseProxyInput(raw, "http");
      if (parsed?.host && parsed.port && !isIpv4Host(parsed.host)) return parsed;
    } else if (typeof v === "object") {
      Object.values(v).forEach((child) => stack.push(child));
    }
  }
  return null;
}

function credsFromRow(row) {
  if (!row) return null;
  const user = row.proxy_username || row.username || row.user || row.auth_user || row.auth_username;
  if (!user) return null;
  return {
    username: String(user),
    password: String(row.proxy_password || row.password || row.pass || row.auth_pass || row.auth_password || ""),
  };
}

function mergeProxyCredentials(primary, ...sources) {
  if (!primary) return null;
  const out = { ...primary };
  if (out.username) return out;
  for (const src of sources) {
    if (!src?.username) continue;
    out.username = String(src.username);
    out.password = String(src.password || "");
    return out;
  }
  return out;
}

function endpointFromAlloc(row) {
  const built = joyBuildLongEdgeJoyproxyDisplay(row);
  if (built) {
    const parsedBuilt = parseProxyInput(built, "http");
    if (parsedBuilt?.host && parsedBuilt.port) return parsedBuilt;
  }

  const domain = findDomainEndpointInRow(row);
  if (domain) return domain;

  const stringCandidates = [
    row?.pwa_proxy,
    row?.proxy,
    row?.proxy_url,
    row?.endpoint,
    row?.address,
    row?.connect,
  ];
  for (const raw of stringCandidates) {
    const parsed = parseProxyInput(String(raw || ""), "http");
    if (parsed?.host && parsed.port && !isIpv4Host(parsed.host)) return parsed;
  }
  const host = row?.proxy_host || row?.host || row?.domain || row?.edge_host || row?.gateway || row?.server;
  const port = row?.proxy_port || row?.port || row?.edge_port || row?.connect_port;
  if (host && port && !isIpv4Host(host)) {
    const parsed = parseProxyInput(`${host}:${port}`, "http");
    if (parsed?.host && parsed.port) return parsed;
  }
  const fallbacks = [host && port ? `${host}:${port}` : "", ...stringCandidates];
  for (const raw of fallbacks) {
    const parsed = parseProxyInput(String(raw || ""), "http");
    if (parsed?.host && parsed.port) return parsed;
  }
  return null;
}

function lineFromAlloc(row, kind) {
  const parsed = endpointFromAlloc(row);
  if (!parsed) return null;
  const rowCreds = credsFromRow(row);
  const id = `${kind}-${row.allocation_id || row.id || `${parsed.host}:${parsed.port}`}`;
  const geo = [row.country_name || row.country_iso, row.city_name].filter(Boolean).join(" ");
  const expire = row.expire_at || row.expired_at || row.expires_at || row.expire || "";
  return {
    id,
    kind,
    allocationId: String(row.allocation_id || row.id || ""),
    orderId: String(row.order_id || ""),
    proxy: `${parsed.host}:${parsed.port}`,
    host: parsed.host,
    port: parsed.port,
    username: parsed.username || rowCreds?.username || "",
    password: parsed.password || rowCreds?.password || "",
    network: normNetwork(row.network_type),
    country: row.country_iso || "",
    geo,
    expire: expire ? String(expire).slice(0, 10) : "",
    expireAt: expire ? String(expire) : "",
    label: [geo || row.country_iso, `${parsed.host}:${parsed.port}`].filter(Boolean).join(" · "),
    status: String(row.status || "").toLowerCase(),
  };
}

export function lineDisplayLabel(line, translate) {
  const key = line?.kind === "custom" ? "jp.kind.custom" : "jp.kind.static";
  const prefix = typeof translate === "function" ? translate(key) : key;
  const hp = line?.host && line?.port ? `${line.host}:${line.port}` : String(line?.proxy || "").trim();
  const geo = String(line?.geo || "").trim();
  return [prefix, geo, hp].filter(Boolean).join(" · ");
}

async function fetchAllocList(jwt, path) {
  const full = await jwtTry(path, jwt);
  if (allocRows(full.data).length) return full;
  return jwtTry(`${path}${path.includes("?") ? "&" : "?"}lite=1`, jwt);
}

export async function fetchStaticLines(jwt) {
  const lines = [];
  const seen = new Set();
  const [longGot, customGot] = await Promise.all([
    fetchAllocList(jwt, "/api/long-term/allocations/list"),
    fetchAllocList(jwt, "/api/custom-ip/allocations/list"),
  ]);
  const push = (row, kind) => {
    if (!isLiveAllocation(row)) return;
    const line = lineFromAlloc(row, kind);
    if (!line) return;
    if (seen.has(line.id) || seen.has(line.proxy)) return;
    seen.add(line.id);
    seen.add(line.proxy);
    lines.push(line);
  };
  for (const row of allocRows(longGot.data)) push(row, "static");
  for (const row of allocRows(customGot.data)) push(row, "custom");
  return lines;
}

function mapGeoCountry(row, tier) {
  const iso = String(row?.iso || row?.country_iso || row?.code || "").toUpperCase();
  const id = String(row?.i || row?.geoname_id || row?.country_geoname_id || row?.id || "");
  if (!id) return null;
  return {
    id,
    iso,
    name: String(row?.n || row?.name || row?.country_name || iso || id),
    tier: tier === "non_t1" ? "non_t1" : "t1",
  };
}

async function fetchInventoryCatalog(tier) {
  const res = await fetch(`${JP_SITE}/api/geo/inventory-catalog?tier=${encodeURIComponent(tier)}`, { cache: "default" });
  return readJson(res);
}

export async function fetchGeoCountries() {
  const byIso = new Map();
  const byId = new Map();
  const ingest = (data, tier) => {
    for (const row of data?.countries || data?.items || data?.list || []) {
      const country = mapGeoCountry(row, tier);
      if (!country) continue;
      if (country.iso && byIso.has(country.iso)) continue;
      if (byId.has(country.id)) continue;
      if (country.iso) byIso.set(country.iso, country);
      byId.set(country.id, country);
    }
  };
  try {
    const [t1, non] = await Promise.all([fetchInventoryCatalog("t1"), fetchInventoryCatalog("non_t1")]);
    ingest(t1, "t1");
    ingest(non, "non_t1");
  } catch {
    /* fall through */
  }
  const countries = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (countries.length) return countries;
  return [];
}

export async function fetchGeoCountryTree(country) {
  const id = String(country?.id || country || "").trim();
  const tier = country?.tier === "non_t1" ? "non_t1" : "t1";
  if (!id) return { countryId: "", states: [], cities: {} };
  const tryTier = async (t) => {
    const res = await fetch(
      `${JP_SITE}/api/geo/inventory-country?tier=${encodeURIComponent(t)}&geoname_id=${encodeURIComponent(id)}`,
      { cache: "default" }
    );
    return readJson(res);
  };
  let data = await tryTier(tier);
  if (!data?.success && tier === "t1") data = await tryTier("non_t1");
  else if (!data?.success && tier === "non_t1") data = await tryTier("t1");
  const states = ((data?.states && data.states[id]) || []).map((s) => ({
    id: String(s.i || s.geoname_id || s.id || ""),
    iso: String(s.iso || s.iso_code || "").toUpperCase(),
    name: String(s.n || s.name || s.iso || ""),
  })).filter((s) => s.id);
  states.sort((a, b) => a.name.localeCompare(b.name));
  return {
    countryId: id,
    states,
    cities: data?.cities && typeof data.cities === "object" ? data.cities : {},
  };
}

export function citiesForGeo(cities, countryId, stateId) {
  const dict = cities && typeof cities === "object" ? cities : {};
  const out = [];
  const seen = new Set();
  const want = stateId ? `${countryId}|${stateId}` : "";
  const prefix = `${countryId}|`;
  for (const [key, list] of Object.entries(dict)) {
    if (want) {
      if (key !== want) continue;
    } else if (countryId && !key.startsWith(prefix)) {
      continue;
    }
    const st = key.includes("|") ? key.slice(key.indexOf("|") + 1) : "";
    for (const ct of list || []) {
      const cid = String(ct?.i ?? ct?.geoname_id ?? ct ?? "").trim();
      if (!cid || seen.has(cid)) continue;
      seen.add(cid);
      out.push({ id: cid, name: String(ct?.n || ct?.name || cid), stateId: st });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function buildExtractUrl(opts) {
  const type = opts.type || "short-term";
  const path = type === "long-term" ? "/v2/extract-long" : type === "custom-ip" ? "/v2/extract-custom" : "/v2/extract";
  const q = new URLSearchParams();
  q.set("token", opts.token);
  q.set("count", String(opts.count || 1));
  if (opts.format) q.set("format", opts.format);
  if (type === "short-term") {
    const duration = normalizeJoyDuration(opts.duration, opts.sessionType || "sticky");
    if (duration) q.set("duration", duration);
    if (opts.protocol === "socks5") q.set("protocol", "socks5");
    const nt = extractNetworkQuery(opts.network);
    if (nt) q.set("network_type", nt);
    const city = String(opts.cityGeoname || "").trim();
    const country = String(opts.countryGeoname || "").trim();
    const state = String(opts.stateGeoname || "").trim();
    if (city) {
      q.set("city_geoname_id", city);
    } else {
      if (country) q.set("country_geoname_id", country);
      if (state && state !== "_") q.set("state_geoname_id", state);
    }
  } else {
    if (opts.allocationId) q.set("allocation_id", opts.allocationId);
    if (opts.orderId) q.set("order_id", opts.orderId);
  }
  return `${JP_API}${path}?${q}`;
}

function credsFromExtractItem(item) {
  if (!item || typeof item !== "object") return null;
  const auth = item.proxy_auth && typeof item.proxy_auth === "object" ? item.proxy_auth : {};
  const username =
    item.wire_username ||
    item.username ||
    item.user ||
    item.proxy_username ||
    item.proxy_user ||
    auth.wire_username ||
    auth.username ||
    auth.user;
  if (!username) return null;
  return {
    username: String(username).trim(),
    password: String(
      item.password ||
        item.pass ||
        item.proxy_password ||
        item.proxy_pass ||
        auth.password ||
        auth.pass ||
        ""
    ),
  };
}

function firstExtractItem(data) {
  if (data == null) return null;
  if (typeof data === "string") return data;
  const lists = [data.endpoints, data.proxies, data.items, data.list, data.rows];
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list[0];
  }
  if (Array.isArray(data) && data.length) return data[0];
  if (data.host || data.endpoint || data.proxy || data.pwa_proxy || data.ip) return data;
  return null;
}

function applyExtractCreds(parsed, extra, overwrite = false) {
  if (!parsed) return null;
  if (!extra?.username && !extra?.password) return parsed;
  const out = { ...parsed };
  if (extra.username && (overwrite || !out.username)) out.username = extra.username;
  if (extra.password && (overwrite || !out.password)) out.password = extra.password;
  return out;
}

function proxyFromExtractItem(item, protocol) {
  if (!item) return null;
  if (typeof item === "string") return parseProxyInput(item, protocol);
  const line = item.endpoint || item.proxy || item.pwa_proxy || "";
  let parsed = line ? parseProxyInput(String(line), protocol) : null;
  if (!parsed) {
    const host = item.host || item.domain || item.edge_host || item.ip || item.edge_ip;
    const port = item.port || item.edge_port || item.proxy_port;
    if (host && port) parsed = parseProxyInput(`${host}:${port}`, protocol);
  }
  if (!parsed) return null;
  return applyExtractCreds(parsed, credsFromExtractItem(item), true);
}

function parseExtractBody(text, protocol) {
  const trim = String(text || "").trim();
  if (!trim) return { proxy: null, error: "" };
  if (isHtmlBody(trim)) return { proxy: null, error: "提取接口未返回数据" };
  if (trim.startsWith("{") || trim.startsWith("[")) {
    try {
      const data = JSON.parse(trim);
      if (data.success === false) {
        return { proxy: null, error: data.error || data.message || data.detail || "提取失败" };
      }
      const item = firstExtractItem(data);
      let parsed = proxyFromExtractItem(item, protocol);
      parsed = applyExtractCreds(parsed, credsFromExtractItem(data), false);
      return { proxy: parsed, error: parsed ? "" : "提取接口没有返回 host:port" };
    } catch {
      return { proxy: null, error: "提取结果无法解析" };
    }
  }
  const parsed = parseProxyInput(trim.split(/\r?\n/)[0], protocol);
  return { proxy: parsed, error: parsed ? "" : "提取接口没有返回 host:port" };
}

async function extractDynamicViaGateway(jp) {
  const jwt = String(jp.token || "").trim();
  if (!jwt) return null;
  const nt = normNetwork(jp.network) || "residential";
  const access = await jwtTry(`/api/gateway/access?network_type=${encodeURIComponent(nt)}`, jwt);
  if (access.data && access.data.allowed === false) return null;

  const country = (jp.catalog?.countries || []).find((c) => c.id === jp.countryGeoname);
  const state = (jp.catalog?.states || []).find((s) => s.id === jp.stateGeoname);
  const sticky = joySessionType(jp.sessionType) !== "rotating";
  const mins = sticky ? parseInt(normalizeJoyDuration(jp.duration || "1m", "sticky"), 10) || 1 : 0;
  const body = {
    network_type: nt,
    count: 1,
    format: "json",
    session_type: sticky ? "sticky" : "rotating",
    sesstime: mins,
    cc: String(country?.iso || "Rand").toUpperCase() || "Rand",
    st: String(state?.iso || "").toUpperCase(),
    city: String(jp.cityGeoname || "").trim(),
    asn: "",
  };
  const got = await jwtTry("/api/gateway/extract", jwt, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = got.data || {};
  if (data._html || !got.res || got.res.status === 404) return null;
  if (data.success === false) {
    const err = String(data.error || data.message || "");
    if (!err || /not.?allowed|not.?found|unknown endpoint|404/i.test(err)) return null;
    throw new Error(err);
  }
  if (data.credentials_ok === false) throw new Error("extract_missing_auth");
  const parsed = applyExtractCreds(
    proxyFromExtractItem(firstExtractItem(data), "http"),
    credsFromExtractItem(data),
    false
  );
  if (parsed?.host && parsed.username) return { ...parsed, protocol: "http" };
  if (parsed?.host) throw new Error("extract_missing_auth");
  return null;
}

export async function extractOneProxy(jp) {
  const isDynamic = jp.kind !== "static" && jp.kind !== "custom";
  const protocol = "http";
  const token = jp.extractToken;
  if (!token && !jp.token) throw new Error("缺少提取令牌，请重新登录");

  if (isDynamic) {
    const viaGateway = await extractDynamicViaGateway(jp);
    if (viaGateway) return viaGateway;
  }
  if (!token) throw new Error("缺少提取令牌，请重新登录");

  let type = "short-term";
  let allocationId = "";
  let fallback = null;
  if (!isDynamic) {
    const line = (jp.catalog?.lines || []).find((l) => l.id === jp.selectedId) || (jp.catalog?.lines || [])[0];
    if (!line) throw new Error("没有可用的静态线路");
    type = line.kind === "custom" ? "custom-ip" : "long-term";
    allocationId = line.allocationId;
    fallback = parseProxyInput(line.proxy || `${line.host || ""}:${line.port || ""}`, protocol);
    if (fallback) {
      if (line.username && !fallback.username) fallback.username = line.username;
      if (line.password && !fallback.password) fallback.password = line.password;
    }
  }

  const sessionType = isDynamic ? joySessionType(jp.sessionType) : "sticky";
  const base = {
    type,
    token,
    count: 1,
    duration: jp.duration || "1m",
    sessionType,
    protocol,
    network: jp.network,
    countryGeoname: jp.countryGeoname,
    stateGeoname: jp.stateGeoname,
    cityGeoname: jp.cityGeoname,
    allocationId,
  };

  const tryFormat = async (format) => {
    const res = await fetch(buildExtractUrl({ ...base, format }));
    return parseExtractBody(await res.text(), protocol);
  };

  const jsonGot = await tryFormat("json");
  const authGot = jsonGot.proxy?.username ? jsonGot : await tryFormat("crlf_auth");
  const crlfGot = authGot.proxy?.username || jsonGot.proxy?.host ? authGot : await tryFormat("crlf");

  if (isDynamic) {
    const proxy =
      (jsonGot.proxy?.username && jsonGot.proxy) ||
      (authGot.proxy?.username && authGot.proxy) ||
      (crlfGot.proxy?.username && crlfGot.proxy) ||
      jsonGot.proxy ||
      authGot.proxy ||
      crlfGot.proxy;
    if (proxy && !proxy.username) throw new Error("extract_missing_auth");
    if (proxy) return { ...proxy, protocol: "http" };
    throw new Error(jsonGot.error || authGot.error || crlfGot.error || "提取失败");
  }

  let proxy =
    withAccountCreds(mergeProxyCredentials(jsonGot.proxy, fallback), jp) ||
    withAccountCreds(mergeProxyCredentials(authGot.proxy, fallback, jsonGot.proxy), jp) ||
    withAccountCreds(mergeProxyCredentials(crlfGot.proxy, fallback, jsonGot.proxy, authGot.proxy), jp) ||
    withAccountCreds(fallback, jp);

  if (proxy && !proxy.username) {
    proxy = withAccountCreds(mergeProxyCredentials(proxy, jsonGot.proxy, authGot.proxy), jp);
  }

  if (proxy) {
    if (protocol !== "socks5" && !proxy.username) {
      throw new Error("extract_missing_auth");
    }
    return proxy;
  }

  throw new Error(jsonGot.error || authGot.error || crlfGot.error || "提取失败");
}

export function liveCatalogLines(lines) {
  return (lines || [])
    .map((l) => {
      if (l?.host && l?.port) return l;
      const parsed = parseProxyInput(String(l?.proxy || ""), "http");
      if (!parsed) return null;
      return { ...l, host: parsed.host, port: parsed.port, proxy: `${parsed.host}:${parsed.port}` };
    })
    .filter((l) => l && !isExpiredAt(l.expireAt || l.expire));
}

function applyAccountCredsToLines(lines, creds) {
  if (!creds?.username) return lines || [];
  return (lines || []).map((line) => {
    if (line.username) return line;
    return { ...line, username: creds.username, password: creds.password || "" };
  });
}

export async function loadJoyproxyCatalog(jwt) {
  const catalog = emptyCatalog();
  if (!jwt) {
    catalog.error = "err.notSignedIn";
    return { catalog, extractToken: "", masterToken: "", proxyCredentials: null };
  }
  const tokens = await fetchSessionTokens(jwt);
  const [orders, lines, trafficNets, proxyCredentials, countries] = await Promise.all([
    fetchOrders(jwt).catch(() => []),
    fetchStaticLines(jwt).catch(() => []),
    fetchShortTrafficNetworks(jwt).catch(() => []),
    ensureProxyCredentials(jwt).catch(() => null),
    fetchGeoCountries().catch(() => []),
  ]);
  const enrichedLines = applyAccountCredsToLines(lines, proxyCredentials);
  const networks = [];
  const allow = ["residential", "cellular", "business"];
  for (const nt of trafficNets) if (allow.includes(nt) && !networks.includes(nt)) networks.push(nt);
  for (const order of orders) {
    if (orderKind(order) !== "dynamic") continue;
    if (String(order.status || "").toLowerCase() !== "completed") continue;
    if (isExpiredAt(order.expire_at || order.expired_at || order.valid_until || order.end_at)) continue;
    const nt = normNetwork(order.network_type || order.network);
    if (!allow.includes(nt) || networks.includes(nt)) continue;
    networks.push(nt);
  }
  catalog.loaded = true;
  catalog.fetchedAt = Date.now();
  catalog.networks = networks;
  catalog.lines = liveCatalogLines(enrichedLines);
  catalog.countries = countries;
  return {
    catalog,
    extractToken: tokens.extractToken,
    masterToken: tokens.masterToken,
    proxyCredentials,
  };
}
