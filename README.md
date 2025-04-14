# 業務陌生開發拜訪紀錄工具 (Cold Visit Check-in Tool)

這是一個簡單的行動網頁應用程式 (PWA)，旨在幫助業務人員在陌生開發拜訪餐廳或其他地點時，快速記錄拜訪資訊，提升效率並方便後續追蹤。

**線上 Demo:** [https://coldvisit-checkin.zeabur.app](https://coldvisit-checkin.zeabur.app) (需要 `@ichef.com.tw` Google 帳號登入)

---

## 專案目標

解決業務同仁在陌生開發過程中，手動記錄拜訪地點、時間、接觸對象、拜訪結果等資訊效率低落、格式不一、不易彙整分析的問題。

---

## 主要功能

*   **Google 帳號登入**: 使用公司 Google 帳號 (@ichef.com.tw) 進行 OAuth 2.0 驗證登入。
*   **地圖定位與選擇**:
    *   自動取得使用者目前 GPS 位置。
    *   在地圖上顯示附近 50 公尺內的地點標記。
    *   使用者可直接點擊地圖上的標記選擇拜訪店家。
*   **兩階段紀錄**:
    *   **Check-in**: 選擇店家後，自動記錄進店時間、地點資訊 (名稱、地址、Place ID) 和執行業務 Email 到 Google Sheet，並產生唯一拜訪 ID。
    *   **Check-out**: 完成拜訪後，填寫表單：
        *   上傳現場照片 (自動存入指定 Google Drive 資料夾)。
        *   選擇接觸人員角色 (店員、店長/經理、老闆、其他)。
        *   選擇是否需再訪。
        *   若需再訪，則填寫聯絡人姓名與電話。
        *   填寫備註。
    *   送出後，更新對應的 Google Sheet 紀錄，填入 Check-out 時間、照片連結、表單資料，並自動計算**拜訪總時長**。
*   **資料儲存**: 所有拜訪紀錄儲存在指定的 Google Sheet，照片儲存在指定的 Google Drive 資料夾。
*   **簡易導航**: Check-out 表單提供「返回地圖」按鈕，方便開始下一次紀錄。

---

## 技術棧

*   **前端 (PWA)**:
    *   HTML5, CSS3, Vanilla JavaScript (ES6+)
    *   Google Maps JavaScript API (Map Display, Markers, InfoWindow, Places Service for Nearby Search)
    *   Google OAuth 2.0 (Implicit Flow via Redirect for Login)
    *   `navigator.geolocation` API
    *   `fetch` API
*   **後端 (API)**:
    *   Node.js
    *   Express.js (Web Framework)
    *   `googleapis` (Official Google API Client Library for Node.js)
    *   `google-auth-library` (For Service Account Authentication)
    *   `node-fetch` (For calling Google APIs like Places Details, TokenInfo)
    *   `cors` (Middleware for handling Cross-Origin Resource Sharing)
*   **資料庫**:
    *   Google Sheets (For storing structured visit data)
    *   Google Drive (For storing uploaded photos)
*   **驗證**:
    *   前端：Google OAuth 2.0 (Implicit Flow) 取得 Access Token。
    *   後端：驗證前端傳來的 Access Token (via Google TokenInfo endpoint)，並使用 Service Account Key (JSON) 存取 Google Sheets/Drive API。
*   **部署**:
    *   前端 (PWA): Zeabur (Static Site Service)
    *   後端 (Node.js): Zeabur (Node.js Service)

---

## 專案結構

```
your-repo-root/
├── frontend/                    <-- 前端 PWA (原 coldvisit_checkin_tool/pwa)
│   ├── index.html
│   └── app.js
├── backend/                     <-- Node.js 後端 (原 coldvisit_proxy_backend)
│   ├── server.js
│   ├── package.json
│   ├── service-account-key.json <-- !!! 不可 Commit !!!
│   └── .gitignore
├── docs/                        <-- (可選) 文件
│   ├── PRD_v1.1.md
│   ├── Tech_Design_v1.1.md
│   └── ...
└── README.md                    <-- 本檔案
```
*(請根據你的實際資料夾結構調整此處)*

---

## 設定與部署

詳細步驟請參考 `docs/Zeabur_GitHub_Deploy_Guide.md` (或你存放部署指南的位置)。

**關鍵設定摘要：**

1.  **Google Cloud Console**:
    *   建立專案。
    *   啟用 `Google Sheets API`, `Google Drive API`, `Places API`, `Maps JavaScript API`。
    *   設定**帳單帳戶**。
    *   建立**網頁應用程式 OAuth 2.0 用戶端 ID**，並設定 JavaScript 來源和重新導向 URI 為你的前端 Zeabur URL (例如 `https://coldvisit-checkin.zeabur.app`)。記下 **Client ID**。
    *   建立 **API 金鑰**，並設定 HTTP 參照網址限制為你的前端 Zeabur URL (例如 `https://coldvisit-checkin.zeabur.app/*`)。記下 **API Key**。
    *   建立**服務帳戶 (Service Account)**，下載其 **JSON 金鑰檔案** (`service-account-key.json`)，並記下其 **Email 地址**。
2.  **Google Drive**:
    *   建立一個資料夾存放照片。
    *   將**服務帳戶 Email** 加入共用設定，權限設為**編輯者**。
    *   記下**資料夾 ID**。
3.  **Google Sheets**:
    *   建立一個 Google Sheet 存放紀錄。
    *   設定好標頭列 (A 到 O 欄，包含 `Visit ID`...`Place ID`)。
    *   將**服務帳戶 Email** 加入共用設定，權限設為**編輯者**。
    *   記下**試算表 ID**。
4.  **程式碼設定**:
    *   前端 `frontend/app.js`: 填入 `CLIENT_ID`。
    *   後端 `backend/server.js`: 填入 `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, `EXPECTED_OAUTH_CLIENT_ID`。將 `GOOGLE_MAPS_API_KEY` 移至環境變數。
5.  **Zeabur 部署**:
    *   建立 GitHub Repo，將 `frontend` 和 `backend` 資料夾 (以及 `docs` 如果需要) 推送上去。**確保 `.gitignore` 排除 `service-account-key.json` 和 `node_modules/`**。
    *   在 Zeabur 建立兩個服務：
        *   **前端服務 (Static Site)**: Root Directory 指向 `frontend`，Publish Directory 指向 `pwa` (如果 `index.html` 在 `frontend/pwa` 下)。
        *   **後端服務 (Node.js)**: Root Directory 指向 `backend`。
    *   在 Zeabur 後端服務的**環境變數**中設定：
        *   `GOOGLE_CREDENTIALS_JSON`: 貼上 `service-account-key.json` 的**完整內容**。
        *   `GOOGLE_MAPS_API_KEY`: 貼上你的 Maps API Key。

---

## 開發過程與挑戰 (簡述)

*   **初期構想**: 使用 Google App Script 作為後端，利用其與 Google 服務的整合性。
*   **遭遇困難**: 在將前端部署到 Zeabur 後，呼叫 App Script Web App 時遇到了持續且難以解決的 CORS 預檢請求錯誤，即使嘗試了多種標準解法 (修改 `doOptions`, 更改部署設定, 使用獨立腳本) 仍無法穩定運作。
*   **架構轉換**: 決定放棄 App Script 作為 API 端點，改用 Node.js (Express) 建立一個獨立的後端服務，同樣部署在 Zeabur。
*   **後端實現**: Node.js 後端使用 `googleapis` 函式庫和服務帳戶金鑰，直接操作 Google Sheets 和 Google Drive API，並自行呼叫 Google Places API。
*   **前端調整**: 前端 PWA 的 API 呼叫目標從 App Script URL 改為指向新的 Node.js 後端 URL。
*   **部署問題**: 過程中也遇到 Zeabur 部署 Node.js 服務時 `ERR_MODULE_NOT_FOUND` 的問題，最終透過確認部署設定和重新部署解決。
*   **功能迭代**: 根據使用者回饋，將地點選擇方式從後端搜尋列表改為前端地圖標記點選，並調整了 Check-out 表單的欄位和流程。

---

歡迎提供任何建議或回饋！
