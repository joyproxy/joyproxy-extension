const OFFSCREEN_URL = "src/offscreen/offscreen.html";
let creating = null;

async function hasOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) return chrome.offscreen.hasDocument();
  const contexts = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return Boolean(contexts?.length);
}

export async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ["DOM_SCRAPING"],
      justification:
        "Proxy connectivity checks run in a hidden worker so Chrome can complete HTTP proxy authentication.",
    })
    .catch((err) => {
      if (!/already exists|document is already/i.test(err?.message || "")) throw err;
    })
    .then(() => new Promise((r) => setTimeout(r, 120)))
    .finally(() => {
      creating = null;
    });
  await creating;
}

function fetchOnce(url, timeoutMs, method, useMainThread) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const port = chrome.runtime.connect({ name: "offscreen-fetch" });
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        port.disconnect();
      } catch {
        /* already closed */
      }
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new Error("检测通道超时")),
      Number(timeoutMs) + 2000
    );
    port.onMessage.addListener((res) => {
      if (res?.ok) finish(resolve, { status: res.status, text: res.text || "" });
      else finish(reject, new Error(res?.error || "Failed to fetch"));
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError?.message || "检测页面已断开";
      finish(reject, new Error(err));
    });
    try {
      port.postMessage({ url, timeoutMs, method, useMainThread: Boolean(useMainThread) });
    } catch (err) {
      finish(reject, err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function fetchThroughOffscreen(url, timeoutMs = 8000, opts = {}) {
  await ensureOffscreenDocument();
  return fetchOnce(url, timeoutMs, opts.method || "GET", Boolean(opts.useMainThread));
}
