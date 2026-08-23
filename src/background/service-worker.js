import * as actions from "../shared/actions.js";

actions.initBackground();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
  return true;
});

async function handle(msg, sender) {
  switch (msg?.type) {
    case "GET_STATE":
      return actions.getPublicState();
    case "SAVE_DRAFT":
      return actions.saveDraft(msg.draft);
    case "NEW_DRAFT":
      return actions.newDraft();
    case "SELECT_PROFILE":
      return actions.selectProfile(msg.id);
    case "SET_SOURCE":
      return actions.setSource(msg.source);
    case "SET_JOYPROXY":
      return actions.setJoyproxyPrefs(msg.prefs);
    case "JOYPROXY_WEB_LOGIN":
      return actions.joyproxyWebLogin();
    case "SYNC_JOYPROXY_SESSION":
      return actions.syncJoyproxyFromBrowser();
    case "OPEN_JOYPROXY_DASHBOARD":
      return actions.openJoyproxyDashboard();
    case "SITE_SESSION": {
      const url = String(sender?.url || sender?.tab?.url || "");
      if (!/^https:\/\/(www\.)?joyproxy\.com\//i.test(url)) return { ok: false };
      return actions.applySiteSession(msg.session);
    }
    case "JOYPROXY_LOGOUT":
      return actions.joyproxyLogout();
    case "RUN_JOYPROXY":
      actions.runJoyproxy({ apply: msg.apply, once: msg.once }).catch((err) => console.warn("joyproxy", err));
      return { ok: true, started: true };
    case "STOP_JOYPROXY":
      return actions.stopJoyproxy();
    case "REFRESH_JOYPROXY":
      return actions.refreshJoyproxyCatalog();
    case "REFRESH_REAL_IP":
      return actions.refreshRealIp();
    case "TEST":
      return actions.testProxy(msg.proxy);
    case "CONNECT":
      return actions.connectProxy(msg.proxy, { fromExtract: msg.fromExtract, fromJoyproxy: msg.fromJoyproxy });
    case "DISCONNECT":
      return actions.disconnect();
    case "RETEST":
      return actions.retestCurrent();
    case "APPLY_PROFILE":
      return actions.applyProfile(msg.id);
    case "UPSERT_PROFILE":
      return actions.upsertProfile(msg.profile);
    case "REMOVE_PROFILE":
      return actions.removeProfile(msg.id);
    case "IMPORT_PROFILES":
      return actions.importProfiles(msg.text);
    case "IMPORT_EXTRACT_APIS":
      return actions.importExtractApis(msg.text);
    case "SAVE_EXTRACT":
      return actions.saveExtractConfig(msg.cfg);
    case "UPSERT_EXTRACT_API":
      return actions.upsertExtractApi();
    case "SELECT_EXTRACT_API":
      return actions.selectExtractApi(msg.id);
    case "NEW_EXTRACT_API":
      return actions.newExtractApi();
    case "REMOVE_EXTRACT_API":
      return actions.removeExtractApi(msg.id);
    case "RUN_EXTRACT":
      actions.runExtract().catch((err) => console.warn("extract", err));
      return { ok: true, started: true };
    case "STOP_EXTRACT":
      return actions.stopExtract();
    case "CLEAR_LOGS":
      return actions.clearLogs();
    case "SAVE_SETTINGS":
      return actions.saveSettings(msg.settings);
    case "SAVE_PRIVACY":
      return actions.savePrivacy(msg.privacy);
    case "SITE_CLEANUP":
      return actions.runSiteCleanup(msg.kind);
    case "RESTORE_PROXY":
      return actions.restorePreviousProxy();
    case "TEST_SITE":
      return actions.testCurrentSite(msg.url);
    default:
      throw new Error(`未知消息：${msg?.type}`);
  }
}
