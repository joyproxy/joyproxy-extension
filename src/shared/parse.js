const SCHEME_RE = /^(https?|socks5h?|socks4):\/\//i;

function decodeUriPart(text) {
  try {
    return decodeURIComponent(text || "");
  } catch {
    return text || "";
  }
}

export function parseHostPortFromRaw(raw) {
  const text = (raw || "").trim();
  if (!text) return null;

  const v6 = text.match(/^\[([^\]]+)\]:(\d{1,5})$/);
  if (v6) {
    const port = Number(v6[2]);
    if (port > 0 && port < 65536) return { host: v6[1], port };
  }

  const idx = text.lastIndexOf(":");
  if (idx > 0) {
    const host = text.slice(0, idx).trim();
    const portStr = text.slice(idx + 1).trim();
    if (/^\d{1,5}$/.test(portStr)) {
      const port = Number(portStr);
      if (port > 0 && port < 65536 && host) return { host, port };
    }
  }
  return null;
}

export function parseProxyInput(text, fallbackProtocol = "http") {
  let raw = (text || "").trim();
  if (!raw) return null;

  const out = {
    host: "",
    port: 0,
    username: "",
    password: "",
    protocol: null,
  };

  const schemeMatch = raw.match(SCHEME_RE);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    out.protocol = scheme.startsWith("socks") ? "socks5" : "http";
    raw = raw.slice(schemeMatch[0].length);
    const atIdx = raw.lastIndexOf("@");
    if (atIdx >= 0) {
      const userinfo = raw.slice(0, atIdx);
      raw = raw.slice(atIdx + 1);
      const colonIdx = userinfo.indexOf(":");
      if (colonIdx >= 0) {
        out.username = decodeUriPart(userinfo.slice(0, colonIdx));
        out.password = decodeUriPart(userinfo.slice(colonIdx + 1));
      } else {
        out.username = decodeUriPart(userinfo);
      }
    }
  } else {
    raw = raw.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0];
    const atIdx = raw.lastIndexOf("@");
    if (atIdx >= 0) {
      const userinfo = raw.slice(0, atIdx);
      raw = raw.slice(atIdx + 1);
      const colonIdx = userinfo.indexOf(":");
      if (colonIdx >= 0) {
        out.username = decodeUriPart(userinfo.slice(0, colonIdx));
        out.password = decodeUriPart(userinfo.slice(colonIdx + 1));
      } else {
        out.username = decodeUriPart(userinfo);
      }
    }
  }

  const hp = parseHostPortFromRaw(raw.split("/")[0].split("?")[0]);
  if (!hp) return null;
  out.host = hp.host;
  out.port = hp.port;
  if (!out.protocol) out.protocol = fallbackProtocol;
  return out;
}

const DEFAULT_HOSTPORT_RE =
  /(?:(?:\d{1,3}\.){3}\d{1,3}|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+):(\d{2,5})/g;

export function extractHostPorts(text, regexSource) {
  const found = [];
  const seen = new Set();
  const push = (host, port) => {
    const p = Number(port);
    if (!host || !(p > 0 && p < 65536)) return;
    const key = `${host}:${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ host, port: p });
  };

  const src = (regexSource || "").trim();
  if (src) {
    try {
      const re = new RegExp(src, "g");
      let m;
      while ((m = re.exec(text))) {
        if (m.groups?.host && m.groups?.port) {
          push(m.groups.host, m.groups.port);
        } else if (m[1] && m[2] && !/^\d+$/.test(m[1])) {
          push(m[1], m[2]);
        } else {
          const hp = parseHostPortFromRaw(m[0]);
          if (hp) push(hp.host, hp.port);
        }
        if (found.length >= 200) break;
      }
    } catch {
      /* fall through */
    }
  }

  if (!found.length) {
    DEFAULT_HOSTPORT_RE.lastIndex = 0;
    let m;
    while ((m = DEFAULT_HOSTPORT_RE.exec(text))) {
      const hp = parseHostPortFromRaw(m[0]);
      if (hp) push(hp.host, hp.port);
      if (found.length >= 200) break;
    }
  }
  return found;
}

export function formatProxy(p) {
  if (!p?.host) return "";
  const auth = p.username ? `${p.username}:***@` : "";
  return `${p.protocol || "http"}://${auth}${p.host}:${p.port}`;
}

export function shortProxy(p) {
  if (!p?.host) return "";
  return `${p.host}:${p.port}`;
}
