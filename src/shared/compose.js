import { parseProxyInput } from "./parse.js";
import { call } from "./rpc.js";
import { bindCombo } from "./combo.js";
import { t } from "./i18n.js";

function asProto(v) {
  return v === "socks5" ? "socks5" : "http";
}

function emptyDraft() {
  return { raw: "", protocol: "http", username: "", password: "", activeId: "" };
}

export function bindComposer(root) {
  const raw = root.querySelector("[data-raw]");
  const portEl = root.querySelector("[data-port]");
  const user = root.querySelector("[data-user]");
  const pass = root.querySelector("[data-pass]");
  const proto = root.querySelector("[data-proto]");
  const socksHint = root.querySelector("[data-socks-hint]");
  const testBtn = root.querySelector("[data-test]");
  const connectBtn = root.querySelector("[data-connect]");
  const testWrap = root.querySelector("[data-test-wrap]");
  const connectWrap = root.querySelector("[data-connect-wrap]");
  const saveBtn = root.querySelector("[data-profile-save]");
  const newBtn = root.querySelector("[data-profile-new]");
  const delBtn = root.querySelector("[data-profile-del]");
  let protocol = "http";
  let busy = false;
  let hydrated = false;
  let currentConn = null;
  let locked = false;
  let profiles = [];
  let activeId = "";
  let settings = { useLocalRelay: false, localRelayPort: 17890 };
  let suppressCommit = false;

  function applyParsed(parsed) {
    if (!parsed) return;
    raw.value = parsed.host || "";
    if (portEl) portEl.value = parsed.port ? String(parsed.port) : "";
    if (parsed.protocol) protocol = asProto(parsed.protocol);
    if (parsed.username) user.value = parsed.username;
    if (parsed.password) pass.value = parsed.password;
    syncProto();
  }

  function parseFromFields() {
    const host = raw.value.trim();
    const portText = (portEl?.value || "").trim();
    return parseProxyInput(host, protocol) || (host && portText ? parseProxyInput(`${host}:${portText}`, protocol) : null);
  }

  function read() {
    const parsed = parseFromFields() || {};
    const host = parsed.host || raw.value.trim();
    const port = parsed.port || Number((portEl?.value || "").trim()) || 0;
    return {
      raw: host && port ? `${host}:${port}` : host,
      protocol,
      username: user.value.trim() || parsed.username || "",
      password: pass.value || parsed.password || "",
      host,
      port,
      activeId,
    };
  }

  function load(draft) {
    protocol = asProto(draft.protocol);
    const parsed = parseProxyInput(draft.raw || "", protocol);
    if (parsed) {
      raw.value = parsed.host;
      if (portEl) portEl.value = String(parsed.port);
    } else {
      raw.value = draft.host || draft.raw || "";
      if (portEl) portEl.value = draft.port ? String(draft.port) : "";
    }
    user.value = draft.username || "";
    pass.value = draft.password || "";
    activeId = draft.activeId || "";
    syncProto();
    paintMeta();
    paintConnectBtn();
  }

  function syncProto() {
    if (proto) {
      for (const btn of proto.querySelectorAll("button")) {
        btn.classList.toggle("active", btn.dataset.v === protocol);
      }
    }
    if (socksHint) socksHint.hidden = true;
  }

  function paintMeta() {
    combo.refresh();
    const saved = Boolean(activeId);
    if (saveBtn) saveBtn.hidden = saved;
    if (newBtn) newBtn.hidden = !saved;
    if (delBtn) delBtn.hidden = !saved;
  }

  function matchProfile(hostText, portText) {
    const host = (hostText || "").trim();
    const port = String(portText || "").trim();
    const combined = port ? `${host}:${port}` : host;
    return (
      profiles.find((p) => `${p.host}:${p.port}` === combined) ||
      (host && port ? profiles.find((p) => p.host === host && String(p.port) === port) : null) ||
      profiles.find((p) => p.name === combined || p.name === host) ||
      null
    );
  }

  const combo = bindCombo({
    input: raw,
    toggle: root.querySelector("[data-profile-toggle]"),
    menu: root.querySelector("[data-profile-menu]"),
    getItems: () =>
      profiles.map((p) => {
        const value = `${p.host}:${p.port}`;
        return {
          id: p.id,
          value,
          host: p.host,
          port: p.port,
          label: p.name && p.name !== value ? `${p.name} · ${value}` : value,
          active: p.id === activeId,
        };
      }),
    onSelect: async (item) => {
      if (item.host) {
        raw.value = item.host;
        if (portEl) portEl.value = item.port ? String(item.port) : "";
      } else {
        applyParsed(parseProxyInput(item.value, protocol));
      }
      if (item.id === activeId) {
        paintConnectBtn();
        return;
      }
      await call("SELECT_PROFILE", { id: item.id });
    },
  });

  function restoreInExtractTable() {
    const pane = document.querySelector("[data-source-pane='extract']");
    if (!pane || pane.hidden) return false;
    return Boolean(currentConn?.fromExtract && !currentConn?.fromJoyproxy && document.getElementById("extract-body"));
  }

  function shouldRestore() {
    if (!currentConn) return false;
    if (restoreInExtractTable()) return false;
    if (locked || currentConn.fromExtract || currentConn.fromJoyproxy) return true;
    const d = read();
    if (!d.host || !d.port) return true;
    return d.host === currentConn.host && Number(d.port) === Number(currentConn.port);
  }

  function setTip(el, text) {
    if (!el) return;
    if (text) el.setAttribute("data-tip", text);
    else el.removeAttribute("data-tip");
  }

  function paintConnectBtn() {
    const restore = shouldRestore();
    const extractHold = restoreInExtractTable();
    connectBtn.disabled = busy || (locked && !restore) || extractHold;
    testBtn.disabled = busy || locked;
    testBtn.textContent = busy ? t("testing") : t("test");
    setTip(testWrap, locked ? t("lock.tip") : "");
    setTip(connectWrap, locked ? t("lock.tip") : extractHold ? t("extract.holdTip") : "");
    connectBtn.classList.remove("btn-primary", "btn-danger");
    if (busy) {
      connectBtn.textContent = restore ? t("restoring") : t("connecting");
      connectBtn.classList.add(restore ? "btn-danger" : "btn-primary");
      return;
    }
    if (restore) {
      connectBtn.textContent = t("restore");
      connectBtn.classList.add("btn-danger");
      connectBtn.title = t("restore.tip");
      return;
    }
    connectBtn.textContent = t("connect");
    connectBtn.classList.add("btn-primary");
    connectBtn.title = t("connect.skipTip");
  }

  async function persist(extra = {}) {
    const draft = { ...read(), ...extra };
    protocol = asProto(draft.protocol || protocol);
    await call("SAVE_DRAFT", { draft });
    paintConnectBtn();
  }

  async function run(type, extra = {}) {
    if (busy) return;
    if (locked && type !== "DISCONNECT") return;
    if (restoreInExtractTable() && type !== "DISCONNECT") return;
    await persist();
    const proxy = read();
    if (type !== "DISCONNECT" && (!proxy.host || !proxy.port)) return;
    busy = true;
    paintConnectBtn();
    try {
      await call(type, type === "DISCONNECT" ? {} : { proxy, ...extra });
    } finally {
      busy = false;
      paintConnectBtn();
    }
  }

  if (proto) {
    proto.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      if (!btn) return;
      protocol = asProto(btn.dataset.v);
      syncProto();
      persist({ protocol });
    });
  }

  function onPasteProxy(e) {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const parsed = parseProxyInput((text || "").trim(), protocol);
    if (!parsed) return;
    e.preventDefault();
    applyParsed(parsed);
    persist();
  }

  raw.addEventListener("paste", onPasteProxy);
  portEl?.addEventListener("paste", onPasteProxy);

  raw.addEventListener("change", async () => {
    if (suppressCommit) return;
    const parsed = parseProxyInput(raw.value.trim(), protocol);
    if (parsed) applyParsed(parsed);
    const d = read();
    const hit = matchProfile(d.host, d.port);
    if (hit && hit.id !== activeId) {
      await call("SELECT_PROFILE", { id: hit.id });
      return;
    }
    await persist();
  });

  portEl?.addEventListener("change", async () => {
    if (suppressCommit) return;
    await persist();
  });

  for (const el of [raw, portEl, user, pass].filter(Boolean)) {
    el.addEventListener("input", () => {
      paintConnectBtn();
    });
    if (el !== raw) el.addEventListener("blur", () => persist());
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        connectBtn.click();
      }
    });
  }

  testBtn.addEventListener("click", () => run("TEST"));
  connectBtn.addEventListener("click", (e) => {
    if (shouldRestore()) return run("DISCONNECT");
    run("CONNECT", { skipTest: e.shiftKey });
  });

  async function saveCurrent() {
    const d = read();
    const parsed =
      d.host && d.port
        ? {
            host: d.host,
            port: Number(d.port),
            protocol: asProto(d.protocol),
            username: d.username,
            password: d.password,
          }
        : parseProxyInput(d.raw || "", d.protocol);
    if (!parsed?.host || !parsed?.port) return false;
    const same = profiles.find(
      (p) =>
        p.id !== activeId &&
        p.host === parsed.host &&
        Number(p.port) === Number(parsed.port) &&
        asProto(p.protocol) === asProto(d.protocol)
    );
    const next = await call("UPSERT_PROFILE", {
      profile: {
        id: activeId || same?.id,
        name: `${parsed.host}:${parsed.port}`,
        host: parsed.host,
        port: parsed.port,
        protocol: asProto(d.protocol || parsed.protocol),
        username: d.username || parsed.username || "",
        password: d.password || parsed.password || "",
      },
    });
    if (next?.pendingDraft?.activeId) {
      activeId = next.pendingDraft.activeId;
      if (Array.isArray(next.profiles)) profiles = next.profiles;
      paintMeta();
    }
    return true;
  }

  saveBtn?.addEventListener("click", () => saveCurrent());

  newBtn?.addEventListener("click", async () => {
    suppressCommit = true;
    try {
      await call("NEW_DRAFT");
      load(emptyDraft());
      hydrated = true;
    } finally {
      suppressCommit = false;
    }
  });

  delBtn?.addEventListener("click", async () => {
    if (!activeId) return;
    suppressCommit = true;
    const id = activeId;
    try {
      await call("REMOVE_PROFILE", { id });
      load(emptyDraft());
      hydrated = true;
    } finally {
      suppressCommit = false;
    }
  });

  return {
    read,
    isFocused() {
      return root.contains(document.activeElement);
    },
    applyDraft(draft) {
      if (!draft || suppressCommit) return;
      const nextId = draft.activeId || "";
      if (this.isFocused() && hydrated && nextId === activeId) return;
      load(draft);
      hydrated = true;
    },
    setProfiles(list, id) {
      profiles = Array.isArray(list) ? list : [];
      if (id !== undefined) activeId = id || "";
      paintMeta();
    },
    setConnected(conn) {
      currentConn = conn || null;
      paintConnectBtn();
    },
    setLocked(on) {
      locked = Boolean(on);
      paintConnectBtn();
    },
    applySettings(next) {
      if (!next) return;
      settings = { ...settings, ...next };
    },
  };
}
