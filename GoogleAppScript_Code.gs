/**
 * 陌生開發拜訪紀錄 - Google App Script
 * Spreadsheet ID 與 Folder ID 已設定
 */

const SPREADSHEET_ID = '1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0';
const FOLDER_ID = '1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9';
const ALLOWED_ORIGIN = 'https://coldvisit-checkin.zeabur.app'; // 允許的來源

/**
 * 處理 OPTIONS 預檢請求 (CORS)
 * App Script Web App 對 OPTIONS 的處理比較特殊，
 * 通常只需回傳一個成功的空回應即可，瀏覽器會接著發送實際請求。
 * 不需要也不能直接在 TextOutput 上設定 CORS 標頭。
 */
function doOptions(e) {
  // 只需回傳一個空的成功 TextOutput
  return ContentService.createTextOutput();
}

/**
 * 主入口，處理 POST 請求
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const token = getBearerToken(e);
    const userEmail = verifyGoogleToken(token);

    if (!userEmail) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 加上公司網域驗證
    const userDomain = userEmail.split('@')[1];
    if (userDomain !== 'ichef.com.tw') {
      return jsonResponse({ error: 'Unauthorized domain' }, 401);
    }

    if (params.action === 'checkin') {
      return handleCheckIn(params, userEmail);
    } else if (params.action === 'checkout') {
      return handleCheckOut(params, userEmail);
    } else if (params.action === 'getNearbyPlaces') {
      response = handleGetNearbyPlaces(params); // Pass params containing lat/lng
    } else {
      response = jsonResponse({ error: 'Invalid action' }, 400);
    }

    // 無論如何，嘗試在最終回應加上 CORS 標頭
    if (response && typeof response.setHeader === 'function') { // 確保 response 是可以設定標頭的物件 (雖然 TextOutput 不行，但以防萬一)
       response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    } else if (response instanceof ContentService.TextOutput) {
       // TextOutput 不能直接 setHeader，但 doPost 回傳它通常就隱含了權限 (如果 doOptions 成功的話)
       // 這段修改主要是確保 handle... 函數的回傳被正確處理
    }
     return response;

  } catch (err) {
    Logger.log(err); // 記錄錯誤方便除錯
    const errorResponse = jsonResponse({ error: 'Internal Server Error: ' + err.message }, 500);
    // 在錯誤回應中也嘗試加上標頭
    // errorResponse.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN); // TextOutput 不能 setHeader
    return errorResponse;
  }
}

/**
 * 取得 Bearer Token
 */
function getBearerToken(e) {
  const authHeader = e.headers['Authorization'] || e.headers['authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * 驗證 Google OAuth Token，回傳 email
 */
function verifyGoogleToken(token) {
  if (!token) return null;
  try {
    const url = 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + token;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); // 避免 Token 失效時拋錯
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      // 確保 Token 有效且 email 已驗證
      if (data.aud && data.email && data.email_verified === 'true') {
        return data.email;
      }
    } else {
      Logger.log('Token verification failed: ' + responseCode + ' - ' + responseText);
    }
  } catch (err) {
    Logger.log('Error verifying token: ' + err);
  }
  return null;
}

/**
 * Check-in 處理
 */
function handleCheckIn(params, userEmail) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('拜訪紀錄'); // 請確保工作表名稱正確
    if (!sheet) throw new Error('Sheet "拜訪紀錄" not found.');

    const visitId = Utilities.getUuid();
    const now = new Date();

    // 欄位順序需與 Google Sheet 欄位完全一致
    sheet.appendRow([
      visitId,            // Visit ID
      userEmail,          // 業務 Email
      params.placeName || '', // GBP 店名
      params.placePhone || '', // GBP 電話
      params.placeAddress || '', // GBP 地址
      now,                // 進店時間戳記 (直接存 Date 物件，Sheets 會自動格式化)
      '',                 // 出店時間戳記
      '',                 // 本次接觸總時間
      '',                 // 接觸人
      '',                 // 接觸人聯絡方式
      '',                 // 是否安排再訪
      '',                 // 照片連結
      ''                  // 備註
    ]);

    return jsonResponse({ success: true, visitId: visitId, checkInTime: now.toISOString() });
  } catch (err) {
    Logger.log('Check-in error: ' + err);
    return jsonResponse({ error: 'Check-in failed: ' + err.message }, 500);
  }
}

/**
 * Check-out 處理
 */
function handleCheckOut(params, userEmail) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('拜訪紀錄');
    if (!sheet) throw new Error('Sheet "拜訪紀錄" not found.');

    const data = sheet.getDataRange().getValues();
    const now = new Date();
    let found = false;
    let rowIndex = -1;

    // 從第二列開始找 Visit ID (假設第一列是標頭)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === params.visitId) { // Visit ID 在第 1 欄 (index 0)
        found = true;
        rowIndex = i + 1; // Sheet 的列數是從 1 開始
        break;
      }
    }

    if (!found) {
      return jsonResponse({ error: 'Visit ID not found' }, 404);
    }

    // 計算總時間
    const checkInTime = new Date(data[rowIndex - 1][5]); // 進店時間在第 6 欄 (index 5)
    const durationMs = now - checkInTime;
    const durationMin = Math.round(durationMs / 60000);

    // 上傳照片
    let photoUrl = '';
    if (params.photoBase64 && params.photoMimeType && params.photoFilename) {
      try {
        const base64Data = params.photoBase64.includes(',') ? params.photoBase64.split(',')[1] : params.photoBase64;
        const decodedBytes = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(decodedBytes, params.photoMimeType, params.photoFilename);
        const folder = DriveApp.getFolderById(FOLDER_ID);
        if (!folder) throw new Error('Drive Folder not found.');
        const file = folder.createFile(blob);
        // 設定分享權限為「知道連結的機構使用者皆可檢視」
        file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
        photoUrl = file.getUrl();
      } catch (driveErr) {
        Logger.log('Drive upload error: ' + driveErr);
        // 照片上傳失敗不阻斷流程，但記錄錯誤
        photoUrl = 'Upload Error: ' + driveErr.message;
      }
    }

    // 更新該列資料 (注意欄位索引)
    sheet.getRange(rowIndex, 7).setValue(now); // 出店時間 (第 7 欄)
    sheet.getRange(rowIndex, 8).setValue(durationMin); // 總時間 (第 8 欄) - 存數字方便計算
    sheet.getRange(rowIndex, 9).setValue(params.contactPerson || ''); // 接觸人 (第 9 欄)
    sheet.getRange(rowIndex, 10).setValue(params.contactInfo || ''); // 聯絡方式 (第 10 欄)
    sheet.getRange(rowIndex, 11).setValue(params.revisitNeeded ? '是' : '否'); // 是否再訪 (第 11 欄)
    sheet.getRange(rowIndex, 12).setValue(photoUrl); // 照片連結 (第 12 欄)
    sheet.getRange(rowIndex, 13).setValue(params.notes || ''); // 備註 (第 13 欄)

    // 可選：設定總時間欄位的格式為「分鐘」
    sheet.getRange(rowIndex, 8).setNumberFormat('0" 分鐘"');

    return jsonResponse({ success: true, checkOutTime: now.toISOString(), durationMinutes: durationMin });
  } catch (err) {
    Logger.log('Check-out error: ' + err);
    return jsonResponse({ error: 'Check-out failed: ' + err.message }, 500);
  }
}

/**
 * JSON 回應 Helper
 */
function jsonResponse(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  // .setResponseCode(code || 200); // setResponseCode 在某些情況下可能無效
}

/**
 * 處理取得附近地點請求
 */
function handleGetNearbyPlaces(params) {
  if (!params.lat || !params.lng) {
    return jsonResponse({ error: 'Missing latitude or longitude' }, 400);
  }

  // 重要：將你的 Maps API Key 存在 Script Properties 中更安全
  // const apiKey = PropertiesService.getScriptProperties().getProperty('MAPS_API_KEY');
  // 為了簡單起見，暫時直接使用，但建議修改
  const apiKey = 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784'; // 使用者提供的 Key
  if (!apiKey) {
     return jsonResponse({ error: 'Maps API Key not configured in Script Properties' }, 500);
  }

  const lat = params.lat;
  const lng = params.lng;
  const radius = 500;
  const type = 'restaurant';
  const language = 'zh-TW';

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&language=${language}&key=${apiKey}`;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode === 200) {
      // 直接回傳 Google API 的 JSON 結果
      return ContentService.createTextOutput(responseText).setMimeType(ContentService.MimeType.JSON);
    } else {
      Logger.log(`Places API Error (${responseCode}): ${responseText}`);
      return jsonResponse({ error: `Failed to fetch places. Status: ${responseCode}`, details: responseText }, 500);
    }
  } catch (err) {
    Logger.log('Error fetching places via UrlFetchApp: ' + err);
    return jsonResponse({ error: 'Internal error fetching places: ' + err.message }, 500);
  }
}
