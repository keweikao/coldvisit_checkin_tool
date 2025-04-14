# Zeabur + GitHub 部署陌生開發拜訪紀錄系統指南 (v3 - Node.js 直連 Google API)

---

## 一、專案結構建議

建議將前後端放在同一個 GitHub Repository。

```
your-repo-root/
├── frontend/                    <-- 前端 PWA (原 coldvisit_checkin_tool/pwa)
│   ├── index.html
│   └── app.js                   <-- API URL 指向後端 /api/...
├── backend/                     <-- Node.js 後端 (原 coldvisit_proxy_backend)
│   ├── server.js                <-- 使用 googleapis 操作 Sheets/Drive
│   ├── package.json
│   ├── service-account-key.json <-- !!! 重要：此檔案不應 commit 到 GitHub !!!
│   └── .gitignore               <-- 應包含 service-account-key.json 和 node_modules
├── docs/                        <-- (可選) 文件 (原 PRD, Tech Design 等)
│   ├── PRD_v1.1.md
│   ├── Tech_Design_v1.1.md
│   └── ...
└── .gitignore                   <-- Repo 根目錄的 gitignore (應包含 /backend/service-account-key.json)
```
*請調整你的資料夾結構以符合此建議，或相應修改部署設定中的路徑。*

---

## 二、後端部署 (Node.js on Zeabur)

### 1. 準備 GitHub Repo
- 確認 `backend` 資料夾 (包含 `server.js`, `package.json`) 已推送到 GitHub。
- **非常重要**：確認 `.gitignore` 檔案 (在 `backend` 資料夾內或根目錄) 包含 `service-account-key.json` 和 `node_modules/`，確保金鑰和依賴項不會被上傳。

### 2. 設定服務帳戶金鑰 (Zeabur 環境變數)
- **取得金鑰內容**：打開你下載的 `service-account-key.json` 檔案，複製**所有的 JSON 內容**。
- **設定 Zeabur 環境變數**：
    - 登入 Zeabur。
    - 進入你的專案，選擇後端 Node.js 服務。
    - 前往「Variables」(變數) 或「Environment Variables」(環境變數) 設定。
    - 新增一個變數：
        - **名稱 (Key)**：`GOOGLE_CREDENTIALS_JSON`
        - **值 (Value)**：貼上你複製的**完整 JSON 內容**。
    - **(或者)** 如果你偏好使用檔案路徑：
        - 新增變數 `GOOGLE_APPLICATION_CREDENTIALS`，值設為 Zeabur 環境中金鑰檔案的預期路徑 (例如 `/app/service-account-key.json`)。
        - 你需要確保透過某種方式 (例如 Dockerfile 或 Zeabur 的 secret 功能) 將金鑰檔案安全地放置到部署環境的該路徑下。**使用環境變數貼上 JSON 內容通常更簡單直接。**
- **修改 `server.js` (如果需要)**：
    - 如果你選擇使用 `GOOGLE_CREDENTIALS_JSON` 環境變數，需要取消 `server.js` 中 `createGoogleAuthClient` 函數內對應程式碼的註解，並註解掉使用 `KEY_FILE_PATH` 的部分。

### 3. 在 Zeabur 新增/更新服務
- 登入 Zeabur。
- 進入你的專案。
- 如果尚未建立後端服務：
    - 點選「Add Service」→「Deploy from GitHub」。
    - 連接 GitHub Repo，選擇包含後端的儲存庫。
    - **設定 Root Directory**: 指向 `backend` 資料夾。
    - 確認 Build/Start Command。
    - 點擊「Deploy」。
- 如果已建立後端服務：
    - 推送程式碼到 GitHub 後，Zeabur 應會自動重新部署。

### 4. 取得後端 URL
- 部署成功後，記下後端服務的 URL (例如 `https://your-backend-service.zeabur.app`)。

---

## 三、前端部署 (PWA on Zeabur)

### 1. 更新前端 API URL
- **重要**：修改 `frontend/app.js` (或你命名的前端 JS 檔案) 中的 `PROXY_API_URL` 常數 (建議將此常數改名為 `API_BASE_URL` 或類似名稱)。
- 將其值設為後端服務的**根 URL** (例如 `https://your-backend-service.zeabur.app`)。
- **修改 `fetch` 呼叫**：將所有 `fetch(PROXY_API_URL, ...)` 修改為指向具體的後端端點，例如：
    - `fetch(\`${API_BASE_URL}/api/getNearbyPlaces\`, ...)`
    - `fetch(\`${API_BASE_URL}/api/checkin\`, ...)`
    - `fetch(\`${API_BASE_URL}/api/checkout\`, ...)`
- Commit 並 Push 這個修改到 GitHub。

### 2. 在 Zeabur 新增/更新服務
- 依照先前方式部署或更新 Zeabur 上的靜態網站服務。
- **設定 Root Directory**: 指向包含前端程式碼的資料夾 (例如 `frontend`)。
- **設定 Publish Directory**: 指向 `pwa` (如果你的 index.html 在 `frontend/pwa` 下)。

---

## 四、後端 Google App Script (不再需要)

- **這個新架構不再需要 Google App Script 作為代理或後端。**
- 你可以保留舊的 App Script 專案備查，或將其刪除。

---

## 五、Google OAuth 與 Maps API 金鑰

- **OAuth Client ID**:
    - `CLIENT_ID` 仍在前端 `app.js` 中使用。
    - Google Cloud Console 的 OAuth 憑證設定中，「授權的 JavaScript 來源」和「授權的重新導向 URI」需包含**前端 PWA 的 Zeabur URL**。
- **Maps API Key**:
    - `GOOGLE_MAPS_API_KEY` 現在主要由**後端 Node.js (`server.js`)** 在呼叫 Places API 時使用。
    - **強烈建議**：將此金鑰也設定為 Zeabur 後端服務的**環境變數** (例如 `GOOGLE_MAPS_API_KEY`)，並在 `server.js` 中讀取 `process.env.GOOGLE_MAPS_API_KEY`，而不是直接寫在程式碼裡。
    - 前端 `app.js` 中可以保留此金鑰，以備未來可能需要在前端直接使用地圖功能。
    - Google Cloud Console 的 Maps API 金鑰設定中，**不再需要**設定 HTTP Referrer 限制 (因為呼叫來自後端伺服器)，但可以考慮設定 **IP 位址限制**，只允許你的 Zeabur 後端服務的 IP 呼叫 (如果 Zeabur 提供固定 IP)。

---

## 六、總結 (新架構)

| 項目           | 位置                         | 部署方式                     | 備註                                     |
|----------------|------------------------------|------------------------------|------------------------------------------|
| 前端 PWA       | Zeabur 靜態網站服務          | 連接 GitHub 自動部署         | API 指向 Node.js 後端                    |
| 後端 API       | Zeabur Node.js 服務          | 連接 GitHub 自動部署         | 使用 Service Account 操作 Google API     |
| OAuth 金鑰     | Google Cloud Console / 前端JS | 手動設定/填入                | 需設定 Zeabur 前端 URL 限制              |
| Maps API 金鑰  | Google Cloud Console / 後端環境變數 | 手動設定/設定環境變數        | 建議後端透過環境變數讀取                 |
