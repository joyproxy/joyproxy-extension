self.onmessage = async (event) => {
  const { id, url, timeoutMs, method } = event.data || {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(timeoutMs) || 8000);
  try {
    const res = await fetch(url, {
      method: method || "GET",
      signal: ctrl.signal,
      cache: "no-store",
      headers: method === "HEAD" ? {} : { Accept: "application/json" },
    });
    const text = await res.text();
    self.postMessage({ id, ok: true, status: res.status, text });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  } finally {
    clearTimeout(timer);
  }
};
