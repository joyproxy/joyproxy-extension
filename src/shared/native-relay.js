import { isLocalRelayRunning, relayPort } from "./local-relay.js";

const NATIVE_HOST = "com.joyproxy.relay";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nativeCall(payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (err) {
      reject(err);
      return;
    }
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        /* ignore */
      }
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new Error("native relay timeout")),
      timeoutMs
    );
    port.onMessage.addListener((msg) => finish(resolve, msg));
    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError?.message || "native relay disconnected";
      finish(reject, new Error(err));
    });
    try {
      port.postMessage(payload);
    } catch (err) {
      finish(reject, err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function ensureLocalRelay(proxy, settings) {
  if (await isLocalRelayRunning(settings)) return true;
  if (!chrome.runtime?.connectNative) return false;
  try {
    const res = await nativeCall({
      action: "ensure",
      listen: relayPort(settings),
      upstream: proxy.host,
      upstreamPort: Number(proxy.port),
      user: String(proxy.username || ""),
      pass: String(proxy.password || ""),
    });
    if (!res?.ok) return false;
    await sleep(300);
    return isLocalRelayRunning(settings);
  } catch {
    return false;
  }
}
