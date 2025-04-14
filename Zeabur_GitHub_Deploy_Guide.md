# Zeabur + GitHub 部署陌生開發拜訪紀錄系統指南

---

## 一、前端部署到 Zeabur

### 1. 建立 GitHub Repository
- 新增一個 repo，例如 `coldvisit-checkin-tool`
- 將 `coldvisit_checkin_tool/pwa` 內的檔案 (`index.html`, `app.js`) 上傳
- 你也可以將整個 `coldvisit_checkin_tool` 資料夾上傳，方便管理所有文件

### 2. 在 Zeabur 新增專案
- 登入 Zeabur
- 點選「Create Project」
- 選擇「Static Site」
- 連接你的 GitHub 帳號
- 選擇剛剛的 repo (`coldvisit-checkin-tool`)
- 設定 Build Command 為空（因為是純靜態檔案）
- 設定 **Publish Directory** 為 `pwa` (指向包含 index.html 的子目錄)
- 點擊「Deploy」

### 3. 完成
- Zeabur 會自動部署並提供網址 (例如 `https://your-project-name.zeabur.app`)
- 之後每次 push 到 GitHub repo 的 `pwa` 目錄，Zeabur 會自動更新部署

---

## 二、後端 Google App Script

- **無法放在 Zeabur**
- 請在 Google App Script 平台部署為 Web App (已提供 `GoogleAppScript_Code.gs`)
- 取得 Web App URL
- 在 `pwa/app.js` 中，將 `SCRIPT_API_URL` 替換成此 URL (已完成)

---

## 三、Google OAuth 與 Maps API 金鑰

- 在 Google Cloud Console 建立 OAuth 憑證，取得 `CLIENT_ID`
- 在 Google Cloud Console 啟用 Maps API，取得 `GOOGLE_MAPS_API_KEY`
- 替換 `pwa/app.js` 中的 `CLIENT_ID` 與 `GOOGLE_MAPS_API_KEY` (已完成)
- **重要**: 在 Google Cloud Console 的 OAuth 憑證設定中，務必將 Zeabur 提供的網址加入「授權的 JavaScript 來源」和「授權的重新導向 URI」。
- **重要**: 在 Google Cloud Console 的 Maps API 金鑰設定中，務必將 Zeabur 提供的網址加入 HTTP Referrer 限制，以策安全。

---

## 四、總結

| 項目       | 位置                     | 備註                         |
|------------|--------------------------|------------------------------|
| 前端 PWA   | Zeabur 靜態網站          | 連接 GitHub 自動部署         |
| 後端 API   | Google App Script Web App| 取得 URL，填入前端 (已完成)  |
| OAuth 與地圖| Google Cloud Console     | 取得金鑰，填入前端 (已完成)  |

---

## 五、未來擴充

- 若要將後端遷移至 Node.js，可用 Zeabur 部署 API
- 目前版本建議繼續使用 Google App Script，快速且免費
