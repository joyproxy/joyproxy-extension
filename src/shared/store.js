const KEY = "joyproxy.v1";

export const DEFAULT_BYPASS = [
  "localhost",
  "127.0.0.1",
  "<local>",
  "*.joyproxy.com",
  "api.joyproxy.com",
  "www.joyproxy.com",
];

export const DEFAULT_STATE = {
  persona: "guest",
  realIp: null,
  connection: null,
  lastTest: null,
  pendingDraft: {
    raw: "",
    protocol: "http",
    username: "",
    password: "",
    activeId: "",
  },
  source: "own",
  joyproxy: {
    kind: "dynamic",
    mode: "probe",
    network: "residential",
    country: "",
    countryGeoname: "",
    product: "residential",
    selectedId: "",
    timed: false,
    intervalSec: 10,
    count: 0,
    running: false,
    protocol: "http",
    duration: "2m",
    email: "",
    method: "",
    token: "",
    extractToken: "",
    masterToken: "",
    awaitingLogin: false,
    ignoreSiteUntilLogin: false,
    catalogLoading: false,
    catalog: { loaded: false, networks: [], lines: [], countries: [], error: "" },
    rows: [],
  },
  recent: [],
  profiles: [],
  extract: {
    name: "",
    url: "",
    regex: "",
    count: 0,
    intervalMs: 0,
    intervalSec: 0,
    timed: false,
    protocol: "http",
    username: "",
    password: "",
    mode: "probe",
    activeId: "",
    rows: [],
    running: false,
    lastSummary: null,
  },
  extractApis: [],
  logs: [],
  settings: {
    bypass: [...DEFAULT_BYPASS],
    geoChannel: "ipinfo",
    customGeoUrl: "",
    restrictWebRTC: false,
    socks5AuthHintDismissed: false,
    proxyMode: "all",
    proxyInclude: [],
    uiLocale: "auto",
    uiTheme: "auto",
    privacy: {
      userAgentId: "",
      userAgentCustom: "",
      language: "",
      timezone: "",
      stripReferer: false,
      dnt: false,
      hardwareConcurrency: "",
      deviceMemory: "",
      maxTouchPoints: "",
      devicePixelRatio: "",
      screen: "",
      webglId: "",
      fontId: "",
      canvasNoise: false,
      random: {},
    },
  },
  savedProxySettings: null,
  seeded: false,
};

const PERSONA_META = {
  guest: { loggedIn: false, purchased: false },
  purchased: { loggedIn: true, purchased: true },
};

export function personaMeta(id) {
  return PERSONA_META[id] || PERSONA_META.guest;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export async function loadState() {
  const bag = await chrome.storage.local.get(KEY);
  const saved = bag[KEY];
  if (!saved) {
    const state = clone(DEFAULT_STATE);
    seedDemo(state);
    await saveState(state);
    return state;
  }
  const state = { ...clone(DEFAULT_STATE), ...saved };
  state.settings = { ...DEFAULT_STATE.settings, ...(saved.settings || {}) };
  state.settings.privacy = {
    ...DEFAULT_STATE.settings.privacy,
    ...(saved.settings?.privacy || {}),
    random: {
      ...DEFAULT_STATE.settings.privacy.random,
      ...(saved.settings?.privacy?.random || {}),
    },
  };
  state.pendingDraft = { ...DEFAULT_STATE.pendingDraft, ...(saved.pendingDraft || {}) };
  state.extract = { ...DEFAULT_STATE.extract, ...(saved.extract || {}) };
  if (!state.pendingDraft.raw && !state.pendingDraft.activeId) state.pendingDraft.protocol = "http";
  if (!state.extract.url && !state.extract.activeId) state.extract.protocol = "http";
  state.extractApis = Array.isArray(saved.extractApis) ? saved.extractApis : [];
  if (state.extract.mode === "switch") state.extract.mode = "apply";
  state.joyproxy = { ...DEFAULT_STATE.joyproxy, ...(saved.joyproxy || {}) };
  state.joyproxy.catalog = {
    ...DEFAULT_STATE.joyproxy.catalog,
    ...(saved.joyproxy?.catalog || {}),
  };
  if (!Array.isArray(state.joyproxy.rows)) state.joyproxy.rows = [];
  let dirty = false;
  if (state.persona === "trial") {
    state.persona = state.joyproxy?.token ? "purchased" : "guest";
    dirty = true;
  }
  if (state.persona === "purchased" && !state.joyproxy?.token) {
    state.persona = "guest";
    dirty = true;
  }
  if (dirty) await saveState(state);
  return state;
}

export async function saveState(state) {
  await chrome.storage.local.set({ [KEY]: state });
  return state;
}

export async function patchState(mutator) {
  const state = await loadState();
  const next = await mutator(state);
  const out = next || state;
  await saveState(out);
  return out;
}

function seedDemo(state) {
  state.seeded = true;
  state.logs = [{ id: "l1", at: Date.now(), level: "info", text: "扩展已加载。粘贴代理后可测试，确认无误再设为代理。" }];
}

export function pushLog(state, text, level = "info") {
  state.logs.unshift({
    id: `l${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    at: Date.now(),
    level,
    text,
  });
  state.logs = state.logs.slice(0, 200);
}

export function pushRecent(state, item) {
  const label = item.label || `${item.host}:${item.port}`;
  state.recent = [
    { ...item, id: item.id || `r${Date.now()}`, label, at: Date.now() },
    ...state.recent.filter((r) => r.label !== label),
  ].slice(0, 12);
}

