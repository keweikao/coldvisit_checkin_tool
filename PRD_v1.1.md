# 陌生開發拜訪紀錄系統 - PRD v1.1

## 1. 目標
提升業務陌生開發餐廳的效率，透過兩階段紀錄（進店、出店）精確追蹤拜訪時間與過程，標準化拜訪流程，數位化紀錄，方便管理與追蹤。

## 2. 使用者角色
- **業務人員**：現場陌生開發，分階段紀錄拜訪資訊
- **管理者**：查詢、分析拜訪資料，追蹤業務績效與拜訪時長

## 3. 主要流程

### 階段一：進店紀錄 (Check-in)
1.  **登入**:
    *   使用公司 Gmail 帳號 (`@ichef.com.tw`) 透過 Google OAuth 登入 PWA。
    *   驗證帳號，非公司帳號無法使用。
2.  **定位與選擇店家**:
    *   PWA 自動取得業務手機 GPS 定位。
    *   透過 Google Places API 顯示附近 500 公尺內的公開 Google Map 餐廳商家 (包含名稱、地址、電話)。
    *   業務從列表中選擇實際要拜訪的店家。
3.  **送出進店紀錄**:
    *   系統自動記錄 **進店時間戳記**。
    *   將 **業務帳號**、**店家資訊 (GBP 店名、電話、地址)**、**進店時間戳記** 存入 Google Sheets，並產生一個 **唯一拜訪 ID (Visit ID)**。
    *   前端保留此 Visit ID 及店家資訊，進入下一階段。

### 階段二：出店紀錄 (Check-out)
1.  **接續拜訪**:
    *   前端顯示上一階段選擇的店家資訊。
2.  **拍照**:
    *   業務完成拜訪後，拍攝店面或名片照片。
    *   照片透過 App Script 上傳至 Google Drive 指定資料夾 (`Folder ID: 1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9`)，並產生分享連結。
3.  **填寫拜訪資料**:
    *   接觸人姓名
    *   聯絡方式（電話、Email）
    *   是否安排再訪（單選：是 / 否）
    *   (可選) 拜訪結果/備註
4.  **送出出店紀錄**:
    *   系統自動記錄 **出店時間戳記**。
    *   使用第一階段的 Visit ID，更新 Google Sheets (`Spreadsheet ID: 1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0`) 中對應的紀錄：
        *   填入 **出店時間戳記**。
        *   填入 **照片連結**。
        *   填入 **接觸人**、**聯絡方式**、**是否再訪** 等資訊。
        *   自動計算 **本次接觸總時間** (出店時間 - 進店時間)。

## 4. 資料需求 (Google Sheets 欄位)
- Visit ID (唯一拜訪 ID)
- 業務 Email
- GBP 店名
- GBP 電話
- GBP 地址
- 進店時間戳記 (Check-in Time)
- 出店時間戳記 (Check-out Time)
- 本次接觸總時間 (Duration)
- 接觸人 (Contact Person)
- 接觸人聯絡方式 (Contact Info)
- 是否安排再訪 (Revisit Needed)
- 照片連結 (Photo Link)
- (可選) 備註 (Notes)

## 5. 非功能需求
- **跨平台支援**：行動網頁 (PWA)，支援 iOS/Android。
- **資料安全**：僅公司帳號 (`@ichef.com.tw`) 可登入，資料存放於公司 Google Workspace。
- **操作簡便**：兩階段流程清晰，拍照與填寫表單快速完成。
- **擴充性**：未來可串接 Salesforce 或其他 CRM/資料庫。
- **離線處理**：(可選) 考慮網路不穩時的暫存機制。

## 6. 技術方案摘要
- **前端**：PWA，整合 Google OAuth、Google Maps API、拍照功能、狀態管理 (處理兩階段流程)。
- **後端**：Google App Script，提供 API 端點處理 Check-in 和 Check-out 請求，操作 Google Sheets 與 Google Drive。
- **資料庫**：Google Sheets (`ID: 1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0`)。
- **報表**：Google Sheets + Google Data Studio。

## 7. 里程碑建議
1.  需求確認 (完成)
2.  UI/UX 設計 (針對兩階段流程)
3.  後端 App Script 開發 (Check-in/Check-out API)
4.  前端 PWA 開發 (整合 API 與流程)
5.  整合測試
6.  上線試營運
7.  優化與擴充
