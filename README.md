# JoyProxy Extension

- **Official website:** https://www.joyproxy.com
- **Repository:** https://github.com/joyproxy/joyproxy-extension

> **JoyProxy** provides high-performance global proxy infrastructure and developer tools. Visit **https://www.joyproxy.com** for residential, datacenter, business/ISP, and mobile proxy services.

[English](#english) | [中文](#中文) | [繁體中文](#繁體中文)

---

<a id="english"></a>

## English

**JoyProxy Extension** is a Chromium (Manifest V3) browser proxy workbench. Paste your own `host:port`, wire a third-party extract API, or sign in with a JoyProxy account to test endpoints and apply a working proxy to **this browser only**. A JoyProxy account is an accelerator, not a gate: you can test and connect without logging in, and that path uses none of JoyProxy’s IP traffic.

- **Official website:** https://www.joyproxy.com
- **Repository:** https://github.com/joyproxy/joyproxy-extension
- **Related tools:** [Tester](https://github.com/joyproxy/joyproxy-tester) · [Android client](https://github.com/joyproxy/joyproxy-client-android) · [Proxy server](https://github.com/joyproxy/joyproxy-server)

---

### Features

1. **Own proxies**
   - Parse `host:port`, `user:pass@host:port`, and `http://` / `socks5://` URIs.
   - Test first (exit IP, country, latency). A failed test does **not** change the browser proxy.
   - Apply only after a successful test; restore the previous / direct settings in one click.
   - Save multiple profiles and import a list.

2. **Extract APIs**
   - Call a provider extract URL, optionally with a regex, and test each result in order.
   - **Test only**, or **apply as browser proxy after a successful test**.
   - Optional timed rotation. Stopping an applied session restores direct / previous settings.

3. **JoyProxy account**
   - Opening the JoyProxy tab detects whether this browser is already signed in on [www.joyproxy.com](https://www.joyproxy.com). If it is, purchased products load without an extra login click.
   - Dynamic (rotating) and static (including custom ports) lines; test, then apply as the browser proxy.
   - **Manage** opens the account dashboard. **Sign out** only signs the extension out; it does not sign you out of the website.

4. **Workbench and popup**
   - Toolbar popup: status, composer, optional JoyProxy quick pick.
   - Side-panel workbench: own proxies, APIs, JoyProxy products, run log, privacy / cleanup tools, and settings.
   - UI language: simplified Chinese, traditional Chinese, English. Theme: light / dark / auto.

5. **Hygiene and privacy (optional)**
   - Bypass list (JoyProxy site and API are prefilled).
   - Public IP + geo channels (`ipinfo.io`, `ipwhois.app`, `ip-api.com`, `api.myip.com`, or a custom URL). These checks do not consume JoyProxy traffic.
   - Optional WebRTC IP restriction after connect.
   - Workbench tools: User-Agent / language / timezone overrides, clear site cookies or cache.

---

### Install (load unpacked)

Works on Chrome, Edge, Brave, Opera, Vivaldi, and other Chromium browsers (**Chrome 114+**). There is no store listing yet; load the source folder.

1. Clone this repository:
   ```bash
   git clone https://github.com/joyproxy/joyproxy-extension.git
   cd joyproxy-extension
   ```
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository root (the folder that contains `manifest.json`).
5. Pin JoyProxy on the toolbar. Click the icon for the popup, or open the workbench from the popup.

After pulling updates, click **Reload** on the extension card.

---

### Quick start

**Own proxy**

1. Paste an address into the popup or the **Proxy address** tab.
2. Click **Test**. Confirm the exit IP and country.
3. Click **Set as proxy**. To go back, restore direct connection.

**Extract API**

1. Open the workbench → **API**.
2. Enter the extract URL (and regex if needed).
3. Choose **Test only** or **Apply after a successful test**, then start.

**JoyProxy products**

1. Sign in at [https://www.joyproxy.com](https://www.joyproxy.com) (email, Google, or GitHub).
2. Open the workbench → **JoyProxy**. If this browser is already signed in, products load automatically.
3. Pick a line, **Test**, then **Set as proxy**. **Manage** opens [the dashboard](https://www.joyproxy.com/admin-overview.html).

Buy traffic and dedicated lines on the [official website](https://www.joyproxy.com).

---

### Permissions and privacy

The extension changes **this browser’s** proxy (`chrome.proxy`). It does **not** write the Windows / macOS system proxy (use [JoyProxy Tester](https://github.com/joyproxy/joyproxy-tester) if you need that).

| Permission | Why |
|------------|-----|
| `proxy` | Apply or restore browser proxy settings |
| `storage` | Save profiles, settings, and the local session |
| `sidePanel` | Workbench |
| `contextMenus` | Right-click “test this site with the current proxy” |
| `webRequest` / `webRequestAuthProvider` | Fill HTTP proxy username/password |
| `tabs` / `scripting` | Open login or dashboard; read the JoyProxy site session |
| `privacy` | Optional WebRTC restriction |
| `webNavigation` / `declarativeNetRequest` | Optional header / UA overrides |
| `browsingData` | Clear cookies or cache from the workbench |
| Host access `<all_urls>` | Route arbitrary sites through the proxy and run optional page scripts |

Session tokens and proxy credentials stay in this browser’s extension storage. There is no analytics SDK. Connectivity tests call the geo channel you configure (default `ipinfo.io`). Signing in talks to `www.joyproxy.com` and `api.joyproxy.com` only.

---

### Limitations

- **Chromium only.** Firefox is not supported.
- **SOCKS5 username/password:** Chrome cannot attach credentials to SOCKS5. Use HTTP, or allow-list this machine’s exit IP on the SOCKS server.
- **Not a storefront.** Purchases, tickets, OpenAPI, MCP, and the scraping workbench stay on [www.joyproxy.com](https://www.joyproxy.com).
- Failed tests never overwrite a working browser proxy.

---

### Related open-source projects

| Project | Description |
|---------|-------------|
| [joyproxy-tester](https://github.com/joyproxy/joyproxy-tester) | Desktop connectivity tester (HTTP / SOCKS5 TCP / SOCKS5 UDP, Windows system proxy) |
| [joyproxy-client-android](https://github.com/joyproxy/joyproxy-client-android) | Android HTTP / SOCKS5 client |
| [joyproxy-server](https://github.com/joyproxy/joyproxy-server) | High-performance HTTP / SOCKS5 gateway for Linux and Windows |

---

### License

MIT License © 2026 JoyProxy

---

<a id="中文"></a>

## 中文

**JoyProxy 浏览器扩展** 是面向 Chromium 的 Manifest V3 代理工作台。可粘贴自有 `host:port`、接入第三方提取 API，或登录 JoyProxy 账号：先测通，再把可用代理应用到**当前浏览器**。账号是加速器，不是门票——不登录也能测通、设为代理，且这条路径不消耗 JoyProxy IP 流量。

- **官方网站：** https://www.joyproxy.com
- **开源仓库：** https://github.com/joyproxy/joyproxy-extension
- **相关工具：** [Tester](https://github.com/joyproxy/joyproxy-tester) · [Android 客户端](https://github.com/joyproxy/joyproxy-client-android) · [代理网关](https://github.com/joyproxy/joyproxy-server)

---

### 核心功能

1. **自有代理**
   - 解析 `host:port`、`user:pass@host:port` 以及 `http://` / `socks5://` 链接。
   - 先测试（出口 IP、国家、延迟）。测试失败**不会**改浏览器代理。
   - 测通后再设为代理；一键恢复直连或接管前的设置。
   - 多档案保存与批量导入。

2. **提取 API**
   - 请求供应商提取地址，可用正则取出节点并逐条测试。
   - **仅测试**，或 **测通后设为浏览器代理**。
   - 可选定时轮换；停止「已设为代理」的会话时恢复直连。

3. **JoyProxy 账号**
   - 打开 JoyProxy 栏时，自动检测本浏览器是否已在 [www.joyproxy.com](https://www.joyproxy.com) 登录；已登录则直接加载已购产品。
   - 动态（轮换）与静态（含自定义端口）：测通后再设为浏览器代理。
   - **管理** 打开用户后台；**退出** 只退出扩展，不会退出网站。

4. **工作台与弹窗**
   - 工具栏弹窗：状态、地址栏、可选 JoyProxy 快捷选用。
   - 侧栏工作台：自有代理、API、JoyProxy 产品、运行日志、隐私/清理、系统设置。
   - 界面语言：简体中文、繁体中文、英语；主题：浅色 / 深色 / 跟随系统。

5. **卫生与隐私（可选）**
   - Bypass 名单（已预填 JoyProxy 站点与 API）。
   - 公共 IP + Geo 通道（`ipinfo.io`、`ipwhois.app`、`ip-api.com`、`api.myip.com` 或自定义 URL），不消耗 JoyProxy 流量。
   - 连接成功后可选限制 WebRTC。
   - 工作台可改 User-Agent / 语言 / 时区，清理站点 Cookie 或缓存。

---

### 安装（加载已解压扩展）

适用于 Chrome、Edge、Brave、Opera、Vivaldi 等 Chromium 浏览器（**Chrome 114+**）。目前未上架商店，请直接加载源码目录。

1. 克隆仓库：
   ```bash
   git clone https://github.com/joyproxy/joyproxy-extension.git
   cd joyproxy-extension
   ```
2. 打开 `chrome://extensions`。
3. 打开右上角 **开发者模式**。
4. 点击 **加载已解压的扩展程序**，选择仓库根目录（含 `manifest.json` 的文件夹）。
5. 将 JoyProxy 固定到工具栏。点击图标打开弹窗，或从弹窗进入工作台。

拉取更新后，在扩展卡片上点 **重新加载**。

---

### 快速上手

**自有代理**

1. 在弹窗或「代理地址」栏粘贴地址。
2. 点 **测试**，确认出口 IP 与国家。
3. 点 **设为代理**。返回直连时使用恢复直连。

**提取 API**

1. 打开工作台 → **API**。
2. 填写提取 URL（需要时加正则）。
3. 选择 **仅测试** 或 **测通后设为代理**，然后开始。

**JoyProxy 产品**

1. 在 [https://www.joyproxy.com](https://www.joyproxy.com) 登录（邮箱、Google 或 GitHub）。
2. 打开工作台 → **JoyProxy**。若本浏览器已登录，产品会自动加载。
3. 选择线路，**测试** 通过后再 **设为代理**。**管理** 打开 [用户后台](https://www.joyproxy.com/admin-overview.html)。

购买流量与独立线路请前往 [官网](https://www.joyproxy.com)。

---

### 权限与隐私

扩展只改**当前浏览器**的代理（`chrome.proxy`），**不写** Windows / macOS 系统代理（需要系统代理请用 [JoyProxy Tester](https://github.com/joyproxy/joyproxy-tester)）。

| 权限 | 用途 |
|------|------|
| `proxy` | 设置或恢复浏览器代理 |
| `storage` | 保存档案、设置与本地登录态 |
| `sidePanel` | 工作台 |
| `contextMenus` | 右键「用当前代理测试此站」 |
| `webRequest` / `webRequestAuthProvider` | 为 HTTP 代理填写账密 |
| `tabs` / `scripting` | 打开登录页或后台；读取网站登录态 |
| `privacy` | 可选限制 WebRTC |
| `webNavigation` / `declarativeNetRequest` | 可选请求头 / UA 覆盖 |
| `browsingData` | 工作台清理 Cookie 或缓存 |
| 主机权限 `<all_urls>` | 让任意网站走代理，并运行可选页面脚本 |

登录令牌与代理账密只存在本机扩展存储。不含统计 SDK。测通会请求你配置的 Geo 通道（默认 `ipinfo.io`）。登录只访问 `www.joyproxy.com` 与 `api.joyproxy.com`。

---

### 限制

- **仅 Chromium**，不支持 Firefox。
- **SOCKS5 账密：** Chrome 无法为 SOCKS5 携带用户名密码。请改用 HTTP，或在 SOCKS 服务端把本机出口 IP 加入白名单。
- **不是商城。** 购买、工单、OpenAPI、MCP、采集工作台仍在 [www.joyproxy.com](https://www.joyproxy.com)。
- 测试失败不会覆盖当前正在使用的浏览器代理。

---

### 相关开源项目

| 项目 | 说明 |
|------|------|
| [joyproxy-tester](https://github.com/joyproxy/joyproxy-tester) | 桌面测通工具（HTTP / SOCKS5 TCP / SOCKS5 UDP，可写 Windows 系统代理） |
| [joyproxy-client-android](https://github.com/joyproxy/joyproxy-client-android) | Android HTTP / SOCKS5 客户端 |
| [joyproxy-server](https://github.com/joyproxy/joyproxy-server) | Linux / Windows 高性能 HTTP / SOCKS5 网关 |

---

### 许可证

MIT License © 2026 JoyProxy

---

<a id="繁體中文"></a>

## 繁體中文

**JoyProxy 瀏覽器擴充功能** 是面向 Chromium 的 Manifest V3 代理工作臺。可貼上自有 `host:port`、接入第三方提取 API，或登入 JoyProxy 帳號：先測通，再把可用代理套用到**目前瀏覽器**。帳號是加速器，不是門票——未登入也能測通、設為代理，且這條路徑不消耗 JoyProxy IP 流量。

- **官方網站：** https://www.joyproxy.com
- **開源倉庫：** https://github.com/joyproxy/joyproxy-extension
- **相關工具：** [Tester](https://github.com/joyproxy/joyproxy-tester) · [Android 客戶端](https://github.com/joyproxy/joyproxy-client-android) · [代理閘道](https://github.com/joyproxy/joyproxy-server)

---

### 核心功能

1. **自有代理**
   - 解析 `host:port`、`user:pass@host:port` 以及 `http://` / `socks5://` 連結。
   - 先測試（出口 IP、國家、延遲）。測試失敗**不會**改瀏覽器代理。
   - 測通後再設為代理；一鍵恢復直連或接管前的設定。
   - 多檔案儲存與批次匯入。

2. **提取 API**
   - 請求供應商提取網址，可用正規表示式取出節點並逐條測試。
   - **僅測試**，或 **測通後設為瀏覽器代理**。
   - 可選定時輪換；停止「已設為代理」的工作階段時恢復直連。

3. **JoyProxy 帳號**
   - 開啟 JoyProxy 欄時，自動偵測本瀏覽器是否已在 [www.joyproxy.com](https://www.joyproxy.com) 登入；已登入則直接載入已購產品。
   - 動態（輪換）與靜態（含自訂連接埠）：測通後再設為瀏覽器代理。
   - **管理** 開啟使用者後台；**登出** 只登出擴充功能，不會登出網站。

4. **工作臺與彈窗**
   - 工具列彈窗：狀態、地址欄、可選 JoyProxy 快捷選用。
   - 側欄工作臺：自有代理、API、JoyProxy 產品、執行日誌、隱私/清理、系統設定。
   - 介面語言：簡體中文、繁體中文、英語；主題：淺色 / 深色 / 跟隨系統。

5. **衛生與隱私（可選）**
   - Bypass 名單（已預填 JoyProxy 站點與 API）。
   - 公共 IP + Geo 通道（`ipinfo.io`、`ipwhois.app`、`ip-api.com`、`api.myip.com` 或自訂 URL），不消耗 JoyProxy 流量。
   - 連線成功後可選限制 WebRTC。
   - 工作臺可改 User-Agent / 語言 / 時區，清理網站 Cookie 或快取。

---

### 安裝（載入已解壓縮的擴充功能）

適用於 Chrome、Edge、Brave、Opera、Vivaldi 等 Chromium 瀏覽器（**Chrome 114+**）。目前未上架商店，請直接載入原始碼目錄。

1. 複製倉庫：
   ```bash
   git clone https://github.com/joyproxy/joyproxy-extension.git
   cd joyproxy-extension
   ```
2. 開啟 `chrome://extensions`。
3. 開啟右上角 **開發人員模式**。
4. 點擊 **載入未封裝項目**，選擇倉庫根目錄（含 `manifest.json` 的資料夾）。
5. 將 JoyProxy 固定到工具列。點擊圖示開啟彈窗，或從彈窗進入工作臺。

拉取更新後，在擴充功能卡片上點 **重新載入**。

---

### 快速上手

**自有代理**

1. 在彈窗或「代理地址」欄貼上地址。
2. 點 **測試**，確認出口 IP 與國家。
3. 點 **設為代理**。返回直連時使用恢復直連。

**提取 API**

1. 開啟工作臺 → **API**。
2. 填寫提取 URL（需要時加正規表示式）。
3. 選擇 **僅測試** 或 **測通後設為代理**，然後開始。

**JoyProxy 產品**

1. 在 [https://www.joyproxy.com](https://www.joyproxy.com) 登入（電子郵件、Google 或 GitHub）。
2. 開啟工作臺 → **JoyProxy**。若本瀏覽器已登入，產品會自動載入。
3. 選擇線路，**測試** 通過後再 **設為代理**。**管理** 開啟 [使用者後台](https://www.joyproxy.com/admin-overview.html)。

購買流量與獨立線路請前往 [官網](https://www.joyproxy.com)。

---

### 權限與隱私

擴充功能只改**目前瀏覽器**的代理（`chrome.proxy`），**不寫** Windows / macOS 系統代理（需要系統代理請用 [JoyProxy Tester](https://github.com/joyproxy/joyproxy-tester)）。

| 權限 | 用途 |
|------|------|
| `proxy` | 設定或恢復瀏覽器代理 |
| `storage` | 儲存檔案、設定與本機登入狀態 |
| `sidePanel` | 工作臺 |
| `contextMenus` | 右鍵「用目前代理測試此站」 |
| `webRequest` / `webRequestAuthProvider` | 為 HTTP 代理填寫帳密 |
| `tabs` / `scripting` | 開啟登入頁或後台；讀取網站登入狀態 |
| `privacy` | 可選限制 WebRTC |
| `webNavigation` / `declarativeNetRequest` | 可選請求頭 / UA 覆蓋 |
| `browsingData` | 工作臺清理 Cookie 或快取 |
| 主機權限 `<all_urls>` | 讓任意網站走代理，並執行可選頁面指令碼 |

登入權杖與代理帳密只存在本機擴充功能儲存空間。不含統計 SDK。測通會請求你設定的 Geo 通道（預設 `ipinfo.io`）。登入只存取 `www.joyproxy.com` 與 `api.joyproxy.com`。

---

### 限制

- **僅 Chromium**，不支援 Firefox。
- **SOCKS5 帳密：** Chrome 無法為 SOCKS5 攜帶使用者名稱與密碼。請改用 HTTP，或在 SOCKS 伺服器把本機出口 IP 加入白名單。
- **不是商城。** 購買、工單、OpenAPI、MCP、採集工作臺仍在 [www.joyproxy.com](https://www.joyproxy.com)。
- 測試失敗不會覆蓋目前正在使用的瀏覽器代理。

---

### 相關開源專案

| 專案 | 說明 |
|------|------|
| [joyproxy-tester](https://github.com/joyproxy/joyproxy-tester) | 桌面測通工具（HTTP / SOCKS5 TCP / SOCKS5 UDP，可寫 Windows 系統代理） |
| [joyproxy-client-android](https://github.com/joyproxy/joyproxy-client-android) | Android HTTP / SOCKS5 客戶端 |
| [joyproxy-server](https://github.com/joyproxy/joyproxy-server) | Linux / Windows 高效能 HTTP / SOCKS5 閘道 |

---

### 授權

MIT License © 2026 JoyProxy
