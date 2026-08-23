const RULE = {
  ua: 9101,
  lang: 9102,
  referer: 9103,
  dnt: 9104,
};

const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "image",
  "font",
  "other",
];

export const UA_PRESETS = [
  { id: "", label: "浏览器默认" },
  {
    id: "chrome-win",
    label: "Chrome · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    platform: "Win32",
  },
  {
    id: "chrome-mac",
    label: "Chrome · macOS",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    platform: "MacIntel",
  },
  {
    id: "edge-win",
    label: "Edge · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    platform: "Win32",
  },
  {
    id: "firefox-win",
    label: "Firefox · Windows",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
    platform: "Win32",
  },
  {
    id: "safari-mac",
    label: "Safari · macOS",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
    platform: "MacIntel",
  },
  {
    id: "chrome-android",
    label: "Chrome · Android",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    platform: "Linux armv8l",
  },
  {
    id: "safari-ios",
    label: "Safari · iPhone",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
    platform: "iPhone",
  },
  { id: "custom", label: "自定义" },
];

export const LANGUAGE_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "zh-CN,zh;q=0.9", label: "中文（简体）" },
  { id: "zh-TW,zh;q=0.9", label: "中文（繁体）" },
  { id: "en-US,en;q=0.9", label: "English (US)" },
  { id: "en-GB,en;q=0.9", label: "English (UK)" },
  { id: "ja-JP,ja;q=0.9", label: "日本語" },
  { id: "ko-KR,ko;q=0.9", label: "한국어" },
  { id: "de-DE,de;q=0.9", label: "Deutsch" },
  { id: "fr-FR,fr;q=0.9", label: "Français" },
  { id: "es-ES,es;q=0.9", label: "Español" },
];

export const TIMEZONE_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "美国东部" },
  { id: "America/Los_Angeles", label: "美国西部" },
  { id: "America/Chicago", label: "美国中部" },
  { id: "Europe/London", label: "伦敦" },
  { id: "Europe/Berlin", label: "柏林" },
  { id: "Asia/Shanghai", label: "上海" },
  { id: "Asia/Tokyo", label: "东京" },
  { id: "Asia/Singapore", label: "新加坡" },
  { id: "Asia/Hong_Kong", label: "香港" },
];

export const SCREEN_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "1920x1080", label: "1920 × 1080" },
  { id: "1366x768", label: "1366 × 768" },
  { id: "1440x900", label: "1440 × 900" },
  { id: "2560x1440", label: "2560 × 1440" },
  { id: "390x844", label: "390 × 844（手机）" },
];

export const HARDWARE_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "4", label: "4 核" },
  { id: "8", label: "8 核" },
  { id: "12", label: "12 核" },
  { id: "16", label: "16 核" },
];

export const MEMORY_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "4", label: "4 GB" },
  { id: "8", label: "8 GB" },
  { id: "16", label: "16 GB" },
];

export const TOUCH_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "0", label: "无触控" },
  { id: "1", label: "1 点" },
  { id: "5", label: "5 点" },
];

export const DPR_PRESETS = [
  { id: "", label: "浏览器默认" },
  { id: "1", label: "1×" },
  { id: "1.25", label: "1.25×" },
  { id: "1.5", label: "1.5×" },
  { id: "2", label: "2×" },
];

export const WEBGL_PRESETS = [
  { id: "", label: "浏览器默认" },
  {
    id: "nvidia",
    label: "NVIDIA",
    vendor: "Google Inc. (NVIDIA)",
    renderer: "ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)",
  },
  {
    id: "intel",
    label: "Intel",
    vendor: "Intel Inc.",
    renderer: "Intel(R) UHD Graphics 620",
  },
  {
    id: "amd",
    label: "AMD",
    vendor: "ATI Technologies Inc.",
    renderer: "AMD Radeon RX 580",
  },
  {
    id: "apple",
    label: "Apple",
    vendor: "Apple Inc.",
    renderer: "Apple M1",
  },
];

export const FONT_PRESETS = [
  { id: "", label: "浏览器默认" },
  {
    id: "win",
    label: "Windows 常见字体",
    fonts: [
      "Arial",
      "Calibri",
      "Cambria",
      "Comic Sans MS",
      "Consolas",
      "Courier New",
      "Georgia",
      "Impact",
      "Segoe UI",
      "Tahoma",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
    ],
  },
  {
    id: "mac",
    label: "macOS 常见字体",
    fonts: [
      "Arial",
      "Geneva",
      "Helvetica",
      "Helvetica Neue",
      "Lucida Grande",
      "Menlo",
      "Monaco",
      "New York",
      "San Francisco",
      "Times",
      "Times New Roman",
    ],
  },
];

function pickPreset(list) {
  const opts = (list || []).filter((x) => x.id && x.id !== "custom");
  if (!opts.length) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

export function hasRandomPrivacy(privacy) {
  const r = privacy?.random || {};
  return Object.values(r).some(Boolean);
}

export function resolveLivePrivacy(privacy, settings) {
  const src = privacy || {};
  const r = src.random || {};
  const out = { ...src };
  if (r.userAgent) {
    const hit = pickPreset(UA_PRESETS);
    if (hit) {
      out.userAgentId = hit.id;
      out.userAgentCustom = "";
    }
  }
  if (r.language) {
    const hit = pickPreset(LANGUAGE_PRESETS);
    if (hit) out.language = hit.id;
  }
  if (r.timezone) {
    const hit = pickPreset(TIMEZONE_PRESETS);
    if (hit) out.timezone = hit.id;
  }
  if (r.screen) {
    const hit = pickPreset(SCREEN_PRESETS);
    if (hit) out.screen = hit.id;
  }
  if (r.devicePixelRatio) {
    const hit = pickPreset(DPR_PRESETS);
    if (hit) out.devicePixelRatio = hit.id;
  }
  if (r.hardwareConcurrency) {
    const hit = pickPreset(HARDWARE_PRESETS);
    if (hit) out.hardwareConcurrency = hit.id;
  }
  if (r.deviceMemory) {
    const hit = pickPreset(MEMORY_PRESETS);
    if (hit) out.deviceMemory = hit.id;
  }
  if (r.maxTouchPoints) {
    const hit = pickPreset(TOUCH_PRESETS);
    if (hit) out.maxTouchPoints = hit.id;
  }
  if (r.webgl) {
    const hit = pickPreset(WEBGL_PRESETS);
    if (hit) out.webglId = hit.id;
  }
  if (r.fonts) {
    const hit = pickPreset(FONT_PRESETS);
    if (hit) out.fontId = hit.id;
  }
  if (r.canvasNoise) out.canvasNoise = Math.random() < 0.5;
  if (r.stripReferer) out.stripReferer = Math.random() < 0.5;
  if (r.dnt) out.dnt = Math.random() < 0.5;
  out.restrictWebRTC = r.webrtc ? Math.random() < 0.5 : Boolean(settings?.restrictWebRTC);
  return out;
}

export async function applyWebRtc(restrict) {
  if (!chrome.privacy?.network?.webRTCIPHandlingPolicy) return;
  try {
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: restrict ? "disable_non_proxied_udp" : "default",
    });
  } catch {
    /* optional permission / managed policy */
  }
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseScreen(id) {
  const m = String(id || "").match(/^(\d+)x(\d+)$/);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]) };
}

export function privacyInjectPayload(privacy) {
  const webgl = WEBGL_PRESETS.find((p) => p.id && p.id === privacy?.webglId);
  const fonts = FONT_PRESETS.find((p) => p.id && p.id === privacy?.fontId)?.fonts || [];
  return {
    ua: resolveUserAgent(privacy),
    platform: resolvePlatform(privacy),
    language: (privacy?.language || "").split(",")[0].trim(),
    timezone: privacy?.timezone || "",
    hardwareConcurrency: numOrNull(privacy?.hardwareConcurrency),
    deviceMemory: numOrNull(privacy?.deviceMemory),
    maxTouchPoints: privacy?.maxTouchPoints === "" || privacy?.maxTouchPoints == null ? null : Number(privacy.maxTouchPoints),
    screen: parseScreen(privacy?.screen),
    dpr: numOrNull(privacy?.devicePixelRatio),
    webgl: webgl ? { vendor: webgl.vendor, renderer: webgl.renderer } : null,
    fonts,
    canvasNoise: Boolean(privacy?.canvasNoise),
  };
}

function needsInject(p) {
  return Boolean(
    p.ua ||
      p.language ||
      p.timezone ||
      p.hardwareConcurrency ||
      p.deviceMemory != null ||
      p.maxTouchPoints != null ||
      p.screen ||
      p.dpr ||
      p.webgl ||
      p.fonts?.length ||
      p.canvasNoise
  );
}

export function resolveUserAgent(privacy) {
  if (!privacy) return "";
  if (privacy.userAgentId === "custom") return (privacy.userAgentCustom || "").trim();
  return UA_PRESETS.find((p) => p.id === privacy.userAgentId)?.ua || "";
}

export function resolvePlatform(privacy) {
  if (!privacy || privacy.userAgentId === "custom") return "";
  return UA_PRESETS.find((p) => p.id === privacy.userAgentId)?.platform || "";
}

function headerRule(id, headers) {
  return {
    id,
    priority: 1,
    action: { type: "modifyHeaders", requestHeaders: headers },
    condition: { regexFilter: "^https?://", resourceTypes: RESOURCE_TYPES },
  };
}

export async function applyHeaderOverrides(privacy) {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) return;
  const removeRuleIds = Object.values(RULE);
  const addRules = [];
  const ua = resolveUserAgent(privacy);
  if (ua) {
    addRules.push(headerRule(RULE.ua, [{ header: "User-Agent", operation: "set", value: ua }]));
  }
  if (privacy?.language) {
    addRules.push(headerRule(RULE.lang, [{ header: "Accept-Language", operation: "set", value: privacy.language }]));
  }
  if (privacy?.stripReferer) {
    addRules.push(headerRule(RULE.referer, [{ header: "Referer", operation: "remove" }]));
  }
  if (privacy?.dnt) {
    addRules.push(headerRule(RULE.dnt, [{ header: "DNT", operation: "set", value: "1" }]));
  }
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (err) {
    console.warn("header overrides", err);
  }
}

export function installPrivacyInjection() {
  if (!chrome.webNavigation?.onCommitted || !chrome.scripting?.executeScript) return;
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    if (!/^https?:/.test(details.url || "")) return;
    injectIntoTab(details.tabId, details.frameId).catch(() => {});
  });
}

async function injectIntoTab(tabId, frameId) {
  const bag = await chrome.storage.local.get("joyproxy.v1");
  const settings = bag["joyproxy.v1"]?.settings;
  const live = settings?.privacy || {};
  const payload = privacyInjectPayload(live);
  if (!needsInject(payload)) return;
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: frameId != null ? [frameId] : undefined },
    world: "MAIN",
    injectImmediately: true,
    func: applyPagePrivacy,
    args: [payload],
  });
}

function applyPagePrivacy(p) {
  const hide = (obj, key, value) => {
    try {
      Object.defineProperty(obj, key, { get: () => value, configurable: true });
    } catch {
      /* some pages freeze navigator */
    }
  };
  if (p.ua) {
    hide(Navigator.prototype, "userAgent", p.ua);
    hide(Navigator.prototype, "appVersion", p.ua.replace(/^Mozilla\//, ""));
    if (p.platform) hide(Navigator.prototype, "platform", p.platform);
  }
  if (p.language) {
    hide(Navigator.prototype, "language", p.language);
    hide(Navigator.prototype, "languages", Object.freeze([p.language]));
  }
  if (p.timezone) {
    const tz = p.timezone;
    const orig = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function resolvedOptions() {
      const out = orig.call(this);
      out.timeZone = tz;
      return out;
    };
    let offset = 0;
    try {
      const now = new Date();
      const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
      const loc = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      offset = (utc.getTime() - loc.getTime()) / 60000;
    } catch {
      offset = 0;
    }
    Date.prototype.getTimezoneOffset = function getTimezoneOffset() {
      return offset;
    };
  }
  if (p.hardwareConcurrency) hide(Navigator.prototype, "hardwareConcurrency", p.hardwareConcurrency);
  if (p.deviceMemory != null) hide(Navigator.prototype, "deviceMemory", p.deviceMemory);
  if (p.maxTouchPoints != null) hide(Navigator.prototype, "maxTouchPoints", p.maxTouchPoints);
  if (p.screen) {
    hide(Screen.prototype, "width", p.screen.w);
    hide(Screen.prototype, "height", p.screen.h);
    hide(Screen.prototype, "availWidth", p.screen.w);
    hide(Screen.prototype, "availHeight", p.screen.h);
  }
  if (p.dpr) hide(window, "devicePixelRatio", p.dpr);
  if (p.webgl) {
    const spoof = (proto) => {
      if (!proto?.getParameter) return;
      const orig = proto.getParameter;
      proto.getParameter = function getParameter(name) {
        if (name === 37445) return p.webgl.vendor;
        if (name === 37446) return p.webgl.renderer;
        return orig.call(this, name);
      };
    };
    if (window.WebGLRenderingContext) spoof(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) spoof(WebGL2RenderingContext.prototype);
  }
  if (p.fonts?.length && typeof queryLocalFonts === "function") {
    const list = p.fonts.map((family) => ({
      family,
      fullName: family,
      postscriptName: family.replace(/\s+/g, ""),
      style: "Regular",
    }));
    window.queryLocalFonts = async function queryLocalFonts() {
      return list;
    };
  }
  if (p.canvasNoise && window.CanvasRenderingContext2D) {
    const orig = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function getImageData(...args) {
      const data = orig.apply(this, args);
      if (data?.data?.length) data.data[0] = data.data[0] ^ 1;
      return data;
    };
  }
}

export async function findHttpTab() {
  const focused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const hit = focused.find((t) => /^https?:/.test(t.url || ""));
  if (hit) return hit;
  const all = await chrome.tabs.query({ lastFocusedWindow: true });
  return all.find((t) => t.active && /^https?:/.test(t.url || "")) || all.find((t) => /^https?:/.test(t.url || "")) || null;
}

function originOf(tab) {
  try {
    return new URL(tab.url).origin;
  } catch {
    return "";
  }
}

export async function clearSiteCookies(tab) {
  const origin = originOf(tab);
  if (!origin) throw new Error("请先打开一个 http(s) 网页");
  if (chrome.browsingData?.remove) {
    await chrome.browsingData.remove({ origins: [origin] }, { cookies: true });
    return origin;
  }
  throw new Error("当前浏览器不支持清理 Cookie");
}

export async function clearSiteData(tab) {
  const origin = originOf(tab);
  if (!origin) throw new Error("请先打开一个 http(s) 网页");
  await chrome.browsingData.remove(
    { origins: [origin] },
    { cookies: true, localStorage: true, cache: true, serviceWorkers: true, indexedDB: true }
  );
  return origin;
}

export async function clearAllCookies() {
  await chrome.browsingData.remove({}, { cookies: true });
}

export async function clearCache() {
  await chrome.browsingData.remove({}, { cache: true, cacheStorage: true });
}
