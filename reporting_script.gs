/**
 * 每週自動產生業務地面推廣月報表並發送到 Slack
 */

// --- 設定 ---
const SPREADSHEET_ID = '1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0'; // 你的試算表 ID
const SOURCE_SHEET_NAME = '拜訪紀錄'; // 包含原始地面推廣紀錄的工作表名稱
const REPORT_SHEET_NAME = '月報表'; // 要寫入報表的工作表名稱
const EMAIL_COLUMN_INDEX = 1; // 業務 Email 在 SOURCE_SHEET_NAME 中的欄位索引 (B欄 = 1)
const CHECKIN_TIME_COLUMN_INDEX = 5; // 進店時間 在 SOURCE_SHEET_NAME 中的欄位索引 (F欄 = 5)
const REVISIT_COLUMN_INDEX = 10; // 是否安排再訪 在 SOURCE_SHEET_NAME 中的欄位索引 (K欄 = 10)

 // 指令碼屬性 (Script Properties) 的 Key 名稱，用於儲存 Webhook URL
 // const SLACK_WEBHOOK_URL_PROPERTY_KEY = 'SLACK_WEBHOOK_URL'; // Now hardcoded

 // !! 安全性警告：將 Webhook URL 直接寫入程式碼會使其暴露於任何能看到此程式碼的人 !!
 // !! 建議改用 Script Properties 儲存 !!
 const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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'; // User-provided Webhook URL

 /**
 * 主要函數，執行報表產生邏輯並發送 Slack 通知 (由觸發器呼叫)
 */
function generateMonthlyReportAndNotifySlack() {
  try {
    const reportSummary = generateMonthlyReport(); // 執行報表產生

    if (reportSummary) { // 如果報表成功產生且有內容
      sendToSlack(reportSummary); // 發送通知到 Slack
    } else {
      Logger.log('報表無內容或產生失敗，不發送 Slack 通知');
    }
  } catch (error) {
      Logger.log(`執行 generateMonthlyReportAndNotifySlack 時發生錯誤: ${error}`);
      // 可考慮在此處也發送錯誤通知到 Slack
      // sendToSlack(`產生報表時發生錯誤: ${error.message}`);
  }
}


/**
 * 產生月報表函數，回傳報表摘要訊息供 Slack 使用
 * @return {string | null} 報表摘要訊息或 null (如果無資料或失敗)
 */
function generateMonthlyReport() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  let reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);

  if (!sourceSheet) {
    Logger.log(`錯誤：找不到來源工作表 "${SOURCE_SHEET_NAME}"`);
    return null;
  }
  if (!reportSheet) {
    reportSheet = ss.insertSheet(REPORT_SHEET_NAME);
    Logger.log(`已建立新的工作表 "${REPORT_SHEET_NAME}"`);
    // Set header immediately for new sheet
    reportSheet.getRange("A1:C1").setValues([['業務 Email', '本月總打卡數', '本月安排再訪數']]);
  }

  reportSheet.getRange(2, 1, reportSheet.getMaxRows() - 1, reportSheet.getMaxColumns()).clearContent();
  Logger.log(`已清除舊報表內容`);

  const data = sourceSheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('來源工作表沒有足夠的資料');
    reportSheet.getRange("A2").setValue('本月尚無地面推廣紀錄');
    return `本月 (${new Date().getMonth() + 1}月) 尚無地面推廣紀錄。`; // Return summary message
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const stats = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    try { // Add try-catch for date parsing
        const checkinDate = new Date(row[CHECKIN_TIME_COLUMN_INDEX]);
        const email = row[EMAIL_COLUMN_INDEX];
        const revisit = row[REVISIT_COLUMN_INDEX];

        if (checkinDate instanceof Date && !isNaN(checkinDate) && // Check if date is valid
            checkinDate.getFullYear() === currentYear &&
            checkinDate.getMonth() === currentMonth &&
            email && typeof email === 'string' && email.includes('@'))
        {
          if (!stats[email]) {
            stats[email] = { total: 0, revisit: 0 };
          }
          stats[email].total++;
          if (revisit === '是') {
            stats[email].revisit++;
          }
        }
    } catch(dateError) {
        Logger.log(`Skipping row ${i+1} due to invalid date: ${row[CHECKIN_TIME_COLUMN_INDEX]}`);
    }
  }

  const reportData = [];
  const header = ['業務 Email', `本月 (${currentMonth + 1}月) 總打卡數`, `本月 (${currentMonth + 1}月) 安排再訪數`];
  reportData.push(header); // Ensure header is always added

  const sortedEmails = Object.keys(stats).sort();

  if (sortedEmails.length === 0) {
      Logger.log('本月尚無符合條件的地面推廣紀錄');
      reportSheet.getRange("A2").setValue('本月尚無地面推廣紀錄');
      return `本月 (${currentMonth + 1}月) 尚無符合條件的地面推廣紀錄。`; // Return summary message
  }

  let totalCheckins = 0;
  let totalRevisits = 0;
  for (const email of sortedEmails) {
    reportData.push([
      email,
      stats[email].total,
      stats[email].revisit
    ]);
    totalCheckins += stats[email].total;
    totalRevisits += stats[email].revisit;
  }

  reportSheet.getRange(1, 1, reportData.length, reportData[0].length).setValues(reportData);
  reportSheet.autoResizeColumns(1, reportData[0].length);
  Logger.log(`報表產生完成，共 ${reportData.length - 1} 筆業務紀錄`);

  // 產生摘要訊息
  const sheetUrl = ss.getUrl();
  const reportSummary = `*地面推廣 ${currentMonth + 1} 月報表已更新*\n` + // Updated terminology
                        `本月總打卡數：${totalCheckins}\n` +
                        `本月安排再訪數：${totalRevisits}\n` +
                        `詳細報表連結：${sheetUrl}`;
  return reportSummary;
}

/**
 * 發送訊息到 Slack Incoming Webhook
  * @param {string} message 要發送的訊息 (支援 Slack Markdown)
  */
 function sendToSlack(message) {
   // 使用硬編碼的 Webhook URL
   const webhookUrl = SLACK_WEBHOOK_URL;

   if (!webhookUrl || webhookUrl === 'YOUR_SLACK_WEBHOOK_URL_HERE') { // Added check for placeholder
     Logger.log('錯誤：尚未設定有效的 SLACK_WEBHOOK_URL 常數');
    return; // Or simply don't send if URL is missing
  }

  const payload = { text: message };
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log(`正在發送訊息到 Slack...`);
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (responseCode === 200 && responseText === 'ok') {
      Logger.log('訊息成功發送到 Slack');
    } else {
      Logger.log(`發送 Slack 失敗。回應碼: ${responseCode}, 回應內容: ${responseText}`);
    }
  } catch (error) {
    Logger.log(`發送 Slack 時發生錯誤: ${error}`);
  }
}


/**
 * (可選) 建立時間觸發器，讓 generateMonthlyReportAndNotifySlack 每週一自動執行
 * 你需要手動執行一次此函數來建立觸發器
 */
function createWeeklyTrigger() {
  // 先刪除可能存在的舊觸發器，避免重複建立
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'generateMonthlyReportAndNotifySlack') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('已刪除舊的 generateMonthlyReportAndNotifySlack 觸發器');
    }
     if (trigger.getHandlerFunction() === 'generateMonthlyReport') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('已刪除舊的 generateMonthlyReport 觸發器');
    }
  }

  // 建立新的每週一觸發器，執行包含通知的新函數
  ScriptApp.newTrigger('generateMonthlyReportAndNotifySlack')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(2) // 設置執行的小時 (0-23)
      .nearMinute(30) // 設置執行的分鐘數 (0, 15, 30, 45)
      .create();
  Logger.log('已建立新的每週一 generateMonthlyReportAndNotifySlack 觸發器');
}
