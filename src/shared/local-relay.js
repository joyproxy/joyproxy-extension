import { hasHttpAuth } from "./proxy-settings.js";
import { t } from "./i18n.js";

export const LOCAL_RELAY_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_RELAY_PORT = 17890;

export function shouldUseLocalRelay(proxy, settings) {
  if (!hasHttpAuth(proxy)) return false;
  if (settings?.useLocalRelay === false) return false;
  return true;
}

export function relayPort(settings) {
  const port = Number(settings?.localRelayPort);
  return port > 0 && port < 65536 ? port : DEFAULT_LOCAL_RELAY_PORT;
}

export function relayEndpoint(settings) {
  return {
    host: LOCAL_RELAY_HOST,
    port: relayPort(settings),
    protocol: "http",
    username: "",
    password: "",
  };
}

export function browserProxyTarget(proxy, settings) {
  if (shouldUseLocalRelay(proxy, settings)) return relayEndpoint(settings);
  return proxy;
}

export function buildLocalProxyCommand(proxy, settings) {
  const port = relayPort(settings);
  const user = JSON.stringify(String(proxy.username || ""));
  const pass = JSON.stringify(String(proxy.password || ""));
  return `native\\joyproxy-relay.exe（由扩展自动启动，无需安装 Python）`;
}

export async function isLocalRelayRunning(settings) {
  const port = relayPort(settings);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/_joyproxy_health`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function localRelayRequiredError(proxy, settings, extensionId = "") {
  const id = String(extensionId || "").trim();
  const expect = "fcollkhjhmcaieegdojbeaoonkdjikfo";
  if (id && id !== expect) {
    return t("err.relayIdMismatch", { id, expect });
  }
  if (id) return t("err.relayInstall");
  return t("err.relayGeneric");
}
