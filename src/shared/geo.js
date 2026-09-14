import { fetchThroughOffscreen } from "./offscreen-fetch.js";

export const GEO_PRESETS = {
  ipinfo: {
    name: "ipinfo.io",
    url: "https://ipinfo.io/json",
    ipKey: "ip",
    countryKey: "country",
  },
  ipwhois: {
    name: "ipwhois.app",
    url: "https://ipwhois.app/json/",
    ipKey: "ip",
    countryKey: "country",
  },
  "ip-api": {
    name: "ip-api.com",
    url: "http://ip-api.com/json/?fields=status,query,country,countryCode",
    ipKey: "query",
    countryKey: "country",
  },
  myip: {
    name: "api.myip.com",
    url: "https://api.myip.com",
    ipKey: "ip",
    countryKey: "country",
  },
};

export const GEO_CHANNEL_OPTIONS = [
  { id: "ipinfo", label: "ipinfo.io (https://ipinfo.io/json)" },
  { id: "ipwhois", label: "ipwhois.app (https://ipwhois.app/json/)" },
  { id: "ip-api", label: "ip-api.com (http://ip-api.com/json/)" },
  { id: "myip", label: "api.myip.com (https://api.myip.com)" },
  { id: "custom", label: "自定义 URL（原文，不解析 JSON）" },
];

export function countryCode(codeOrName) {
  const raw = String(codeOrName || "").trim();
  if (/^[a-zA-Z]{2}$/.test(raw)) return raw.toUpperCase();
  return "";
}

export function resolveGeoTarget(settings) {
  const channel = settings?.geoChannel || "ipinfo";
  if (channel === "custom") {
    const url = (settings.customGeoUrl || "").trim();
    return { url, ipKey: "ip", countryKey: "country", host: safeHost(url), raw: true };
  }
  const preset = GEO_PRESETS[channel] || GEO_PRESETS.ipinfo;
  return { ...preset, host: safeHost(preset.url), raw: false };
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function parseGeoPayload(data, target) {
  if (!data || typeof data !== "object") return { ip: "", country: "", countryCode: "" };
  const ip = String(
    data[target.ipKey] ||
      data.ip ||
      data.query ||
      data.ipAddress ||
      data.client_ip ||
      data.clientIp ||
      ""
  ).trim();
  const country = String(
    data[target.countryKey] ||
      data.country ||
      data.country_name ||
      data.countryName ||
      data.location?.country ||
      data.location?.country_name ||
      ""
  ).trim();
  const cc = String(
    data.country_code ||
      data.countryCode ||
      data.location?.country_code ||
      countryCode(country)
  ).trim();
  return {
    ip,
    country,
    countryCode: countryCode(cc),
  };
}

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;

function findIpDeep(value, depth = 0) {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string") {
    const hit = value.match(IPV4_RE);
    return hit ? hit[0] : "";
  }
  if (typeof value !== "object") return "";
  for (const key of ["ip", "query", "ipAddress", "address", "client_ip", "clientIp"]) {
    const hit = findIpDeep(value[key], depth + 1);
    if (hit) return hit;
  }
  for (const v of Object.values(value)) {
    const hit = findIpDeep(v, depth + 1);
    if (hit) return hit;
  }
  return "";
}

function extractIpFromText(text, target) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    const json = JSON.parse(raw);
    if (json?.origin && typeof json.origin === "string") {
      const ip = json.origin.match(IPV4_RE)?.[0];
      if (ip) return ip;
    }
    const parsed = parseGeoPayload(json, target || { ipKey: "ip", countryKey: "country" });
    if (parsed.ip) return parsed.ip;
    return findIpDeep(json);
  } catch {
    return raw.match(IPV4_RE)?.[0] || "";
  }
}

function parseGeoFromText(text, target) {
  const raw = (text || "").trim();
  if (!raw) throw new Error("检测通道未返回内容");

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    const ip = raw.match(IPV4_RE)?.[0] || "";
    if (ip) return { ip, country: "", countryCode: "" };
    throw new Error("检测通道未返回 IP");
  }

  if (json && typeof json === "object") {
    if (json.status === "fail") {
      throw new Error(String(json.message || "检测通道返回失败").trim());
    }
    if (json.success === false) {
      throw new Error(String(json.message || json.error || "检测通道返回失败").trim());
    }
    const parsed = parseGeoPayload(json, target);
    if (parsed.ip) return parsed;
    const nested = parseGeoPayload(json.data, target);
    if (nested.ip) return nested;
    const ip = findIpDeep(json);
    if (ip) {
      return {
        ip,
        country: parsed.country || nested.country || "",
        countryCode: parsed.countryCode || nested.countryCode || "",
      };
    }
  }

  const ip = raw.match(IPV4_RE)?.[0] || "";
  if (ip) return { ip, country: "", countryCode: "" };
  throw new Error("检测通道未返回 IP");
}

async function readGeoText(url, timeoutMs, method = "GET", opts = {}) {
  if (globalThis.chrome?.offscreen) {
    return fetchThroughOffscreen(url, timeoutMs, {
      method,
      // Worker fetch in offscreen triggers onAuthRequired; main-thread fetch does not.
      useMainThread: false,
    });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      cache: "no-store",
      headers: method === "HEAD" ? {} : { Accept: "application/json" },
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

function geoTargets(settings, opts = {}) {
  if (opts.authTest) {
    return [
      {
        url: "https://api.ipify.org?format=json",
        ipKey: "ip",
        countryKey: "",
        host: "api.ipify.org",
        raw: false,
      },
      {
        url: "https://ipinfo.io/json",
        ipKey: "ip",
        countryKey: "country",
        host: "ipinfo.io",
        raw: false,
      },
    ];
  }
  const primary = resolveGeoTarget(settings);
  if (primary.raw || settings?.geoChannel === "custom") return [primary];
  const extras = [GEO_PRESETS["ip-api"], primary, GEO_PRESETS.ipwhois];
  const seen = new Set();
  const list = [];
  for (const item of extras) {
    if (!item?.url || seen.has(item.url)) continue;
    seen.add(item.url);
    list.push(item.url === primary.url ? primary : { ...item, host: safeHost(item.url), raw: false });
  }
  return list;
}

export async function fetchGeo(settings, timeoutMs = 8000, opts = {}) {
  const targets = geoTargets(settings, opts);
  if (!targets[0]?.url) throw new Error("请先填写自定义检测地址");
  const started = Date.now();
  const deadline = started + timeoutMs;
  let lastErr = new Error("检测通道失败");
  for (const target of targets) {
    const remain = deadline - Date.now();
    if (remain < 800) break;
    try {
      const { status, text } = await readGeoText(target.url, Math.min(timeoutMs, remain), "GET", opts);
      if (status >= 400) {
        const ip = extractIpFromText(text, target);
        if (ip && status < 500) {
          return {
            ip,
            country: "",
            countryCode: "",
            latency: Date.now() - started,
            status,
          };
        }
        throw new Error(`检测通道 HTTP ${status}（${target.host || "unknown"}）`);
      }
      if (target.raw) {
        const body = (text || "").trim();
        if (!body) throw new Error("检测通道未返回内容");
        return {
          ip: body.length > 200 ? `${body.slice(0, 200)}…` : body,
          country: "",
          countryCode: "",
          latency: Date.now() - started,
          status,
        };
      }
      const geo = parseGeoFromText(text, target);
      return { ...geo, latency: Date.now() - started, status };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr;
}

export async function verifyAuthTunnel(timeoutMs = 12000) {
  return fetchGeo({}, timeoutMs, { authTest: true });
}

export function formatIpLine(ip, country, empty = "—") {
  const a = (ip || "").trim();
  const c = (country || "").trim();
  if (!a && !c) return empty;
  if (!c) return a || empty;
  if (!a) return c;
  return `${a} · ${c}`;
}
