import { parseProxyInput } from "./parse.js";

export const JP_LOGIN = "https://www.joyproxy.com/login.html";
export const JP_SITE = "https://www.joyproxy.com";
export const JP_API = "https://api.joyproxy.com";
export const JP_DASHBOARD = "https://www.joyproxy.com/admin-overview.html";

export const JP_DURATIONS = [
  ["30s", "30 秒"],
  ["1m", "1 分钟"],
  ["2m", "2 分钟"],
  ["3m", "3 分钟"],
];

export const JP_NETWORKS = [
  ["residential", "jp.net.residential"],
  ["cellular", "jp.net.mobile"],
  ["business", "jp.net.business"],
  ["hosting", "jp.net.datacenter"],
];

export function emptyCatalog() {
  return { loaded: false, networks: [], lines: [], countries: [], error: "" };
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
  const origins = path.startsWith("/v1/") ? [JP_API, JP_SITE] : [JP_SITE, JP_API];
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

function lineFromAlloc(row, kind) {
  const proxy = String(row.pwa_proxy || row.proxy || "").trim();
  const id = `${kind}-${row.allocation_id || row.id || proxy}`;
  const geo = [row.country_name || row.country_iso, row.city_name].filter(Boolean).join(" ");
  const prefix = kind === "custom" ? "自定义" : "静态";
  return {
    id,
    kind,
    allocationId: String(row.allocation_id || row.id || ""),
    orderId: String(row.order_id || ""),
    proxy,
    network: normNetwork(row.network_type),
    country: row.country_iso || "",
    expire: row.expire_at ? String(row.expire_at).slice(0, 10) : "",
    label: [prefix, geo || row.country_iso, proxy].filter(Boolean).join(" · "),
    status: String(row.status || "").toLowerCase(),
  };
}

export async function fetchStaticLines(jwt) {
  const lines = [];
  const [longGot, customGot] = await Promise.all([
    jwtTry("/api/long-term/allocations/list?lite=1", jwt),
    jwtTry("/api/custom-ip/allocations/list?lite=1", jwt),
  ]);
  const longData = longGot.data || {};
  const customData = customGot.data || {};
  for (const row of longData.allocations || []) {
    if (String(row.status || "").toLowerCase() !== "active") continue;
    if (!row.proxy && !row.pwa_proxy) continue;
    lines.push(lineFromAlloc(row, "static"));
  }
  for (const row of customData.allocations || []) {
    if (String(row.status || "").toLowerCase() !== "active") continue;
    if (!row.proxy && !row.pwa_proxy) continue;
    lines.push(lineFromAlloc(row, "custom"));
  }
  return lines;
}

export async function fetchGeoCountries(extractToken, network) {
  if (!extractToken) return [];
  const q = new URLSearchParams({ token: extractToken, format: "json" });
  const nt = extractNetworkQuery(network);
  if (nt) q.set("network_type", nt);
  const res = await fetch(`${JP_API}/v1/geo/geoname-id?${q}`);
  const data = await readJson(res);
  const rows = data.countries || data.items || data.list || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((c) => ({
      id: String(c.i || c.geoname_id || c.country_geoname_id || c.id || ""),
      iso: String(c.iso || c.country_iso || c.code || "").toUpperCase(),
      name: String(c.n || c.name || c.country_name || ""),
    }))
    .filter((c) => c.id);
}

export function buildExtractUrl(opts) {
  const type = opts.type || "short-term";
  const path = type === "long-term" ? "/v1/extract-long" : type === "custom-ip" ? "/v1/extract-custom" : "/v1/extract";
  const q = new URLSearchParams();
  q.set("token", opts.token);
  q.set("count", String(opts.count || 1));
  if (opts.format && opts.format !== "json") q.set("format", opts.format);
  if (type === "short-term") {
    if (opts.duration) q.set("duration", opts.duration);
    if (opts.protocol === "socks5") q.set("protocol", "socks5");
    const nt = extractNetworkQuery(opts.network);
    if (nt) q.set("network_type", nt);
    if (opts.countryGeoname) q.set("country_geoname_id", opts.countryGeoname);
  } else {
    if (opts.allocationId) q.set("allocation_id", opts.allocationId);
    if (opts.orderId) q.set("order_id", opts.orderId);
  }
  return `${JP_API}${path}?${q}`;
}

function proxyFromExtractItem(item, protocol) {
  if (!item) return null;
  if (typeof item === "string") return parseProxyInput(item, protocol);
  const line = item.proxy || item.pwa_proxy || "";
  if (line) return parseProxyInput(String(line), protocol);
  const host = item.ip || item.host || item.edge_ip;
  const port = item.port || item.edge_port;
  if (host && port) return parseProxyInput(`${host}:${port}`, protocol);
  return null;
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
      const item = Array.isArray(data.proxies) ? data.proxies[0] : Array.isArray(data) ? data[0] : null;
      const parsed = proxyFromExtractItem(item, protocol);
      return { proxy: parsed, error: parsed ? "" : "提取接口没有返回 host:port" };
    } catch {
      return { proxy: null, error: "提取结果无法解析" };
    }
  }
  const parsed = parseProxyInput(trim.split(/\r?\n/)[0], protocol);
  return { proxy: parsed, error: parsed ? "" : "提取接口没有返回 host:port" };
}

export async function extractOneProxy(jp) {
  const protocol = jp.protocol === "socks5" ? "socks5" : "http";
  const token = jp.extractToken;
  if (!token) throw new Error("缺少提取令牌，请重新登录");

  let type = "short-term";
  let allocationId = "";
  let fallback = null;
  if (jp.kind !== "dynamic") {
    const line = (jp.catalog?.lines || []).find((l) => l.id === jp.selectedId) || (jp.catalog?.lines || [])[0];
    if (!line) throw new Error("没有可用的静态线路");
    type = line.kind === "custom" ? "custom-ip" : "long-term";
    allocationId = line.allocationId;
    fallback = parseProxyInput(line.proxy, protocol);
  }

  const base = {
    type,
    token,
    count: 1,
    duration: jp.duration || "2m",
    protocol,
    network: jp.network,
    countryGeoname: jp.countryGeoname,
    allocationId,
  };

  const tryFormat = async (format) => {
    const res = await fetch(buildExtractUrl({ ...base, format }));
    return parseExtractBody(await res.text(), protocol);
  };

  const jsonGot = await tryFormat("json");
  if (jsonGot.proxy) return jsonGot.proxy;
  if (jsonGot.error && jsonGot.error !== "提取接口没有返回 host:port") throw new Error(jsonGot.error);

  const crlfGot = await tryFormat("crlf");
  if (crlfGot.proxy) return crlfGot.proxy;
  if (crlfGot.error && crlfGot.error !== "提取接口没有返回 host:port") throw new Error(crlfGot.error);

  const authGot = await tryFormat("crlf_auth");
  if (authGot.proxy) return authGot.proxy;
  if (fallback) return fallback;
  throw new Error(jsonGot.error || crlfGot.error || authGot.error || "提取失败");
}

export async function loadJoyproxyCatalog(jwt) {
  const catalog = emptyCatalog();
  if (!jwt) {
    catalog.error = "未登录";
    return { catalog, extractToken: "", masterToken: "" };
  }
  const tokens = await fetchSessionTokens(jwt);
  const [orders, lines, trafficNets] = await Promise.all([
    fetchOrders(jwt).catch(() => []),
    fetchStaticLines(jwt).catch(() => []),
    fetchShortTrafficNetworks(jwt).catch(() => []),
  ]);
  const networks = [];
  const allow = ["residential", "cellular", "business"];
  for (const nt of trafficNets) if (allow.includes(nt) && !networks.includes(nt)) networks.push(nt);
  for (const order of orders) {
    if (orderKind(order) !== "dynamic") continue;
    if (String(order.status || "").toLowerCase() !== "completed") continue;
    const nt = normNetwork(order.network_type || order.network);
    if (!allow.includes(nt) || networks.includes(nt)) continue;
    networks.push(nt);
  }
  catalog.loaded = true;
  catalog.networks = networks;
  catalog.lines = lines;
  catalog.countries = [];
  return { catalog, extractToken: tokens.extractToken, masterToken: tokens.masterToken };
}
