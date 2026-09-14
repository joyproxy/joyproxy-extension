function readSession() {
  try {
    return {
      token: localStorage.getItem("joypyroxy_token") || "",
      email: localStorage.getItem("joypyroxy_email") || "",
      username: localStorage.getItem("joypyroxy_username") || "",
    };
  } catch {
    return { token: "", email: "", username: "" };
  }
}

function extensionAlive() {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function report() {
  if (!extensionAlive()) return false;
  try {
    chrome.runtime
      .sendMessage({ type: "SITE_SESSION", session: readSession() })
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

report();

window.addEventListener("storage", () => {
  report();
});

const onLoginPage = /login\.html|oauth-success\.html|register\.html/i.test(location.pathname);
if (onLoginPage || !readSession().token) {
  const timer = setInterval(() => {
    if (!extensionAlive()) {
      clearInterval(timer);
      return;
    }
    const session = readSession();
    report();
    if (session.token) clearInterval(timer);
  }, 800);
  setTimeout(() => clearInterval(timer), 180000);
}
