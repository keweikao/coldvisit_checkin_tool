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
// Removed doneSection reference
const loadingMapDiv = document.getElementById('loading-map');
const mapDiv = document.getElementById('map'); // Map container
const selectedPlaceDiv = document.getElementById('selected-place');
const photoPreview = document.getElementById('photo-preview');
// Removed durationInfo reference
const contactDetailsDiv = document.getElementById('contact-details'); // Div for conditional fields
const revisitNeededSelect = document.getElementById('revisit-needed'); // Select element

 // --- Initialization ---
 window.onload = () => {
   console.log("window.onload triggered");
   handleRedirectHash(); // Check for OAuth token in hash first

   accessToken = localStorage.getItem('access_token');
   visitId = localStorage.getItem('visitId');
   placeName = localStorage.getItem('placeName');
   placeAddress = localStorage.getItem('placeAddress');
   console.log("onload - accessToken:", accessToken ? 'Exists' : 'null');
   console.log("onload - visitId:", visitId);

   if (accessToken) {
     console.log("onload - Access token found, hiding login.");
     loginSection.classList.add('hidden');
     if (visitId && placeName) {
       console.log("onload - Visit in progress, showing checkout.");
       showCheckoutSection();
     } else {
       console.log("onload - No visit in progress, showing checkin.");
       showCheckInSection();
       // Try to initialize map if API is ready
       if (typeof google === 'object' && typeof google.maps === 'object' && !map) {
            console.log("onload - Manually triggering map load sequence.");
            initMap();
       } else if (!map) { // If API not ready yet, initMap callback will handle it
            console.log("onload - Google Maps API not ready yet.");
       }
     }
   } else {
     console.log("onload - No access token, showing login.");
     showLoginSection();
   }
 };

 // initMap is called by the Google Maps script callback

 // --- Event Listeners ---
 document.getElementById('login-btn').onclick = handleLogin;
 document.getElementById('photo-input').onchange = handlePhotoChange;
 document.getElementById('submit-checkout').onclick = handleSubmitCheckout;
 document.getElementById('back-to-map').onclick = handleBackToMap; // Listener for back button
 document.getElementById('revisit-needed').onchange = toggleContactDetails; // Listener for conditional fields

// --- Map Initialization (Called by Google Maps API) ---
function initMap() {
  console.log("Maps API loaded, initializing map...");
  // Check login status again inside initMap as it might be called before onload finishes completely
  accessToken = localStorage.getItem('access_token');
  visitId = localStorage.getItem('visitId');
  placeName = localStorage.getItem('placeName');
  placeAddress = localStorage.getItem('placeAddress');

  if (accessToken) {
    if (!checkinSection.classList.contains('hidden')) { // Only load map if checkin is supposed to be visible
        getCurrentLocationAndLoadMap();
    } else {
        // If checkout is visible, don't load map yet
        loadingMapDiv.classList.add('hidden');
    }
  } else {
    showLoginSection(); // Ensure login is shown if no token
    loadingMapDiv.classList.add('hidden');
  }
}

function getCurrentLocationAndLoadMap() {
  loadingMapDiv.innerText = '取得目前位置...';
  loadingMapDiv.classList.remove('hidden');
  mapDiv.style.display = 'block'; // Ensure map div is visible

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log("User location:", userLocation);
        loadingMapDiv.innerText = '載入地圖與附近店家...';
        if (!map) { // Create map only if it doesn't exist
            createMap(userLocation);
        } else { // If map exists (e.g., coming back), just center and search
            map.setCenter(userLocation);
        }
        searchNearbyPlaces(userLocation);
      },
      (error) => {
        console.error("Geolocation error:", error);
        loadingMapDiv.innerText = '無法取得位置，請允許權限。';
        alert(`無法取得位置: ${error.message}`);
      },
      { enableHighAccuracy: true }
    );
  } else {
    loadingMapDiv.innerText = '瀏覽器不支援定位功能。';
    alert('瀏覽器不支援定位功能。');
  }
}

function createMap(location) {
  console.log("Creating map centered at:", location);
  map = new google.maps.Map(mapDiv, {
    center: location,
    zoom: 17,
    mapTypeControl: false,
    streetViewControl: false,
  });

  new google.maps.Marker({
      position: location,
      map: map,
      title: "我的位置",
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "#ffffff" }
   });

   infoWindow = new google.maps.InfoWindow();
   if (google.maps.places && google.maps.places.PlacesService) {
       console.log("Creating PlacesService.");
       placesService = new google.maps.places.PlacesService(map);
   } else {
       console.error("Places library not loaded!");
       alert("地圖地點服務載入失敗。");
       loadingMapDiv.innerText = '地圖地點服務載入失敗。';
   }
 }

 function searchNearbyPlaces(location) {
  const request = { location: location, radius: '50' };
  console.log("Attempting nearbySearch with request:", request);
  if (!placesService) { console.error("placesService not initialized!"); alert("地點搜尋服務未就緒。"); return; }

  placesService.nearbySearch(request, (results, status) => {
     console.log("nearbySearch callback status:", status);
     loadingMapDiv.classList.add('hidden');
     clearMarkers(); // Clear previous markers
     if (status === google.maps.places.PlacesServiceStatus.OK && results) {
      console.log(`Found ${results.length} places nearby.`);
      if (results.length === 0) {
          alert("附近 50 公尺內找不到地點標記。");
      }
      for (let i = 0; i < results.length; i++) {
        createMarker(results[i]);
      }
    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        console.log("No places found nearby.");
        alert("附近 50 公尺內找不到地點標記。");
    } else {
        console.error("Places API search failed:", status);
        alert("搜尋附近地點時發生錯誤: " + status);
    }
  });
}

function createMarker(place) {
  if (!place.geometry || !place.geometry.location) return;
  const marker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name });
  markers.push(marker);
  google.maps.event.addListener(marker, "click", () => {
    const content = `
      <div class="infowindow-content">
        <strong>${place.name}</strong>
        <span>${place.vicinity || '無地址資訊'}</span>
        <button onclick="handleSelectPlaceFromMap('${place.place_id}', '${escapeJS(place.name)}', '${escapeJS(place.vicinity || '')}')">選擇此店家 (Check-in)</button>
      </div>`;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);
  });
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

function escapeJS(str) {
    return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n') : '';
}

// --- UI Section Toggling ---
function showLoginSection() {
  loginSection.classList.remove('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.add('hidden');
  // doneSection is removed
  mapDiv.style.display = 'none';
  loadingMapDiv.classList.add('hidden');
}
function showCheckInSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.remove('hidden');
  checkoutSection.classList.add('hidden');
  // doneSection is removed
  mapDiv.style.display = 'block';
  loadingMapDiv.classList.remove('hidden');
  clearVisitData();
   if (typeof google === 'object' && typeof google.maps === 'object' && !map) {
        getCurrentLocationAndLoadMap();
   } else if (map) {
       loadingMapDiv.classList.add('hidden');
       // Optionally re-search if needed when returning
       // searchNearbyPlaces(map.getCenter());
   }
}
function showCheckoutSection() {
  loginSection.classList.add('hidden');
  checkinSection.classList.add('hidden');
  checkoutSection.classList.remove('hidden');
  // doneSection is removed
  mapDiv.style.display = 'none';
  loadingMapDiv.classList.add('hidden');
  selectedPlaceDiv.innerHTML = `<strong>${placeName}</strong><br/><span>地址：${placeAddress || 'N/A'}</span>`;
  // Reset form fields
  document.getElementById('photo-input').value = '';
  photoPreview.style.display = 'none';
  photoPreview.src = '';
  document.getElementById('contact-role').value = '';
  revisitNeededSelect.value = '否';
  document.getElementById('contact-person').value = '';
  document.getElementById('contact-info').value = '';
  document.getElementById('notes').value = '';
  toggleContactDetails();
}
// Removed showDoneSection

// --- Data Handling ---
function clearVisitData() {
  visitId = null; placeName = null; placeAddress = null;
  photoBase64 = ''; photoMimeType = ''; photoFilename = '';
  localStorage.removeItem('visitId');
  localStorage.removeItem('placeName');
  localStorage.removeItem('placeAddress');
}

// --- Auth ---
function handleLogin() {
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&hd=${COMPANY_DOMAIN}&prompt=select_account`;
    window.location.href = authUrl;
}

function handleRedirectHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const error = params.get('error');
        window.location.hash = '';
        if (token) {
            accessToken = token;
            localStorage.setItem('access_token', accessToken);
        } else if (error) {
            console.error('OAuth Error:', error);
            alert('登入失敗: ' + error);
            localStorage.removeItem('access_token');
        }
    }
}

// --- API Calls ---

// Check-in Call
async function handleSelectPlaceFromMap(pId, pName, pAddress) {
  if (!accessToken) { alert('請先登入'); handleLogin(); return; }
  if (infoWindow) infoWindow.close();

  const controlsLoading = document.createElement('div'); /* Simple loading */
  controlsLoading.innerText = '記錄進店資訊...'; checkinSection.appendChild(controlsLoading);

  try {
    const response = await fetch(`${API_BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      mode: 'cors',
      body: JSON.stringify({ placeId: pId, placeName: pName, placeAddress: pAddress, placePhone: '' })
    });
    const result = await response.json();
    checkinSection.removeChild(controlsLoading);

    if (response.ok && result.success && result.visitId) {
      visitId = result.visitId; placeName = pName; placeAddress = pAddress;
      localStorage.setItem('visitId', visitId);
      localStorage.setItem('placeName', placeName);
      localStorage.setItem('placeAddress', placeAddress);
      showCheckoutSection();
    } else { throw new Error(result.error || `Check-in API failed (${response.status})`); }
  } catch (error) {
    console.error('Check-in failed:', error);
    checkinSection.removeChild(controlsLoading);
    alert('記錄進店資訊失敗: ' + error.message);
  }
}

// Photo Handling
function handlePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) { photoBase64 = ''; photoPreview.style.display = 'none'; return; }
  photoMimeType = file.type; photoFilename = file.name;
  const reader = new FileReader();
  reader.onload = () => { photoBase64 = reader.result; photoPreview.src = photoBase64; photoPreview.style.display = 'block'; };
  reader.onerror = () => { alert('讀取照片失敗'); photoPreview.style.display = 'none'; photoBase64 = ''; };
  reader.readAsDataURL(file);
}

 // Check-out Call
 async function handleSubmitCheckout() {
   const contactRole = document.getElementById('contact-role').value;
   const revisitNeeded = revisitNeededSelect.value === '是';
   const contactPersonInput = document.getElementById('contact-person');
   const contactInfoInput = document.getElementById('contact-info');
   const notes = document.getElementById('notes').value;
   let contactPerson = ''; let contactInfo = '';

   if (!accessToken) { alert('請先登入'); handleLogin(); return; }
   if (!contactRole) { alert('請選擇接觸人員角色'); return; }
   if (!visitId) { alert('發生錯誤，找不到拜訪 ID'); clearVisitData(); showCheckInSection(); return; }

   if (revisitNeeded) {
       contactPerson = contactPersonInput.value.trim();
       contactInfo = contactInfoInput.value.trim();
       if (!contactPerson || !contactInfo) { alert('預計再訪時，請填寫聯絡人姓名與聯絡電話'); return; }
   }

  const controlsLoading = document.createElement('div'); /* Simple loading */
  controlsLoading.innerText = '送出拜訪紀錄...'; checkoutSection.appendChild(controlsLoading);

  try {
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        mode: 'cors',
        body: JSON.stringify({
          visitId: visitId, contactRole: contactRole, revisitNeeded: revisitNeeded,
          contactPerson: contactPerson, contactInfo: contactInfo, notes: notes,
          photoBase64: photoBase64, photoMimeType: photoMimeType, photoFilename: photoFilename
        })
      });
      const result = await response.json();
      checkoutSection.removeChild(controlsLoading);

      if (response.ok && result.success) {
        alert('紀錄已成功送出！'); // Give feedback before switching view
        clearVisitData();
        showCheckInSection(); // Go back to map view
        getCurrentLocationAndLoadMap(); // Reload map for next checkin
      } else { throw new Error(result.error || `Check-out API failed (${response.status})`); }
  } catch (error) {
    console.error('Check-out failed:', error);
    checkoutSection.removeChild(controlsLoading);
    alert('送出紀錄失敗: ' + error.message);
  }
}

// --- UI Logic Functions ---

// Toggle visibility of contact details based on revisit selection
function toggleContactDetails() {
    if (revisitNeededSelect.value === '是') {
        contactDetailsDiv.classList.remove('hidden');
    } else {
        contactDetailsDiv.classList.add('hidden');
    }
}

// Handle "Back to Map" button click
function handleBackToMap() {
    if (confirm("確定要返回地圖嗎？目前填寫的 Check-out 資料將不會儲存。")) {
        // Don't clear visitId/placeName from localStorage, just go back
        showCheckInSection();
        // Reload map
        getCurrentLocationAndLoadMap();
    }
}
