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

function report() {
  chrome.runtime.sendMessage({ type: "SITE_SESSION", session: readSession() }).catch(() => {});
}

report();

window.addEventListener("storage", report);

const onLoginPage = /login\.html|oauth-success\.html|register\.html/i.test(location.pathname);
if (onLoginPage || !readSession().token) {
  const timer = setInterval(() => {
    const session = readSession();
    report();
    if (session.token) clearInterval(timer);
  }, 800);
  setTimeout(() => clearInterval(timer), 180000);
}
