let worker = null;
let seq = 0;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(chrome.runtime.getURL("src/offscreen/fetch-worker.js"));
  worker.onmessage = (event) => {
    const { id, ok, status, text, error } = event.data || {};
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    clearTimeout(job.timer);
    if (ok) job.resolve({ status, text: text || "" });
    else job.reject(new Error(error || "Failed to fetch"));
  };
  worker.onerror = (err) => {
    for (const [, job] of pending) {
      clearTimeout(job.timer);
      job.reject(new Error(err?.message || "Worker error"));
    }
    pending.clear();
    worker = null;
  };
  return worker;
}

async function fetchViaMain(url, timeoutMs, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(timeoutMs) || 8000);
  try {
    const res = await fetch(url, {
      method: method || "GET",
      signal: ctrl.signal,
      cache: "no-store",
      headers: method === "HEAD" ? {} : { Accept: "application/json,text/plain,*/*" },
    });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

function fetchViaWorker(url, timeoutMs, method) {
  return new Promise((resolve, reject) => {
    const w = ensureWorker();
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("检测通道超时"));
    }, Number(timeoutMs) + 1500);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, url, timeoutMs, method: method || "GET" });
  });
}

async function fetchForProbe(url, timeoutMs, method, useMainThread) {
  if (useMainThread) return fetchViaMain(url, timeoutMs, method);
  return fetchViaWorker(url, timeoutMs, method);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "offscreen-fetch") return;
  port.onMessage.addListener((msg) => {
    fetchForProbe(msg?.url, msg?.timeoutMs, msg?.method, Boolean(msg?.useMainThread))
      .then((res) => {
        try {
          port.postMessage({ ok: true, ...res });
        } catch {
          /* port closed */
        }
      })
      .catch((err) => {
        try {
          port.postMessage({ ok: false, error: err?.message || String(err) });
        } catch {
          /* port closed */
        }
      });
  });
});
