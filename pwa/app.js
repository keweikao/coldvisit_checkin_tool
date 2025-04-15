// --- 設定值 ---
const CLIENT_ID = '916934078689-iiqq9op8ee3q810ut8cclhbdg470puf0.apps.googleusercontent.com'; // Used by GIS
const API_BASE_URL = 'https://coldvisit-backend.zeabur.app'; // Node.js backend URL
// GOOGLE_MAPS_API_KEY is now only in index.html
const COMPANY_DOMAIN = 'ichef.com.tw'; // Used for GIS hint

// --- 全域變數 ---
// let accessToken = null; // No longer using Access Token directly
let idToken = null; // Store the ID Token received from GIS
let userEmail = null; // Store verified user email
let isAuthenticated = false; // Simple flag for auth state

let visitId = localStorage.getItem('visitId'); // Keep visit state in localStorage
let placeName = localStorage.getItem('placeName');
let placeAddress = localStorage.getItem('placeAddress');
let photoBase64 = '';
let photoMimeType = '';
let photoFilename = '';

// Map related variables
let map;
let placesService;
let infoWindow;
let markers = [];

// --- DOM 元素 ---
const loginSection = document.getElementById('login-section');
const checkinSection = document.getElementById('checkin-section');
const checkoutSection = document.getElementById('checkout-section');
const loadingMapDiv = document.getElementById('loading-map');
const mapDiv = document.getElementById('map');
const selectedPlaceDiv = document.getElementById('selected-place');
const photoPreview = document.getElementById('photo-preview');
const contactDetailsDiv = document.getElementById('contact-details');
const revisitNeededSelect = document.getElementById('revisit-needed');

 // --- Initialization ---
 window.onload = () => {
   console.log("window.onload triggered");
   // GIS library handles its own initialization via the divs in index.html
   // We just need to check if we have ongoing state from previous session

   // Try to retrieve auth state if needed (e.g., if backend issues its own token)
   // For now, we rely on the GIS callback to set the state upon login.

   visitId = localStorage.getItem('visitId');
   placeName = localStorage.getItem('placeName');
   placeAddress = localStorage.getItem('placeAddress');
   console.log("onload - visitId:", visitId);

   // Initial UI state assumes not logged in, GIS button will show.
   // If GIS auto-logs in or user clicks button, handleCredentialResponse takes over.
   // Check if already authenticated from previous session (simple flag)
   isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
   userEmail = localStorage.getItem('userEmail'); // Also retrieve email

   if (isAuthenticated && userEmail) {
       console.log("onload - Already authenticated from localStorage");
       initializeApp();
   } else {
       console.log("onload - Not authenticated, showing login.");
       showLoginSection();
   }

 };

// --- GIS Callback Function ---
async function handleCredentialResponse(response) {
    console.log("GIS Credential Response Received:");
    idToken = response.credential;
    console.log("ID Token (first 15 chars):", idToken ? idToken.substring(0, 15) + '...' : 'null');
    if (!idToken) { console.error("GIS did not return an ID Token."); alert("登入失敗，無法取得憑證。"); return; }

    try {
        console.log("Sending ID token to backend for verification...");
        const verifyResponse = await fetch(`${API_BASE_URL}/api/auth/verify-google`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors',
            body: JSON.stringify({ idToken: idToken })
        });
        const verifyResult = await verifyResponse.json();

        if (verifyResponse.ok && verifyResult.success && verifyResult.email) {
            console.log("Backend verified token successfully for:", verifyResult.email);
            isAuthenticated = true; userEmail = verifyResult.email; idToken = response.credential; // Store valid token
            localStorage.setItem('userEmail', userEmail); localStorage.setItem('isAuthenticated', 'true');
            initializeApp();
        } else { throw new Error(verifyResult.error || `Backend token verification failed (${verifyResponse.status})`); }
    } catch (error) {
        console.error("Backend token verification failed:", error);
        isAuthenticated = false; userEmail = null; idToken = null;
        localStorage.removeItem('userEmail'); localStorage.removeItem('isAuthenticated');
        alert("登入驗證失敗: " + error.message);
        showLoginSection();
    }
}

 // --- App Initialization for Authenticated User ---
 function initializeApp() {
    console.log("initializeApp called");
    loginSection.classList.add('hidden');
    visitId = localStorage.getItem('visitId'); placeName = localStorage.getItem('placeName'); placeAddress = localStorage.getItem('placeAddress');
    if (visitId && placeName) { console.log("initializeApp - Visit in progress, showing checkout."); showCheckoutSection(); }
    else { console.log("initializeApp - No visit in progress, showing checkin."); showCheckInSection(); if (typeof google === 'object' && typeof google.maps === 'object') { if (!map) { console.log("initializeApp - Manually triggering map load sequence."); initMap(); } else { getCurrentLocationAndLoadMap(); } } else { console.log("initializeApp - Google Maps API not ready yet."); } }
 }

// --- Map Initialization (Called by Google Maps API) ---
function initMap() {
  console.log("Maps API loaded, calling initMap...");
  isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'; // Re-check auth state
  if (isAuthenticated && !checkinSection.classList.contains('hidden')) { getCurrentLocationAndLoadMap(); }
  else { console.log("initMap - Skipping map load (not authenticated or not on checkin screen)."); loadingMapDiv.classList.add('hidden'); if (!isAuthenticated) { showLoginSection(); } }
}

function getCurrentLocationAndLoadMap() {
  loadingMapDiv.innerText = '取得目前位置...'; loadingMapDiv.classList.remove('hidden'); mapDiv.style.display = 'block';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition( (position) => { const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude }; console.log("User location:", userLocation); loadingMapDiv.innerText = '載入地圖與附近店家...'; if (!map) { createMap(userLocation); } else { map.setCenter(userLocation); } searchNearbyPlaces(userLocation); }, (error) => { console.error("Geolocation error:", error); loadingMapDiv.innerText = '無法取得位置，請允許權限。'; alert(`無法取得位置: ${error.message}`); }, { enableHighAccuracy: true } );
  } else { loadingMapDiv.innerText = '瀏覽器不支援定位功能。'; alert('瀏覽器不支援定位功能。'); }
}

function createMap(location) {
  console.log("Creating map centered at:", location);
  map = new google.maps.Map(mapDiv, { center: location, zoom: 17, mapTypeControl: false, streetViewControl: false });
  new google.maps.Marker({ position: location, map: map, title: "我的位置", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "#ffffff" } });
  infoWindow = new google.maps.InfoWindow();
  if (google.maps.places && google.maps.places.PlacesService) { console.log("Creating PlacesService."); placesService = new google.maps.places.PlacesService(map); }
  else { console.error("Places library not loaded!"); alert("地圖地點服務載入失敗。"); loadingMapDiv.innerText = '地圖地點服務載入失敗。'; }
}

 function searchNearbyPlaces(location) {
  const request = { location: location, radius: '50' };
  console.log("Attempting nearbySearch with request:", request);
  if (!placesService) { console.error("placesService not initialized!"); alert("地點搜尋服務未就緒。"); return; }
  placesService.nearbySearch(request, (results, status) => {
     console.log("nearbySearch callback status:", status); loadingMapDiv.classList.add('hidden'); clearMarkers();
     if (status === google.maps.places.PlacesServiceStatus.OK && results) {
      console.log(`Found ${results.length} places nearby.`); if (results.length === 0) { alert("附近 50 公尺內找不到地點標記。"); }
      results.forEach(place => createMarker(place)); // Use forEach
    } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) { console.log("No places found nearby."); alert("附近 50 公尺內找不到地點標記。"); }
    else { console.error("Places API search failed:", status); alert("搜尋附近地點時發生錯誤: " + status); }
  });
}

// *** MODIFIED createMarker function ***
function createMarker(place) {
  if (!place.geometry || !place.geometry.location) return;
  const marker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name });
  markers.push(marker);

  google.maps.event.addListener(marker, "click", () => {
    // Store data needed by the button in temporary variables or directly in HTML data attributes
    const placeId = place.place_id;
    const placeNameStr = escapeJS(place.name);
    const placeAddressStr = escapeJS(place.vicinity || '');

    const content = `
      <div class="infowindow-content">
        <strong>${place.name}</strong>
        <span>${place.vicinity || '無地址資訊'}</span>
        <button id="infowindow-btn-${placeId}">選擇此店家 (Check-in)</button>
      </div>`;
    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    // Add listener AFTER InfoWindow DOM is ready
    google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
      const button = document.getElementById(`infowindow-btn-${placeId}`);
      if (button) {
        // Use a clean event listener, avoid potential issues with cloning/replacing
        button.addEventListener('click', () => {
            handleSelectPlaceFromMap(placeId, place.name, place.vicinity || ''); // Use original non-escaped values
        });
      } else {
          console.error("Could not find select button in InfoWindow with ID:", `infowindow-btn-${placeId}`);
      }
    });
  });
}
// *** END MODIFIED createMarker function ***

function clearMarkers() { markers.forEach(marker => marker.setMap(null)); markers = []; }
function escapeJS(str) { return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n') : ''; }

// --- UI Section Toggling ---
function showLoginSection() { loginSection.classList.remove('hidden'); checkinSection.classList.add('hidden'); checkoutSection.classList.add('hidden'); mapDiv.style.display = 'none'; loadingMapDiv.classList.add('hidden'); }
function showCheckInSection() { loginSection.classList.add('hidden'); checkinSection.classList.remove('hidden'); checkoutSection.classList.add('hidden'); mapDiv.style.display = 'block'; loadingMapDiv.classList.remove('hidden'); clearVisitData(); if (typeof google === 'object' && typeof google.maps === 'object' && !map) { getCurrentLocationAndLoadMap(); } else if (map) { loadingMapDiv.classList.add('hidden'); } }
function showCheckoutSection() { loginSection.classList.add('hidden'); checkinSection.classList.add('hidden'); checkoutSection.classList.remove('hidden'); mapDiv.style.display = 'none'; loadingMapDiv.classList.add('hidden'); selectedPlaceDiv.innerHTML = `<strong>${placeName}</strong><br/><span>地址：${placeAddress || 'N/A'}</span>`; document.getElementById('photo-input').value = ''; photoPreview.style.display = 'none'; photoPreview.src = ''; document.getElementById('contact-role').value = ''; revisitNeededSelect.value = '否'; document.getElementById('contact-person').value = ''; document.getElementById('contact-info').value = ''; document.getElementById('notes').value = ''; toggleContactDetails(); }

// --- Data Handling ---
function clearVisitData() { visitId = null; placeName = null; placeAddress = null; photoBase64 = ''; photoMimeType = ''; photoFilename = ''; localStorage.removeItem('visitId'); localStorage.removeItem('placeName'); localStorage.removeItem('placeAddress'); }

// --- Auth ---
// Removed old handleLogin and handleRedirectHash (GIS handles login UI, callback handles response)

// --- API Calls ---

// Check-in Call
async function handleSelectPlaceFromMap(pId, pName, pAddress) {
  // Use global idToken set by handleCredentialResponse
  if (!idToken) { alert('登入狀態失效，請重新整理或重新登入'); return; }
  if (infoWindow) infoWindow.close();
  const controlsLoading = document.createElement('div'); controlsLoading.innerText = '記錄進店資訊...'; checkinSection.appendChild(controlsLoading);
  try {
    const response = await fetch(`${API_BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      mode: 'cors',
      body: JSON.stringify({ placeId: pId, placeName: pName, placeAddress: pAddress, placePhone: '' })
    });
    const result = await response.json();
    checkinSection.removeChild(controlsLoading);
    if (response.ok && result.success && result.visitId) {
      visitId = result.visitId; placeName = pName; placeAddress = pAddress;
      localStorage.setItem('visitId', visitId); localStorage.setItem('placeName', placeName); localStorage.setItem('placeAddress', placeAddress);
      showCheckoutSection();
    } else { throw new Error(result.error || `Check-in API failed (${response.status})`); }
  } catch (error) { console.error('Check-in failed:', error); checkinSection.removeChild(controlsLoading); alert('記錄進店資訊失敗: ' + error.message); }
}

// Photo Handling
function handlePhotoChange(e) { const file = e.target.files[0]; if (!file) { photoBase64 = ''; photoPreview.style.display = 'none'; return; } photoMimeType = file.type; photoFilename = file.name; const reader = new FileReader(); reader.onload = () => { photoBase64 = reader.result; photoPreview.src = photoBase64; photoPreview.style.display = 'block'; }; reader.onerror = () => { alert('讀取照片失敗'); photoPreview.style.display = 'none'; photoBase64 = ''; }; reader.readAsDataURL(file); }

 // Check-out Call
 async function handleSubmitCheckout() {
   const contactRole = document.getElementById('contact-role').value;
   const revisitNeeded = revisitNeededSelect.value === '是';
   const contactPersonInput = document.getElementById('contact-person');
   const contactInfoInput = document.getElementById('contact-info');
   const notes = document.getElementById('notes').value;
   let contactPerson = ''; let contactInfo = '';

   // Use global idToken
   if (!idToken) { alert('登入狀態失效，請重新整理或重新登入'); return; }
   if (!contactRole) { alert('請選擇接觸人員角色'); return; }
   if (!visitId) { alert('發生錯誤，找不到拜訪 ID'); clearVisitData(); showCheckInSection(); return; }
   if (revisitNeeded) { contactPerson = contactPersonInput.value.trim(); contactInfo = contactInfoInput.value.trim(); if (!contactPerson || !contactInfo) { alert('預計再訪時，請填寫聯絡人姓名與聯絡電話'); return; } }

  const controlsLoading = document.createElement('div'); controlsLoading.innerText = '送出拜訪紀錄...'; checkoutSection.appendChild(controlsLoading);
  try {
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken }, // Send ID Token
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
        alert('紀錄已成功送出！');
        clearVisitData();
        showCheckInSection();
        getCurrentLocationAndLoadMap();
      } else { throw new Error(result.error || `Check-out API failed (${response.status})`); }
  } catch (error) { console.error('Check-out failed:', error); checkoutSection.removeChild(controlsLoading); alert('送出紀錄失敗: ' + error.message); }
}

// --- UI Logic Functions ---
function toggleContactDetails() { if (revisitNeededSelect.value === '是') { contactDetailsDiv.classList.remove('hidden'); } else { contactDetailsDiv.classList.add('hidden'); } }
function handleBackToMap() { if (confirm("確定要返回地圖嗎？目前填寫的 Check-out 資料將不會儲存。")) { showCheckInSection(); getCurrentLocationAndLoadMap(); } }

// Make GIS callback globally accessible
window.handleCredentialResponse = handleCredentialResponse;
// Make map init globally accessible for API callback
window.initMap = initMap;
