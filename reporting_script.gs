/**
 * 每週自動產生業務拜訪月報表
 */

// --- 設定 ---
const SPREADSHEET_ID = '1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0'; // 你的試算表 ID
const SOURCE_SHEET_NAME = '拜訪紀錄'; // 包含原始拜訪紀錄的工作表名稱
const REPORT_SHEET_NAME = '月報表'; // 要寫入報表的工作表名稱
const EMAIL_COLUMN_INDEX = 1; // 業務 Email 在 SOURCE_SHEET_NAME 中的欄位索引 (B欄 = 1)
const CHECKIN_TIME_COLUMN_INDEX = 5; // 進店時間 在 SOURCE_SHEET_NAME 中的欄位索引 (F欄 = 5)
const REVISIT_COLUMN_INDEX = 10; // 是否安排再訪 在 SOURCE_SHEET_NAME 中的欄位索引 (K欄 = 10)

/**
 * 主要函數，執行報表產生邏輯
 */
function generateMonthlyReport() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  let reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);

  if (!sourceSheet) {
    Logger.log(`錯誤：找不到來源工作表 "${SOURCE_SHEET_NAME}"`);
    return;
  }

  // 如果報表工作表不存在，則建立一個新的
  if (!reportSheet) {
    reportSheet = ss.insertSheet(REPORT_SHEET_NAME);
    Logger.log(`已建立新的工作表 "${REPORT_SHEET_NAME}"`);
  }

  // 清除舊報表內容 (保留標頭)
  reportSheet.getRange(2, 1, reportSheet.getMaxRows() - 1, reportSheet.getMaxColumns()).clearContent();
  Logger.log(`已清除舊報表內容`);

  // 取得來源資料
  const data = sourceSheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('來源工作表沒有足夠的資料');
    reportSheet.getRange("A2").setValue('本月尚無拜訪紀錄');
    return;
  }

  // 取得當前月份 (1-12) 和年份
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // 準備統計資料結構
  const stats = {}; // { 'email': { total: 0, revisit: 0 }, ... }

  // 遍歷資料 (跳過標頭列)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const checkinDate = new Date(row[CHECKIN_TIME_COLUMN_INDEX]);
    const email = row[EMAIL_COLUMN_INDEX];
    const revisit = row[REVISIT_COLUMN_INDEX];

    // 檢查日期是否為當月且 Email 有效
    if (checkinDate.getFullYear() === currentYear &&
        checkinDate.getMonth() === currentMonth &&
        email && typeof email === 'string' && email.includes('@'))
    {
      // 初始化該 Email 的統計
      if (!stats[email]) {
        stats[email] = { total: 0, revisit: 0 };
      }

      // 累加總次數
      stats[email].total++;

      // 累加再訪次數 (假設儲存的是 '是')
      if (revisit === '是') {
        stats[email].revisit++;
      }
    }
  }

  // 準備寫入報表的資料
  const reportData = [];
  const header = ['業務 Email', `本月 (${currentMonth + 1}月) 總打卡數`, `本月 (${currentMonth + 1}月) 安排再訪數`];
  reportData.push(header);

  const sortedEmails = Object.keys(stats).sort(); // 按 Email 排序

  if (sortedEmails.length === 0) {
      Logger.log('本月尚無符合條件的拜訪紀錄');
      reportSheet.getRange("A2").setValue('本月尚無拜訪紀錄');
      return;
  }

  for (const email of sortedEmails) {
    reportData.push([
      email,
      stats[email].total,
      stats[email].revisit
    ]);
  }

  // 將結果寫入報表工作表
  reportSheet.getRange(1, 1, reportData.length, reportData[0].length).setValues(reportData);
  reportSheet.autoResizeColumns(1, reportData[0].length); // 自動調整欄寬
  Logger.log(`報表產生完成，共 ${reportData.length - 1} 筆業務紀錄`);
}

/**
 * (可選) 建立時間觸發器，讓 generateMonthlyReport 每週一自動執行
 * 你需要手動執行一次此函數來建立觸發器
 */
function createWeeklyTrigger() {
  // 先刪除可能存在的舊觸發器，避免重複建立
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'generateMonthlyReport') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('已刪除舊的 generateMonthlyReport 觸發器');
    }
  }

  // 建立新的每週一觸發器 (例如：凌晨 2-3 點執行)
  ScriptApp.newTrigger('generateMonthlyReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(2) // 設置執行的小時 (0-23)
      .nearMinute(30) // 設置執行的分鐘數 (0, 15, 30, 45) - App Script 會在附近時間執行
      .create();
  Logger.log('已建立新的每週一 generateMonthlyReport 觸發器');
}
