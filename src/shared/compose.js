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
  let suppressCommit = false;

  function read() {
    const text = raw.value.trim();
    const parsed = parseProxyInput(text, protocol) || {};
    return {
      raw: text,
      protocol,
      username: user.value.trim() || parsed.username || "",
      password: pass.value || parsed.password || "",
      host: parsed.host,
      port: parsed.port,
      activeId,
    };
  }

  function load(draft) {
    raw.value = draft.raw || "";
    user.value = draft.username || "";
    pass.value = draft.password || "";
    protocol = asProto(draft.protocol);
    activeId = draft.activeId || "";
    syncProto();
    paintMeta();
    paintConnectBtn();
  }

  function syncProto() {
    for (const btn of proto.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.v === protocol);
    }
    const d = read();
    if (socksHint) socksHint.hidden = !(protocol === "socks5" && (d.username || d.password));
  }

  function paintMeta() {
    combo.refresh();
    const saved = Boolean(activeId);
    if (saveBtn) saveBtn.hidden = saved;
    if (newBtn) newBtn.hidden = !saved;
    if (delBtn) delBtn.hidden = !saved;
  }

  function matchProfile(text) {
    const t = (text || "").trim();
    return profiles.find((p) => `${p.host}:${p.port}` === t || p.name === t) || null;
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
          label: p.name && p.name !== value ? `${p.name} · ${value}` : value,
          active: p.id === activeId,
        };
      }),
    onSelect: async (item) => {
      if (item.id === activeId) {
        raw.value = item.value;
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
      return;
    }
    connectBtn.textContent = t("connect");
    connectBtn.classList.add("btn-primary");
  }

  async function persist(extra = {}) {
    const draft = { ...read(), ...extra };
    protocol = asProto(draft.protocol || protocol);
    await call("SAVE_DRAFT", { draft });
    paintConnectBtn();
  }

  async function run(type) {
    if (busy) return;
    if (locked && type !== "DISCONNECT") return;
    if (restoreInExtractTable() && type !== "DISCONNECT") return;
    await persist();
    const proxy = read();
    if (type !== "DISCONNECT" && (!proxy.host || !proxy.port)) return;
    busy = true;
    paintConnectBtn();
    try {
      await call(type, type === "DISCONNECT" ? {} : { proxy });
    } finally {
      busy = false;
      paintConnectBtn();
    }
  }

  proto.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-v]");
    if (!btn) return;
    protocol = asProto(btn.dataset.v);
    syncProto();
    persist({ protocol });
  });

  raw.addEventListener("paste", (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const parsed = parseProxyInput(text, protocol);
    if (!parsed) return;
    e.preventDefault();
    raw.value = `${parsed.host}:${parsed.port}`;
    if (parsed.protocol) protocol = asProto(parsed.protocol);
    if (parsed.username) user.value = parsed.username;
    if (parsed.password) pass.value = parsed.password;
    syncProto();
    persist();
  });

  raw.addEventListener("change", async () => {
    if (suppressCommit) return;
    const hit = matchProfile(raw.value);
    if (hit && hit.id !== activeId) {
      await call("SELECT_PROFILE", { id: hit.id });
      return;
    }
    await persist();
  });

  for (const el of [raw, user, pass]) {
    el.addEventListener("input", paintConnectBtn);
    if (el !== raw) el.addEventListener("blur", () => persist());
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        connectBtn.click();
      }
    });
  }

  testBtn.addEventListener("click", () => run("TEST"));
  connectBtn.addEventListener("click", () => run(shouldRestore() ? "DISCONNECT" : "CONNECT"));

  async function saveCurrent() {
    const d = read();
    const parsed = parseProxyInput(d.raw || "", d.protocol);
    if (!parsed) return false;
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
  };
}
