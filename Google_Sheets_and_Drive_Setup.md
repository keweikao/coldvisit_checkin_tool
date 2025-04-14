# Google Sheets 與 Google Drive 設定指南

## 一、建立 Google Sheets

1.  新增一個 Google Sheets，命名為「陌生開發拜訪紀錄」
2.  在第一個工作表（建議命名為「拜訪紀錄」）設置以下欄位標題：

    | 欄位名稱             | 說明                     |
    |----------------------|--------------------------|
    | Visit ID             | 拜訪唯一識別碼           |
    | 業務 Email           | 業務登入的公司 Gmail     |
    | GBP 店名             | Google Map 店家名稱      |
    | GBP 電話             | Google Map 店家電話      |
    | GBP 地址             | Google Map 店家地址      |
    | 進店時間戳記         | Check-in 時間            |
    | 出店時間戳記         | Check-out 時間           |
    | 本次接觸總時間       | 出店 - 進店的時間差 (分鐘)|
    | 接觸人               | 接觸人姓名               |
    | 接觸人聯絡方式       | 電話或 Email             |
    | 是否安排再訪         | 是 / 否                  |
    | 照片連結             | Google Drive 照片連結    |
    | 備註                 | 其他說明 (選填)          |

3.  **你的 Spreadsheet ID 是**: `1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0` (請確認此 ID 正確且你有權限存取)

---

## 二、建立 Google Drive 資料夾

1.  在 Google Drive 新增一個資料夾，命名為「陌生開發拜訪照片」
2.  右鍵資料夾，選擇「共用」→「共用」
3.  在「一般存取權」下，選擇「機構內部 (你的公司名稱)」或「知道連結的任何人」
4.  權限設定為「檢視者」
5.  **你的 Folder ID 是**: `1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9` (請確認此 ID 正確且你有權限存取)

---

## 三、後續步驟

- 在 Google App Script 中，確認 `SPREADSHEET_ID` 與 `FOLDER_ID` 已正確填入。
- 撰寫 App Script 來存取這份表單與資料夾 (已提供 `GoogleAppScript_Code.gs`)。
- 部署 App Script 為 Web App，提供 API。
