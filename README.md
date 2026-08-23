# JoyProxy Extension

- **Official website:** https://www.joyproxy.com
- **Repository:** https://github.com/joyproxy/joyproxy-extension

> **JoyProxy** provides high-performance global proxy infrastructure and developer tools. Visit **https://www.joyproxy.com** for residential, datacenter, business/ISP, and mobile proxy services.

[English](#english) | [中文](#中文) | [繁體中文](#繁體中文)

---

<a id="english"></a>

## English

**JoyProxy Extension** is a Chromium (Manifest V3) browser proxy workbench. Paste your own `host:port`, use a third-party extract API, or sign in to use lines you bought on JoyProxy — test first, then apply a working proxy to **this browser only** (it does not change the computer’s system proxy).

You can test and apply **your own** proxies without a JoyProxy account. Sign in only when you want to use products purchased on the website. Using your own proxy does not consume JoyProxy traffic.

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
   - Toolbar popup: current status, paste a proxy; after sign-in, a quick JoyProxy line picker.
   - **Open workbench** for the full UI: own proxies, APIs, JoyProxy products, run log, **Advanced**, and **System**.
   - UI language: Simplified Chinese, Traditional Chinese, English. Theme: light / dark / follow the browser.

5. **Advanced** (workbench → **Advanced**)
   - **Proxy scope:** send all traffic through the proxy (except a bypass list), or only the domains / IPs / URLs you list. The bypass list is prefilled with JoyProxy’s site and API.
   - **Common:** User-Agent (presets or a custom string), restrict WebRTC to reduce real-IP leaks, clear cookies or all data for the current site.
   - **More:** language, timezone, screen size, device pixel ratio, CPU cores, device memory, touch points, WebGL renderer, fonts, light canvas noise, strip Referer, send Do Not Track.
   - Most of the above can be set to **randomize each time you apply a proxy**.
   - Also: clear all cookies, or clear the browser cache without deleting cookies.

6. **System**
   - Language and theme for the extension UI.
   - IP + geo channel used when testing (`ipinfo.io`, `ipwhois.app`, `ip-api.com`, `api.myip.com`, or a custom URL). These checks do not consume JoyProxy traffic.

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

**JoyProxy 浏览器扩展** 用来在 Chrome 里测代理、切代理。自己的 `host:port`、第三方提取 API、JoyProxy 已买的线路，都可以先测通，再应用到**当前这个浏览器**（不会改电脑的系统代理）。

不登录也能测、也能把你自己的代理设到浏览器里。只有要用官网上买的线路时，才需要登录。用自己的代理，不会扣 JoyProxy 的流量。

- **官方网站：** https://www.joyproxy.com
- **开源仓库：** https://github.com/joyproxy/joyproxy-extension
- **相关工具：** [测通工具](https://github.com/joyproxy/joyproxy-tester) · [Android 客户端](https://github.com/joyproxy/joyproxy-client-android) · [代理服务端](https://github.com/joyproxy/joyproxy-server)

---

### 核心功能

1. **自己的代理**：
   - 支持 `host:port`、`user:pass@host:port`，以及 `http://` / `socks5://` 链接。
   - 先测出口 IP、国家和地区、延迟。测失败**不会**改浏览器正在用的代理。
   - 测通后再点「设为代理」；可以一键恢复直连，或回到设代理之前的设置。
   - 常用地址可以保存下来，也支持一次粘贴多条导入。

2. **提取 API**：
   - 填供应商的提取地址，可用正则把返回内容里的节点抠出来，再一条条测。
   - 两种模式：**只测不切**，或 **测通后自动设为浏览器代理**。
   - 可以按间隔自动换一条。停掉之后，会把浏览器代理恢复回去。

3. **JoyProxy 账号**：
   - 打开「JoyProxy」这一栏时，会先看这个浏览器有没有已经登录 [www.joyproxy.com](https://www.joyproxy.com)。登录过就直接带出已买的产品，不用再点一次登录。
   - 动态、静态（含自定义端口）都可以测通后再设为浏览器代理。
   - 「管理」打开用户后台。「退出」只退出插件，网站那边还是登录着的。

4. **弹窗和工作台**：
   - 点工具栏图标是小弹窗：看当前状态、粘贴代理；登录后也可以快速选一条 JoyProxy 线路。
   - 弹窗里「打开工作台」是完整界面：自己的代理、API、JoyProxy 产品、日志，以及底部的 **高级**、**系统**。
   - 界面支持简体中文、繁体中文、英语；外观可浅色、深色，或跟随系统。

5. **高级**（工作台底部 → **高级**）：
   - **代理范围：** 默认除名单外全部走代理；也可以改成「只有名单里的域名 / IP / 网址走代理，其余直连」。不走代理的名单已预填 JoyProxy 官网和 API。
   - **常用：** 改 User-Agent（预设或自己填）、限制 WebRTC（减少真实 IP 泄露）、清理当前网站的 Cookie 或整站数据。
   - **更多选项：** 语言、时区、屏幕分辨率、设备像素比、CPU 核心数、内存、触控点数、WebGL 显卡信息、字体列表、Canvas 轻微噪声、去掉 Referer、发送 Do Not Track。
   - 上面多数项目都可以勾「每次设为代理时随机」，连上代理时换一套。
   - 还可以清理浏览器里全部 Cookie，或只清缓存、不动登录。

6. **系统**：
   - 扩展自己的界面语言和外观。
   - 测代理、看真实 IP 时用的查询接口（`ipinfo.io`、`ipwhois.app`、`ip-api.com`、`api.myip.com`，也可以自己填 URL），不走 JoyProxy 流量。

---

### 安装（加载未打包扩展）

支持 Chrome、Edge、Brave、Opera、Vivaldi 等 Chromium 内核浏览器（**Chrome 114 及以上**）。目前还没上 Chrome 应用商店，请用源码目录直接加载。

1. 克隆代码：
   ```bash
   git clone https://github.com/joyproxy/joyproxy-extension.git
   cd joyproxy-extension
   ```
2. 打开 `chrome://extensions`。
3. 打开右上角 **开发者模式**。
4. 点 **加载已解压的扩展程序**，选这个仓库的根目录（能看到 `manifest.json` 的那一层）。
5. 把 JoyProxy 固定到工具栏。点图标打开弹窗；完整功能从弹窗进工作台。

以后 `git pull` 更新了代码，到扩展管理页点一下 **重新加载**。

---

### 快速上手

**自己的代理**

1. 在弹窗或工作台的「代理地址」里粘贴地址。
2. 点 **测试**，看出口 IP 和国家对不对。
3. 没问题再点 **设为代理**。要还原就点 **恢复直连**。

**提取 API**

1. 打开工作台 → **API**。
2. 填提取地址，需要的话再填正则。
3. 选 **仅测试** 或 **测通后设为代理**，然后开始。

**JoyProxy 产品**

1. 先在 [https://www.joyproxy.com](https://www.joyproxy.com) 登录（邮箱、Google、GitHub 都可以）。
2. 打开工作台 → **JoyProxy**。这个浏览器已经登录过，产品会自动出来。
3. 选线路，**测试** 通过后再 **设为代理**。点 **管理** 会打开 [用户后台](https://www.joyproxy.com/admin-overview.html)。

买流量、买独享线路，请到 [官网](https://www.joyproxy.com)。

---

### 权限和隐私

插件只改**当前浏览器**的代理，**不会**去改 Windows / macOS 的系统代理。如果需要改系统代理，请用桌面版 [JoyProxy Tester](https://github.com/joyproxy/joyproxy-tester)。

| 权限 | 用来做什么 |
|------|------------|
| `proxy` | 设置或恢复浏览器代理 |
| `storage` | 把保存的代理、设置、登录信息存在本机 |
| `sidePanel` | 打开工作台 |
| `contextMenus` | 网页上右键「用当前代理测试此站」 |
| `webRequest` / `webRequestAuthProvider` | HTTP 代理需要用户名密码时自动带上 |
| `tabs` / `scripting` | 打开登录页、后台；读取官网是否已登录 |
| `privacy` | 可选：限制 WebRTC |
| `webNavigation` / `declarativeNetRequest` | 可选：改请求头、User-Agent |
| `browsingData` | 工作台里清理 Cookie、缓存 |
| 访问所有网站 `<all_urls>` | 浏览才能走代理；隐私相关功能也需要 |

登录信息和代理账密只存在这台电脑的扩展存储里，不会做用户统计。测通时会访问你选的 IP 查询接口（默认 `ipinfo.io`）。登录只访问 `www.joyproxy.com` 和 `api.joyproxy.com`。

---

### 目前做不到的

- 只支持 Chromium 内核，**不支持 Firefox**。
- Chrome 没法给 SOCKS5 带用户名密码。有账密请用 HTTP，或者让对方把你的出口 IP 加白名单。
- 买套餐、提工单、调 OpenAPI / MCP、做网页采集，都在 [www.joyproxy.com](https://www.joyproxy.com)，插件里不做这些。
- 测试失败时，不会把正在用的浏览器代理换掉。

---

### 相关开源项目

| 项目 | 说明 |
|------|------|
| [joyproxy-tester](https://github.com/joyproxy/joyproxy-tester) | 桌面测通工具，支持 HTTP、SOCKS5 TCP / UDP，还可以同步 Windows 系统代理 |
| [joyproxy-client-android](https://github.com/joyproxy/joyproxy-client-android) | Android 上的 HTTP / SOCKS5 客户端 |
| [joyproxy-server](https://github.com/joyproxy/joyproxy-server) | Linux / Windows 上的高性能 HTTP / SOCKS5 网关 |

---

### 许可证

MIT License © 2026 JoyProxy

---

<a id="繁體中文"></a>

## 繁體中文

**JoyProxy 瀏覽器擴充功能** 用來在 Chrome 裡測代理、切代理。自己的 `host:port`、第三方提取 API、JoyProxy 已買的線路，都可以先測通，再套用到**目前這個瀏覽器**（不會改電腦的系統代理）。

沒登入也能測、也能把自己的代理設到瀏覽器裡。只有要用官網上買的線路時，才需要登入。用自己的代理，不會扣 JoyProxy 的流量。

- **官方網站：** https://www.joyproxy.com
- **開源倉庫：** https://github.com/joyproxy/joyproxy-extension
- **相關工具：** [測通工具](https://github.com/joyproxy/joyproxy-tester) · [Android 用戶端](https://github.com/joyproxy/joyproxy-client-android) · [代理伺服器](https://github.com/joyproxy/joyproxy-server)

---

### 核心功能

1. **自己的代理**：
   - 支援 `host:port`、`user:pass@host:port`，以及 `http://` / `socks5://` 連結。
   - 先測出口 IP、國家和地區、延遲。測失敗**不會**改瀏覽器正在用的代理。
   - 測通後再點「設為代理」；可以一鍵恢復直連，或回到設代理之前的設定。
   - 常用地址可以存下來，也支援一次貼上多筆匯入。

2. **提取 API**：
   - 填供應商的提取網址，可用正規表示式把回傳內容裡的節點抓出來，再一條條測。
   - 兩種模式：**只測不切**，或 **測通後自動設為瀏覽器代理**。
   - 可以依間隔自動換一條。停掉之後，會把瀏覽器代理恢復回去。

3. **JoyProxy 帳號**：
   - 打開「JoyProxy」這一欄時，會先看這個瀏覽器有沒有已經登入 [www.joyproxy.com](https://www.joyproxy.com)。登入過就直接帶出已買的產品，不用再點一次登入。
   - 動態、靜態（含自訂連接埠）都可以測通後再設為瀏覽器代理。
   - 「管理」打開用戶後台。「登出」只登出擴充功能，網站那邊還是登入著的。

4. **彈窗和工作台**：
   - 點工具列圖示是小彈窗：看目前狀態、貼上代理；登入後也可以快速選一條 JoyProxy 線路。
   - 彈窗裡「打開工作台」是完整介面：自己的代理、API、JoyProxy 產品、日誌，以及底部的 **進階**、**系統**。
   - 介面支援簡體中文、繁體中文、英語；外觀可淺色、深色，或跟隨系統。

5. **進階**（工作台底部 → **進階**）：
   - **代理範圍：** 預設除名單外全部走代理；也可以改成「只有名單裡的網域 / IP / 網址走代理，其餘直連」。不走代理的名單已預填 JoyProxy 官網和 API。
   - **常用：** 改 User-Agent（預設或自己填）、限制 WebRTC（減少真實 IP 外洩）、清理目前網站的 Cookie 或整站資料。
   - **更多選項：** 語言、時區、螢幕解析度、裝置像素比、CPU 核心數、記憶體、觸控點數、WebGL 顯示卡資訊、字體列表、Canvas 輕微雜訊、去掉 Referer、傳送 Do Not Track。
   - 上面多數項目都可以勾「每次設為代理時隨機」，連上代理時換一套。
   - 還可以清理瀏覽器裡全部 Cookie，或只清快取、不動登入。

6. **系統**：
   - 擴充功能自己的介面語言和外觀。
   - 測代理、看真實 IP 時用的查詢介面（`ipinfo.io`、`ipwhois.app`、`ip-api.com`、`api.myip.com`，也可以自己填 URL），不走 JoyProxy 流量。

---

### 安裝（載入未封裝擴充功能）

支援 Chrome、Edge、Brave、Opera、Vivaldi 等 Chromium 核心瀏覽器（**Chrome 114 以上**）。目前還沒上架 Chrome 線上應用程式商店，請用原始碼目錄直接載入。

1. 複製程式碼：
   ```bash
   git clone https://github.com/joyproxy/joyproxy-extension.git
   cd joyproxy-extension
   ```
2. 打開 `chrome://extensions`。
3. 打開右上角 **開發人員模式**。
4. 點 **載入未封裝項目**，選這個倉庫的根目錄（看得到 `manifest.json` 的那一層）。
5. 把 JoyProxy 固定到工具列。點圖示打開彈窗；完整功能從彈窗進工作台。

之後 `git pull` 更新了程式碼，到擴充功能管理頁點一下 **重新載入**。

---

### 快速上手

**自己的代理**

1. 在彈窗或工作台的「代理地址」裡貼上地址。
2. 點 **測試**，看出口 IP 和國家對不對。
3. 沒問題再點 **設為代理**。要還原就點 **恢復直連**。

**提取 API**

1. 打開工作台 → **API**。
2. 填提取網址，需要的話再填正規表示式。
3. 選 **僅測試** 或 **測通後設為代理**，然後開始。

**JoyProxy 產品**

1. 先在 [https://www.joyproxy.com](https://www.joyproxy.com) 登入（信箱、Google、GitHub 都可以）。
2. 打開工作台 → **JoyProxy**。這個瀏覽器已經登入過，產品會自動出來。
3. 選線路，**測試** 通過後再 **設為代理**。點 **管理** 會打開 [用戶後台](https://www.joyproxy.com/admin-overview.html)。

買流量、買獨享線路，請到 [官網](https://www.joyproxy.com)。

---

### 權限和隱私

擴充功能只改**目前瀏覽器**的代理，**不會**去改 Windows / macOS 的系統代理。如果需要改系統代理，請用桌面版 [JoyProxy Tester](https://github.com/joyproxy/joyproxy-tester)。

| 權限 | 用來做什麼 |
|------|------------|
| `proxy` | 設定或恢復瀏覽器代理 |
| `storage` | 把儲存的代理、設定、登入資訊存在本機 |
| `sidePanel` | 打開工作台 |
| `contextMenus` | 網頁上按右鍵「用目前代理測試此站」 |
| `webRequest` / `webRequestAuthProvider` | HTTP 代理需要帳號密碼時自動帶上 |
| `tabs` / `scripting` | 打開登入頁、後台；讀取官網是否已登入 |
| `privacy` | 可選：限制 WebRTC |
| `webNavigation` / `declarativeNetRequest` | 可選：改請求標頭、User-Agent |
| `browsingData` | 工作台裡清理 Cookie、快取 |
| 存取所有網站 `<all_urls>` | 瀏覽才能走代理；隱私相關功能也需要 |

登入資訊和代理帳密只存在這台電腦的擴充功能儲存空間，不會做使用者統計。測通時會存取你選的 IP 查詢介面（預設 `ipinfo.io`）。登入只會連到 `www.joyproxy.com` 和 `api.joyproxy.com`。

---

### 目前做不到的

- 只支援 Chromium 核心，**不支援 Firefox**。
- Chrome 沒辦法幫 SOCKS5 帶帳號密碼。有帳密請用 HTTP，或請對方把你的出口 IP 加入白名單。
- 買方案、開工單、呼叫 OpenAPI / MCP、做網頁擷取，都在 [www.joyproxy.com](https://www.joyproxy.com)，擴充功能裡不做這些。
- 測試失敗時，不會把正在用的瀏覽器代理換掉。

---

### 相關開源專案

| 專案 | 說明 |
|------|------|
| [joyproxy-tester](https://github.com/joyproxy/joyproxy-tester) | 桌面測通工具，支援 HTTP、SOCKS5 TCP / UDP，還可以同步 Windows 系統代理 |
| [joyproxy-client-android](https://github.com/joyproxy/joyproxy-client-android) | Android 上的 HTTP / SOCKS5 用戶端 |
| [joyproxy-server](https://github.com/joyproxy/joyproxy-server) | Linux / Windows 上的高效能 HTTP / SOCKS5 閘道 |

---

### 授權

MIT License © 2026 JoyProxy
