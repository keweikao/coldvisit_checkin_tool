// --- 設定值 ---
const CLIENT_ID = '916934078689-iiqq9op8ee3q810ut8cclhbdg470puf0.apps.googleusercontent.com';
const SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycbzXaR8ec2R-VQPFxqxeorqXV_O733wQccp8KTZ4lZRDEoUrluPuVuU6pwX5gSKnAAHF/exec'; // 更新為獨立 App Script URL
const GOOGLE_MAPS_API_KEY = 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784';
const COMPANY_DOMAIN = 'ichef.com.tw';

// --- 全域變數 ---
let accessToken = localStorage.getItem('access_token');
let visitId = localStorage.getItem('visitId');
let placeName = localStorage.getItem('placeName');
let placeAddress = localStorage.getItem('placeAddress');
let photoBase64 = '';
let photoMimeType = '';
let photoFilename = '';

// --- DOM 元素 ---
const loginSection = document.getElementById('login-section');
const checkinSection = document.getElementById('checkin-section');
const checkoutSection = document.getElementById('checkout-section');
const doneSection = document.getElementById('done-section');
const loadingDiv = document.getElementById('loading');
const placesDiv = document.getElementById('places');
const selectedPlaceDiv = document.getElementById('selected-place');
const photoPreview = document.getElementById('photo-preview');
const durationInfo = document.getElementById('duration-info');

// --- 初始化 ---
window.onload = () => {
  if (accessToken) {
    // 已登入
    loginSection.classList.add('hidden');
    if (visitId && placeName) {
      // 正在進行中的拜訪
      showCheckoutSection();
    } else {
      // 顯示 Check-in 頁面
      showCheckInSection();
    }
  } else {
    // 顯示登入按鈕
    loginSection.classList.remove('hidden');
    checkinSection.classList.add('hidden');
    checkoutSection.classList.add('hidden');
    doneSection.classList.add('hidden');
  }
};

// --- 事件監聽 ---
document.getElementById('login-btn').onclick = handleLogin;
document.getElementById('locate-btn').onclick = handleLocate;
document.getElementById('photo-input').onchange = handlePhotoChange;
document.getElementById('submit-checkout').onclick = handleSubmitCheckout;

// --- 函數 ---

// 顯示不同區塊
function showLoginSection() {
  loginSection.classList.remove('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.add('hidden');
  doneSection.classList.add('hidden');
}
function showCheckInSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.remove('hidden');
  checkoutSection.classList.add('hidden');
  doneSection.classList.add('hidden');
  // 清除上次的列表和暫存
  placesDiv.innerHTML = '請先點擊上方按鈕取得附近餐廳';
  clearVisitData();
}
function showCheckoutSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.remove('hidden');
  doneSection.classList.add('hidden');
  // 顯示已選店家資訊
  selectedPlaceDiv.innerHTML = `
    <strong>${placeName}</strong><br/>
    <span>地址：${placeAddress || 'N/A'}</span>
  `;
  // 清空表單和照片預覽
  document.getElementById('photo-input').value = '';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  document.getElementById('contact-person').value = '';
  document.getElementById('contact-info').value = '';
  document.getElementById('revisit-needed').value = '否';
  document.getElementById('notes').value = '';
}
function showDoneSection(durationMinutes) {
  loginSection.classList.add('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.add('hidden');
  doneSection.classList.remove('hidden');
  durationInfo.innerText = `拜訪時間：約 ${durationMinutes} 分鐘`;
}

// 清除拜訪暫存資料
function clearVisitData() {
  visitId = null;
  placeName = null;
  placeAddress = null;
  photoBase64 = '';
  photoMimeType = '';
  photoFilename = '';
  localStorage.removeItem('visitId');
  localStorage.removeItem('placeName');
  localStorage.removeItem('placeAddress');
}

// 處理登入
async function handleLogin() {
  try {
    const tokenResponse = await googleLogin();
    accessToken = tokenResponse.access_token;
    localStorage.setItem('access_token', accessToken);
    showCheckInSection();
  } catch (error) {
    console.error('Login failed:', error);
    alert('登入失敗，請重試。');
  }
}

// 處理定位與取得附近店家
async function handleLocate() {
  loadingDiv.classList.remove('hidden');
  placesDiv.innerHTML = '';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    try {
      // 改為呼叫後端 App Script API
       const response = await fetch(SCRIPT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
            // Authorization 標頭在 getNearbyPlaces 保持移除狀態
          },
          mode: 'cors',
        body: JSON.stringify({
          action: 'getNearbyPlaces',
          lat: lat,
          lng: lng
        })
      });

      if (!response.ok) {
          const errorBody = await response.text(); // 嘗試讀取錯誤訊息
          throw new Error(`API error! status: ${response.status}, message: ${errorBody}`);
      }
      const data = await response.json(); // App Script 直接回傳 Google API 的 JSON

      loadingDiv.classList.add('hidden');
      if (data.results && data.results.length > 0) {
        placesDiv.innerHTML = ''; // 清空舊列表
        data.results.forEach(place => {
          const div = document.createElement('div');
          div.className = 'place';
          // 嘗試取得電話 (需要 Places Details API，這裡先留空)
          div.innerHTML = `
            <strong>${place.name}</strong><br/>
            <span>地址：${place.vicinity}</span>
            <span>評分：${place.rating || 'N/A'} (${place.user_ratings_total || 0} 則評論)</span>
            <button data-placeid="${place.place_id}" data-name="${place.name}" data-address="${place.vicinity}">選擇</button>
          `;
          div.querySelector('button').onclick = (e) => handleSelectPlace(e.target.dataset);
          placesDiv.appendChild(div);
        });
      } else {
        placesDiv.innerHTML = '附近找不到餐廳。';
      }
    } catch (error) {
      console.error('Error fetching places:', error);
      loadingDiv.classList.add('hidden');
      placesDiv.innerHTML = '取得附近餐廳時發生錯誤，請檢查網路或 API 金鑰設定。';
      alert('取得附近餐廳失敗: ' + error.message);
    }
  }, (error) => {
    console.error('Geolocation error:', error);
    loadingDiv.classList.add('hidden');
    placesDiv.innerHTML = '無法取得您的位置，請確認已開啟定位權限。';
    alert('無法取得位置: ' + error.message);
  }, { enableHighAccuracy: true });
}

// 處理選擇店家 (Check-in)
async function handleSelectPlace(placeData) {
  loadingDiv.classList.remove('hidden'); // 顯示處理中
  loadingDiv.innerText = '記錄進店資訊...';

  try {
    const response = await fetch(SCRIPT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      mode: 'cors', // App Script 需要 CORS
      body: JSON.stringify({
        action: 'checkin',
        placeId: placeData.placeid,
        placeName: placeData.name,
        placeAddress: placeData.address,
        placePhone: '' // 暫時留空
      })
    });

    const result = await response.json();
    loadingDiv.classList.add('hidden'); // 隱藏處理中

    if (result.success && result.visitId) {
      visitId = result.visitId;
      placeName = placeData.name;
      placeAddress = placeData.address;
      localStorage.setItem('visitId', visitId);
      localStorage.setItem('placeName', placeName);
      localStorage.setItem('placeAddress', placeAddress);
      showCheckoutSection();
    } else {
      throw new Error(result.error || 'Check-in API failed');
    }
  } catch (error) {
    console.error('Check-in failed:', error);
    loadingDiv.classList.add('hidden');
    alert('記錄進店資訊失敗: ' + error.message);
  }
}

// 處理照片選擇
function handlePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  photoMimeType = file.type;
  photoFilename = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    photoBase64 = reader.result; // 包含 data:image/...;base64,
    photoPreview.src = photoBase64;
    photoPreview.style.display = 'block';
  };
  reader.onerror = (error) => {
    console.error('Error reading file:', error);
    alert('讀取照片失敗');
  };
  reader.readAsDataURL(file);
}

 // 處理送出 Check-out
 async function handleSubmitCheckout() {
   const contactPerson = document.getElementById('contact-person').value;
   const contactInfo = document.getElementById('contact-info').value;

   // Add check for accessToken before proceeding
   if (!accessToken) {
       alert('請先登入');
       handleLogin(); // Or redirect to login
       return;
   }

  if (!contactPerson || !contactInfo) {
      alert('請填寫接觸人姓名與聯絡方式');
      return;
  }
  if (!visitId) {
      alert('發生錯誤，找不到拜訪 ID，請重新開始');
      clearVisitData();
      showCheckInSection();
      return;
  }

  loadingDiv.classList.remove('hidden'); // 顯示處理中
   loadingDiv.innerText = '送出拜訪紀錄...';

   try {
     // 改為呼叫後端 Node.js Proxy API
     const response = await fetch(PROXY_API_URL, {
       method: 'POST',
       headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      mode: 'cors',
      body: JSON.stringify({
        action: 'checkout',
        visitId: visitId,
        contactPerson: contactPerson,
        contactInfo: contactInfo,
        revisitNeeded: document.getElementById('revisit-needed').value === '是',
        notes: document.getElementById('notes').value,
        photoBase64: photoBase64, // 包含 data URI scheme
        photoMimeType: photoMimeType,
        photoFilename: photoFilename
      })
    });

    const result = await response.json();
    loadingDiv.classList.add('hidden'); // 隱藏處理中

    if (result.success) {
      showDoneSection(result.durationMinutes);
      clearVisitData(); // 清除本次拜訪資料
    } else {
      throw new Error(result.error || 'Check-out API failed');
    }
  } catch (error) {
    console.error('Check-out failed:', error);
    loadingDiv.classList.add('hidden');
    alert('送出紀錄失敗: ' + error.message);
  }
}

/**
 * Google OAuth 流程 (隱式授權) - 需在安全環境下處理 Token
 */
async function googleLogin() {
  return new Promise((resolve, reject) => {
    // 注意：Implicit Grant Flow 不再推薦用於新應用，建議改用 Authorization Code Flow with PKCE
    // 但對於純前端無後端的簡單場景，Implicit Flow 仍可使用，需注意 Token 安全
    const redirectUri = window.location.origin + window.location.pathname; // 確保與 Console 設定一致
    const scope = 'openid email profile'; // 移除 userinfo.email，openid 已包含
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&hd=${COMPANY_DOMAIN}&prompt=select_account`;

    // 簡單的 Popup 方式，可能被瀏覽器阻擋
    // 更好的方式是頁面跳轉，或使用 Google Identity Services (GIS) Library
    const width = 500, height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    // 監聽來自 Popup 的消息或檢查 hash
    const handleAuthResponse = (event) => {
        // 簡單實現：假設 popup 關閉後檢查 hash
        // 注意：這種方式不夠健壯
        window.removeEventListener('message', handleAuthResponse); // 清理監聽器
        const hash = window.location.hash.substring(1);
        if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const error = params.get('error');
            if (accessToken) {
                window.location.hash = ''; // 清除 hash
                resolve({ access_token: accessToken });
            } else if (error) {
                window.location.hash = ''; // 清除 hash
                reject(new Error('OAuth Error: ' + error));
            }
        }
    };

    // 檢查頁面加載時是否有 hash
    handleAuthResponse();

    // 打開 Popup (可能被阻擋)
    const authWindow = window.open(authUrl, 'GoogleLogin', `width=${width},height=${height},top=${top},left=${left}`);

    // 輪詢檢查 Popup 是否關閉以及 hash (備用方案)
    const pollTimer = window.setInterval(() => {
      if (!authWindow || authWindow.closed) {
        window.clearInterval(pollTimer);
        // Popup 關閉後，再次檢查 hash
        handleAuthResponse();
        // 如果還是沒有 token，則認為失敗或用戶取消
        // reject(new Error('Login cancelled or failed.')); // 避免過早 reject
      }
    }, 500);

  });
}
