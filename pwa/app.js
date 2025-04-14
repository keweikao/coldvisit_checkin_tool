// --- 設定值 ---
const CLIENT_ID = '916934078689-iiqq9op8ee3q810ut8cclhbdg470puf0.apps.googleusercontent.com';
const API_BASE_URL = 'https://coldvisit-backend.zeabur.app'; // Node.js backend URL
const GOOGLE_MAPS_API_KEY = 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784'; // Used in index.html now
const COMPANY_DOMAIN = 'ichef.com.tw';

// --- 全域變數 ---
let accessToken = localStorage.getItem('access_token');
let visitId = localStorage.getItem('visitId');
let placeName = localStorage.getItem('placeName');
let placeAddress = localStorage.getItem('placeAddress');
let photoBase64 = '';
let photoMimeType = '';
let photoFilename = '';

// Map related variables
let map;
let placesService;
let infoWindow;
let markers = []; // To keep track of markers

// --- DOM 元素 ---
const loginSection = document.getElementById('login-section');
const checkinSection = document.getElementById('checkin-section');
const checkoutSection = document.getElementById('checkout-section');
const doneSection = document.getElementById('done-section');
const loadingMapDiv = document.getElementById('loading-map');
const mapDiv = document.getElementById('map'); // Map container
const selectedPlaceDiv = document.getElementById('selected-place');
const photoPreview = document.getElementById('photo-preview');
const durationInfo = document.getElementById('duration-info');

// --- Initialization ---
// initMap is called by the Google Maps script callback, NOT window.onload anymore

// --- Event Listeners ---
document.getElementById('login-btn').onclick = handleLogin;
// Removed locate-btn listener
document.getElementById('photo-input').onchange = handlePhotoChange;
document.getElementById('submit-checkout').onclick = handleSubmitCheckout;
document.getElementById('cancel-checkout').onclick = cancelCheckout; // Added cancel button listener

// --- Map Initialization (Called by Google Maps API) ---
function initMap() {
  console.log("Maps API loaded, initializing map...");
  // Check login status first
  accessToken = localStorage.getItem('access_token');
  visitId = localStorage.getItem('visitId');
  placeName = localStorage.getItem('placeName');
  placeAddress = localStorage.getItem('placeAddress');

  if (accessToken) {
    loginSection.classList.add('hidden');
    if (visitId && placeName) {
      // If a visit is in progress, show checkout immediately, don't init map yet
      showCheckoutSection();
      loadingMapDiv.classList.add('hidden'); // Hide map loading
    } else {
      // Logged in, no visit in progress, proceed with map init
      showCheckInSection(); // Show the map container section
      getCurrentLocationAndLoadMap();
    }
  } else {
    // Not logged in
    showLoginSection();
    loadingMapDiv.classList.add('hidden'); // Hide map loading
  }
}

function getCurrentLocationAndLoadMap() {
  loadingMapDiv.innerText = '取得目前位置...';
  loadingMapDiv.classList.remove('hidden');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log("User location:", userLocation);
        loadingMapDiv.innerText = '載入地圖與附近店家...';
        createMap(userLocation);
        searchNearbyPlaces(userLocation);
      },
      (error) => {
        console.error("Geolocation error:", error);
        loadingMapDiv.innerText = '無法取得位置，請允許權限。';
        // Optionally default to a fallback location
        // createMap({ lat: 25.034, lng: 121.564 }); // Example: Taipei 101
        alert(`無法取得位置: ${error.message}`);
      },
      { enableHighAccuracy: true }
    );
  } else {
    // Browser doesn't support Geolocation
    loadingMapDiv.innerText = '瀏覽器不支援定位功能。';
    alert('瀏覽器不支援定位功能。');
    // Optionally default to a fallback location
    // createMap({ lat: 25.034, lng: 121.564 });
  }
}

function createMap(location) {
  map = new google.maps.Map(mapDiv, {
    center: location,
    zoom: 16, // Adjust zoom level as needed
    mapTypeControl: false,
    streetViewControl: false,
  });

  // Add a marker for the user's current location
  new google.maps.Marker({
      position: location,
      map: map,
      title: "我的位置",
      icon: { // Optional: style user marker differently
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff",
      }
  });

  infoWindow = new google.maps.InfoWindow();
  placesService = new google.maps.places.PlacesService(map);
}

function searchNearbyPlaces(location) {
  const request = {
    location: location,
    radius: '1000', // Increased radius slightly
    // types: ['restaurant', 'cafe', 'food', 'meal_takeaway'] // Broader search
    type: 'food' // Keep it simple for now
  };

  placesService.nearbySearch(request, (results, status) => {
    loadingMapDiv.classList.add('hidden'); // Hide loading message
    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
      console.log(`Found ${results.length} places nearby.`);
      clearMarkers();
      for (let i = 0; i < results.length; i++) {
        createMarker(results[i]);
      }
    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        console.log("No places found nearby.");
        alert("附近找不到符合條件的地點。");
    } else {
        console.error("Places API search failed:", status);
        alert("搜尋附近地點時發生錯誤: " + status);
    }
  });
}

function createMarker(place) {
  if (!place.geometry || !place.geometry.location) return;

  const marker = new google.maps.Marker({
    map: map,
    position: place.geometry.location,
    title: place.name
  });

  markers.push(marker); // Add marker to array

  google.maps.event.addListener(marker, "click", () => {
    const content = `
      <div class="infowindow-content">
        <strong>${place.name}</strong>
        <span>${place.vicinity || '無地址資訊'}</span>
        <button onclick="handleSelectPlaceFromMap('${place.place_id}', '${escapeJS(place.name)}', '${escapeJS(place.vicinity || '')}')">選擇此店家 (Check-in)</button>
      </div>
    `;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);
  });
}

// Helper to clear existing markers
function clearMarkers() {
    for (let i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }
    markers = [];
}

// Helper to escape strings for use in JS function calls within HTML
function escapeJS(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}


// --- Original Functions Modified/Kept ---

// 顯示不同區塊 (Adjusted)
function showLoginSection() {
  loginSection.classList.remove('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.add('hidden');
  doneSection.classList.add('hidden');
  mapDiv.style.display = 'none'; // Hide map when logged out
  loadingMapDiv.classList.add('hidden');
}
function showCheckInSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.remove('hidden');
  checkoutSection.classList.add('hidden');
  doneSection.classList.add('hidden');
  mapDiv.style.display = 'block'; // Show map
  loadingMapDiv.classList.remove('hidden'); // Show loading initially
  clearVisitData();
  // Map initialization is now triggered by initMap -> getCurrentLocationAndLoadMap
}
function showCheckoutSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.remove('hidden');
  doneSection.classList.add('hidden');
  mapDiv.style.display = 'none'; // Hide map during checkout
  loadingMapDiv.classList.add('hidden');
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
  mapDiv.style.display = 'none'; // Hide map on done screen
  loadingMapDiv.classList.add('hidden');
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

// 處理登入 (改為頁面跳轉)
function handleLogin() {
    const redirectUri = window.location.origin + window.location.pathname; // Use current page
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&hd=${COMPANY_DOMAIN}&prompt=select_account`;
    // Redirect current window to Google Auth
    window.location.href = authUrl;
}

// 處理 OAuth 回調 Hash
function handleRedirectHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const error = params.get('error');
        // Clear the hash immediately
        window.location.hash = '';
        if (token) {
            accessToken = token;
            localStorage.setItem('access_token', accessToken);
            // Reload the page to trigger window.onload correctly
            window.location.reload();
        } else if (error) {
            console.error('OAuth Error:', error);
            alert('登入失敗: ' + error);
        }
    }
}

// 處理從地圖 InfoWindow 選擇店家 (Check-in)
async function handleSelectPlaceFromMap(pId, pName, pAddress) {
  if (!accessToken) {
      alert('請先登入');
      handleLogin();
      return;
  }
  // Close the info window
  if (infoWindow) {
      infoWindow.close();
  }

  // Show loading indicator on the controls panel
  const controlsLoading = document.createElement('div');
  controlsLoading.id = 'controls-loading';
  controlsLoading.innerText = '記錄進店資訊...';
  controlsLoading.style.padding = '1em';
  controlsLoading.style.textAlign = 'center';
  checkinSection.appendChild(controlsLoading);


  try {
    // Call the backend Node.js API
    const response = await fetch(`${API_BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      mode: 'cors',
      body: JSON.stringify({
        // action: 'checkin', // Action might be implicit in the endpoint now
        placeId: pId,
        placeName: pName,
        placeAddress: pAddress,
        placePhone: '' // Still need details API for phone
      })
    });

    const result = await response.json();
    checkinSection.removeChild(controlsLoading); // Remove loading indicator

    if (result.success && result.visitId) {
      visitId = result.visitId;
      placeName = pName;
      placeAddress = pAddress;
      localStorage.setItem('visitId', visitId);
      localStorage.setItem('placeName', placeName);
      localStorage.setItem('placeAddress', placeAddress);
      showCheckoutSection(); // Switch to checkout view
    } else {
      throw new Error(result.error || 'Check-in API failed');
    }
  } catch (error) {
    console.error('Check-in failed:', error);
    checkinSection.removeChild(controlsLoading); // Remove loading indicator
    alert('記錄進店資訊失敗: ' + error.message);
  }
}

// 處理照片選擇 (No change needed)
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

 // 處理送出 Check-out (No change needed in API call itself)
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
      showCheckInSection(); // Go back to checkin/map view
      return;
  }

  // Show loading indicator on controls
  const controlsLoading = document.createElement('div');
  controlsLoading.id = 'controls-loading';
  controlsLoading.innerText = '送出拜訪紀錄...';
  controlsLoading.style.padding = '1em';
  controlsLoading.style.textAlign = 'center';
  checkoutSection.appendChild(controlsLoading);


  try {
      // Call the backend Node.js API
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      mode: 'cors',
      body: JSON.stringify({
        // action: 'checkout', // Action might be implicit
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
    checkoutSection.removeChild(controlsLoading); // Remove loading

    if (result.success) {
      showDoneSection(result.durationMinutes);
      clearVisitData(); // Clear data for next visit
    } else {
      throw new Error(result.error || 'Check-out API failed');
    }
  } catch (error) {
    console.error('Check-out failed:', error);
    checkoutSection.removeChild(controlsLoading); // Remove loading
    alert('送出紀錄失敗: ' + error.message);
  }
}

// Handle Cancel Checkout
function cancelCheckout() {
    if (confirm("確定要取消本次拜訪紀錄嗎？(Check-in 資料將被保留，但無法完成 Check-out)")) {
        // Just clear the form and go back to checkin/map view
        // Keep visitId etc. in localStorage in case user wants to resume? Or clear it?
        // Let's clear it for simplicity now.
        clearVisitData();
        showCheckInSection();
        // Reload map if needed, or assume user will re-trigger location
        getCurrentLocationAndLoadMap();
    }
}
