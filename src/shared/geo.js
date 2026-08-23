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
    url: "http://ip-api.com/json/",
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
  let ip = String(data[target.ipKey] || data.ip || data.query || data.ipAddress || "").trim();
  const country = String(
    data[target.countryKey] || data.country || data.country_name || data.countryName || ""
  ).trim();
  const cc = String(data.country_code || data.countryCode || countryCode(country)).trim();
  return {
    ip,
    country,
    countryCode: countryCode(cc),
  };
}

export async function fetchGeo(settings, timeoutMs = 8000) {
  const target = resolveGeoTarget(settings);
  if (!target.url) throw new Error("请先填写自定义检测地址");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(target.url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (target.raw) {
      const body = (text || "").trim();
      if (!body) throw new Error("检测通道未返回内容");
      return {
        ip: body.length > 200 ? `${body.slice(0, 200)}…` : body,
        country: "",
        countryCode: "",
        latency: Date.now() - started,
        status: res.status,
      };
    }
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = { ip: text.trim() };
    }
    const geo = parseGeoPayload(json, target);
    if (!geo.ip) throw new Error("检测通道未返回 IP");
    return { ...geo, latency: Date.now() - started, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export function formatIpLine(ip, country, empty = "—") {
  const a = (ip || "").trim();
  const c = (country || "").trim();
  if (!a && !c) return empty;
  if (!c) return a || empty;
  if (!a) return c;
  return `${a} · ${c}`;
}
