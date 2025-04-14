# Zeabur + GitHub 部署陌生開發拜訪紀錄系統指南 (v2 - 使用 Node.js 代理)

---

## 一、專案結構建議

建議將前後端放在同一個 GitHub Repository，方便管理與部署。

```
your-repo-root/
├── coldvisit_checkin_tool/      <-- 前端 PWA 相關 (原資料夾)
│   ├── pwa/
│   │   ├── index.html
│   │   └── app.js               <-- API URL 指向 /api/proxy
│   ├── PRD_v1.1.md
│   ├── Tech_Design_v1.1.md
│   └── ... (其他文件)
├── coldvisit_proxy_backend/     <-- 新增的 Node.js 後端代理
│   ├── server.js
│   ├── package.json
│   └── .gitignore
└── .gitignore                   <-- (可選) Repo 根目錄的 gitignore
```
*你可以將 `coldvisit_checkin_tool` 重新命名為 `frontend` 或 `pwa`，將 `coldvisit_proxy_backend` 重新命名為 `backend` 或 `proxy`。*

---

## 二、後端代理部署 (Node.js on Zeabur)

### 1. 準備 GitHub Repo
- 確認 `coldvisit_proxy_backend` 資料夾 (包含 `server.js`, `package.json`, `.gitignore`) 已推送到你的 GitHub Repo。

### 2. 在 Zeabur 新增服務
- 登入 Zeabur
- 進入你的專案 (如果已有前端專案，可在同專案下新增服務)
- 點選「Add Service」或「Create Service」
- 選擇「Deploy from GitHub」
- 連接你的 GitHub 帳號
- 選擇包含後端程式碼的 repo
- **設定 Root Directory**: 指向包含 `package.json` 的後端資料夾 (例如 `coldvisit_proxy_backend`)
- Zeabur 應該會自動偵測到 `package.json` 並識別為 Node.js 專案。
- 確認 Build Command (通常是 `npm install` 或 `yarn install`) 和 Start Command (通常是 `npm start` 或 `node server.js`) 正確。
- 點擊「Deploy」

### 3. 取得後端 URL
- 部署成功後，Zeabur 會提供一個後端服務的 URL (例如 `https://your-backend-service.zeabur.app`)。
- **注意：** 如果你將前後端部署在同一個 Zeabur 專案的不同服務中，你或許可以直接在前端使用相對路徑 `/api/proxy`。但如果分開部署或遇到問題，使用後端服務的完整 URL 會更可靠。

---

## 三、前端部署 (PWA on Zeabur)

### 1. 更新前端 API URL
- **重要**：修改 `coldvisit_checkin_tool/pwa/app.js` 中的 `PROXY_API_URL` 常數。
    - 如果前後端在同一個 Zeabur 專案，可以嘗試設為相對路徑：`const PROXY_API_URL = '/api/proxy';` (需要 Zeabur 正確配置路由或使用 Nginx 服務代理)
    - **更可靠的方式**：設為後端代理服務的**完整 URL**：`const PROXY_API_URL = 'https://your-backend-service.zeabur.app/api/proxy';` (將 `https://your-backend-service.zeabur.app` 替換成你上一步取得的後端 URL)
- Commit 並 Push 這個修改到 GitHub。

### 2. 在 Zeabur 新增/更新服務
- 如果還沒部署前端：
    - 在 Zeabur 專案中點選「Add Service」→「Static Site」。
    - 連接 GitHub Repo。
    - 設定 **Root Directory**: 指向包含前端程式碼的資料夾 (例如 `coldvisit_checkin_tool`)。
    - 設定 **Publish Directory**: 指向 `pwa`。
    - 點擊「Deploy」。
- 如果已部署前端：
    - Zeabur 偵測到 GitHub 更新後應會自動重新部署。
    - 部署完成後，前端 PWA 的 URL (例如 `https://your-frontend-service.zeabur.app` 或 `https://coldvisit-checkin.zeabur.app`) 應該就能使用了。

---

## 四、後端 Google App Script

- 保持原本的獨立 App Script 部署 (URL: `https://script.google.com/macros/s/...`)。
- 這個 URL 現在只由你的 Node.js 後端代理呼叫。
- App Script 的部署設定 (執行身份、存取權限) 應維持先前測試成功的狀態 (例如：執行身份：我，存取權限：任何人)。

---

## 五、Google OAuth 與 Maps API 金鑰

- **OAuth Client ID**:
    - `CLIENT_ID` 仍在前端 `app.js` 中使用。
    - Google Cloud Console 的 OAuth 憑證設定中，「授權的 JavaScript 來源」和「授權的重新導向 URI」需包含**前端 PWA 的 Zeabur URL** (例如 `https://coldvisit-checkin.zeabur.app`)。
- **Maps API Key**:
    - `GOOGLE_MAPS_API_KEY` 仍在前端 `app.js` 中使用 (雖然 Places API 改由後端呼叫，但如果未來要在前端顯示地圖等仍需此金鑰)。
    - Google Cloud Console 的 Maps API 金鑰設定中，HTTP Referrer 限制需包含**前端 PWA 的 Zeabur URL** (例如 `https://coldvisit-checkin.zeabur.app/*`)。
    - **重要**: 在 App Script (`GoogleAppScript_Code.gs`) 中呼叫 Places API 時也用到了這個金鑰。建議將金鑰從 App Script 程式碼中移除，改存放在 **Script Properties** 中，增加安全性。
        - 在 App Script 編輯器左側點擊「專案設定」(齒輪圖示)。
        - 在「指令碼屬性」區段，點擊「編輯指令碼屬性」。
        - 新增一個屬性，名稱為 `MAPS_API_KEY`，值為你的金鑰。
        - 修改 `GoogleAppScript_Code.gs` 中的 `handleGetNearbyPlaces` 函數，用 `PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY');` 來讀取金鑰。

---

## 六、總結

| 項目           | 位置                         | 部署方式                     | 備註                                     |
|----------------|------------------------------|------------------------------|------------------------------------------|
| 前端 PWA       | Zeabur 靜態網站服務          | 連接 GitHub 自動部署         | API 指向 Node.js 代理                    |
| 後端 API 代理  | Zeabur Node.js 服務          | 連接 GitHub 自動部署         | 呼叫 App Script，處理前端請求            |
| 核心後端邏輯   | Google App Script Web App    | 手動部署 (管理部署/新增版本) | 只由 Node.js 代理呼叫                    |
| OAuth/Maps 金鑰| Google Cloud Console / 前端JS | 手動設定/填入                | 需設定 Zeabur URL 限制，建議 App Script 金鑰改存屬性 |
