# 技術設計方案 v1.1

## 一、前端 (PWA)

### 1. 技術棧
- HTML5, CSS3, JavaScript (ES6+)
- (可選) 前端框架如 Vue.js, React, or Svelte 簡化開發與狀態管理
- Google Maps JavaScript API
- Google OAuth 2.0 Client Library

### 2. 流程與狀態管理
- **Check-in 頁面**:
    - 執行 Google OAuth 登入 (限制公司網域 `@ichef.com.tw`)。
    - 取得 `access_token`。
    - 使用 `navigator.geolocation` 取得 GPS。
    - 呼叫 Google Places API Nearby Search 取得附近餐廳列表 (包含 Place ID)。
    - 使用者選擇店家。
    - **呼叫後端 Check-in API**: 傳送 `access_token`, `店家資訊 (Place ID, 名稱, 地址, 電話)`。
    - **儲存狀態**: 接收後端回傳的 `Visit ID` 及 `店家資訊`，儲存於 Local Storage 或 Session Storage，並導向 Check-out 頁面。
- **Check-out 頁面**:
    - 從儲存狀態讀取 `Visit ID` 及 `店家資訊` 並顯示。
    - 提供拍照 `<input type="file" accept="image/*" capture="environment">`。
    - 提供表單填寫 (接觸人、聯絡方式、是否再訪)。
    - **處理照片**: 使用 `FileReader` 預覽，準備上傳 (建議轉為 Base64 字串傳送給 App Script)。
    - **呼叫後端 Check-out API**: 傳送 `access_token`, `Visit ID`, `照片檔案 (Base64)`, `表單資料`。
    - 清除儲存狀態，顯示完成訊息。

### 3. API 呼叫
- 使用 `fetch` 或 `axios` 呼叫後端 Google App Script API。
- 在 Header 中帶上 `Authorization: Bearer <access_token>`。

### 4. UI/UX
- 介面簡潔，符合行動裝置操作習慣。
- 明確顯示目前在哪個階段 (Check-in / Check-out)。
- 提供錯誤處理與提示訊息 (如定位失敗、API 呼叫失敗)。

## 二、後端 (Google App Script)

### 1. 部署為 Web App
- 將 App Script 部署為 Web App，設定為 "Execute as: Me" 並 "Allow access to: Anyone" (程式碼內驗證 Token 與網域)。

### 2. `doPost(e)` 函數
- 作為主要的 API Endpoint。
- 解析 `e.postData.contents` (JSON payload)。
- 根據請求中的 `action` 參數 (e.g., `"checkin"`, `"checkout"`) 判斷執行哪個流程。
- **驗證 Token 與網域**:
    - 取得 `access_token`。
    - 驗證 Token 有效性及使用者 Email 是否屬於 `@ichef.com.tw` 網域。
    - 驗證失敗則回傳 401 Unauthorized。

### 3. Check-in 處理 (`handleCheckIn(payload, userEmail)`)
- **產生 Visit ID**: 使用 `Utilities.getUuid()`。
- **取得進店時間**: `new Date()`。
- **開啟 Google Sheet**: `SpreadsheetApp.openById('1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0')`。
- **取得工作表**: `getSheetByName("拜訪紀錄")`。
- **寫入新列**: (欄位順序需匹配)
    - Visit ID, userEmail, placeName, placePhone, placeAddress, 進店時間, ... (其他留空)
- **回傳**: `{ success: true, visitId: newVisitId, checkInTime: now.toISOString() }`

### 4. Check-out 處理 (`handleCheckOut(payload, userEmail)`)
- **取得出店時間**: `new Date()`。
- **處理照片**:
    - 將 Base64 照片解碼。
    - 建立 Blob。
    - 上傳至 Google Drive: `DriveApp.getFolderById('1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9').createFile(blob)`。
    - 設定分享權限 (`DOMAIN, VIEW`)，取得分享連結。
- **開啟 Google Sheet**。
- **尋找對應列**: 根據 `payload.visitId`。
- **更新資料**: 出店時間, 接觸人, 聯絡方式, 是否再訪, 照片連結, 備註。
- **計算總時間**: `(出店時間 - 進店時間)`。
- **更新總時間欄位**。
- **回傳**: `{ success: true }`

### 5. Google Sheet 設定
- Spreadsheet ID: `1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0`
- 工作表名稱: "拜訪紀錄"
- 欄位標頭: (對應 PRD v1.1)

### 6. Google Drive 設定
- Folder ID: `1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9`
- 資料夾權限: 公司內部可檢視

## 三、API 設計

### 1. Check-in API
- **Endpoint**: `[App Script Web App URL]`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <access_token>`
- **Body (JSON)**: (同 v1.1)
- **Response (Success)**: (同 v1.1)
- **Response (Error)**: `401 Unauthorized`, `500 Internal Server Error`

### 2. Check-out API
- **Endpoint**: `[App Script Web App URL]`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <access_token>`
- **Body (JSON)**: (同 v1.1)
- **Response (Success)**: (同 v1.1)
- **Response (Error)**: `401 Unauthorized`, `404 Not Found (Visit ID)`, `500 Internal Server Error`

## 四、安全性考量
- **OAuth Scope**: 最小必要權限。
- **Token 驗證**: 後端嚴格驗證 `access_token` 及 `@ichef.com.tw` 網域。
- **API Key 安全**: Google Maps/Places API Key 設定 HTTP Referrer 限制。
- **資料權限**: Google Drive 和 Sheets 權限設定為公司內部存取。

## 五、部署
- 前端 PWA 可部署於 Firebase Hosting, Netlify, Vercel 或 Zeabur。
- 後端 Google App Script 部署為 Web App。
