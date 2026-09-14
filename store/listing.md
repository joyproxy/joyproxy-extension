# Chrome / Edge 商店填写稿

隐私政策（填仪表盘，不要填网站那份）：https://www.joyproxy.com/privacy-extension.html  
官网：https://www.joyproxy.com  
支持邮箱：support@joyproxy.com  
商店 Support URL：https://www.joyproxy.com/service.html  
类别：Productivity（或 Tools）  
语言：简体中文、繁体中文、英语  

---

## 单一用途（Single purpose）

**English**  
This extension’s single purpose is to test proxy servers and apply a working proxy to the current browser.

**中文（给自己看，仪表盘用英文即可）**  
本扩展的唯一用途：在当前浏览器里测试代理，并把测通的代理设为浏览器代理。

登录 JoyProxy、提取 API、高级里的 User-Agent / WebRTC / 清理 Cookie，都是为了把代理设好、用好，不是第二个产品。

---

## 简短介绍（商店副标题，建议不超过 132 字）

**English**  
Test any proxy in this browser, then apply it. Use your own host:port, an extract API, or JoyProxy lines after you sign in.

**简体**  
在本浏览器中测通并设置代理。可用自己的地址、提取 API；要用官网上买的线路时再登录。

**繁體**  
在目前瀏覽器中測通並設定代理。可用自己的地址、提取 API；要用官網上買的線路時再登入。

`manifest.json` 的 `description` 已用简体这条。英文请贴到 Chrome Web Store 的英文商店资料里。

---

## 详细介绍（商店长描述）

### English

JoyProxy is a browser proxy workbench for Chrome, Edge, Brave, and other Chromium browsers.

You can paste your own `host:port` (or `user:pass@host:port`, or an `http://` / `socks5://` URL), test the exit IP and country, and only then set it as this browser’s proxy. A failed test does not change a working proxy. The extension does not change Windows or macOS system proxy settings.

You do not need a JoyProxy account to use your own proxies. Sign in only when you want to use lines you purchased at https://www.joyproxy.com. Using your own proxy does not consume JoyProxy traffic.

Also included:

- Third-party extract APIs: fetch a list, test each line, optionally apply the first working one
- JoyProxy products: rotating and static lines, test then apply; Manage opens your dashboard
- Advanced: proxy all sites or an allow-list, User-Agent, WebRTC, cookies, optional fingerprint-related settings
- Languages: Simplified Chinese, Traditional Chinese, English

Privacy policy: https://www.joyproxy.com/privacy-extension.html

### 简体中文

JoyProxy 用来在 Chrome / Edge / Brave 等 Chromium 浏览器里测代理、切代理。

把你自己的 `host:port`（也支持 `user:pass@host:port` 或 `http://` / `socks5://` 链接）贴进去，先看出口 IP 和国家，测通后再设为**当前这个浏览器**的代理。测失败不会改正在用的代理。插件不会改电脑的系统代理。

不登录也能用自己的代理。只有要用 https://www.joyproxy.com 上买的线路时，才需要登录。用自己的代理，不会扣 JoyProxy 流量。

还可以：

- 填第三方提取 API，自动测每一条，也可以测通后设为代理
- 登录后同步 JoyProxy 动态 / 静态线路；「管理」打开用户后台
- 高级：全部走代理或仅名单走代理、User-Agent、WebRTC、清理 Cookie，以及可选的浏览器标识设置
- 界面：简体中文、繁体中文、英语

隐私政策：https://www.joyproxy.com/privacy-extension.html

### 繁體中文

JoyProxy 用來在 Chrome / Edge / Brave 等 Chromium 瀏覽器裡測代理、切代理。

把自己的 `host:port`（也支援 `user:pass@host:port` 或 `http://` / `socks5://` 連結）貼進去，先看出 IP 和國家，測通後再設為**目前這個瀏覽器**的代理。測失敗不會改正在用的代理。擴充功能不會改電腦的系統代理。

沒登入也能用自己的代理。只有要用 https://www.joyproxy.com 上買的線路時，才需要登入。用自己的代理，不會扣 JoyProxy 流量。

還可以：

- 填第三方提取 API，自動測每一條，也可以測通後設為代理
- 登入後同步 JoyProxy 動態 / 靜態線路；「管理」打開用戶後台
- 進階：全部走代理或僅名單走代理、User-Agent、WebRTC、清理 Cookie，以及可選的瀏覽器標識設定
- 介面：簡體中文、繁體中文、英語

隱私權政策：https://www.joyproxy.com/privacy-extension.html

---

## 权限说明（审核被问时直接贴）

| 权限 | 英文（给审核） | 中文 |
|------|----------------|------|
| `proxy` | Apply or restore this browser’s proxy settings after a successful test. | 测通后设置或恢复**本浏览器**代理。 |
| `storage` | Save proxy profiles, UI settings, and optional sign-in tokens on this device. | 在本机保存代理档案、界面设置、可选的登录 token。 |
| `sidePanel` | Open the workbench side panel. | 打开工作台侧栏。 |
| `contextMenus` | Right-click “test this site with the current proxy”. | 网页右键：用当前代理测试此站。 |
| `webRequest` + `webRequestAuthProvider` | Supply HTTP proxy username/password when the proxy challenges the browser. | HTTP 代理要账密时自动带上。 |
| `offscreen` | Run connectivity checks in a hidden page so Chrome can complete HTTP proxy authentication. | 在隐藏页发起检测请求，否则带账密的 HTTP 代理测不通。 |
| `tabs` | Open the JoyProxy login or dashboard tab; find an already signed-in JoyProxy tab. | 打开登录页/后台；查找已打开的官网标签。 |
| `scripting` | Read JoyProxy site login state from joyproxy.com tabs; optionally inject User-Agent and related page settings the user enabled in Advanced. | 读取官网登录状态；用户在「高级」里开启后，才注入 UA 等页面设置。 |
| `privacy` | Optional WebRTC IP handling policy, only if the user turns it on. | 仅当用户打开「限制 WebRTC」时修改 WebRTC 策略。 |
| `webNavigation` | Know when a page starts loading so optional Advanced injection can apply. | 页面开始加载时应用用户已开启的高级设置。 |
| `declarativeNetRequest` + `declarativeNetRequestWithHostAccess` | Optional request-header overrides (User-Agent, Accept-Language, Referer, DNT) the user enabled. | 用户开启后，才改 UA / 语言 / Referer / DNT 请求头。 |
| `browsingData` | Clear cookies or cache when the user clicks those buttons in Advanced. | 用户在高级里点清理时，才清 Cookie 或缓存。 |
| Host `<all_urls>` | Required to route arbitrary websites through the chosen proxy, and to apply optional Advanced page settings on those sites. Not used to scrape pages for advertising. | 浏览任意网站才能走你设的代理；高级设置为可选。不会抓页面做广告。 |

Content script 只匹配 `https://www.joyproxy.com/*` 和 `https://joyproxy.com/*`，用来同步官网登录，不会在所有网站跑内容脚本。

---

## Chrome「隐私权做法」勾选建议

按插件真实行为勾，并和 https://www.joyproxy.com/privacy-extension.html 一致。

| 仪表盘选项 | 建议 | 理由 |
|------------|------|------|
| Personally identifiable information | **Yes**（登录后） | 可保存登录邮箱 |
| Authentication information | **Yes** | 登录 token 存在本机，登录时发给 JoyProxy |
| Personal communications | No | |
| Health | No | |
| Financial and payment | No | 付费在官网完成 |
| Location | No | 没有 GPS。测通时查的是**代理出口 IP** 的国家，走用户选的公开 Geo 接口 |
| Web history | **Yes** | 代理开启后，访问的目标主机会经过用户配置的代理（自有代理或 JoyProxy 网络） |
| User activity | **Yes** | 测通记录、代理开关等存在本机；走 JoyProxy 线路时用于计费的连接元数据见官网隐私政策 |
| Website content | No | 不为营销抓取页面正文 |

Remote code：选 **No**（没有远程执行的 JS）。  
Certify Limited Use：勾选，不卖数据、不用来做个性化广告。

第三方：测通可能请求 ipinfo.io / ipwhois.app / ip-api.com / api.myip.com（用户可改）。登录请求 www.joyproxy.com、api.joyproxy.com。

---

## 审核常见问法（可预填）

**Why do you need access to all websites?**  
To send the user’s browsing through the proxy they tested and applied, and to apply optional Advanced header/page settings they turned on. The extension does not scrape sites for advertising.

**Do you collect browsing history?**  
The extension stores test and connection logs locally. If the user applies a JoyProxy proxy, connection metadata needed to operate and meter the proxy is processed as described in the extension privacy policy. We do not sell browsing data.

**Remote code?**  
No. All extension scripts ship in the package.

---

## 不要放进 zip 的

`.git`、`docs/`、`store/`、`README.md`、`LICENSE`、`scripts/`、本文件。上架包只有 `manifest.json` + `src/`。
