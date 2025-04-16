// --- 設定值 ---
const CLIENT_ID = '916934078689-iiqq9op8ee3q810ut8cclhbdg470puf0.apps.googleusercontent.com'; // Used for OAuth
const API_BASE_URL = 'https://coldvisit-backend.zeabur.app'; // Node.js backend URL
// GOOGLE_MAPS_API_KEY is in index.html
const COMPANY_DOMAIN = 'ichef.com.tw';

// --- 全域變數 ---
let accessToken = localStorage.getItem('access_token'); // Use accessToken again
let userEmail = localStorage.getItem('userEmail'); // Still store/retrieve email, but don't block on it initially
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
let markers = [];

// --- DOM 元素 ---
const loginSection = document.getElementById('login-section');
const userStatusDiv = document.getElementById('user-status');
const userEmailSpan = document.getElementById('user-email');
const checkinSection = document.getElementById('checkin-section');
const checkoutSection = document.getElementById('checkout-section');
const loadingMapDiv = document.getElementById('loading-map');
const mapDiv = document.getElementById('map');
const selectedPlaceDiv = document.getElementById('selected-place');
const photoPreview = document.getElementById('photo-preview');
const contactDetailsDiv = document.getElementById('contact-details');
const revisitNeededSelect = document.getElementById('revisit-needed');
// New form elements
const brandStatusSelect = document.getElementById('brand-status');
const usingPOSSelect = document.getElementById('using-pos');
const posBrandSection = document.getElementById('pos-brand-section');
const usingOnlineOrderingSelect = document.getElementById('using-online-ordering');
const orderingBrandSection = document.getElementById('ordering-brand-section');
const usingOnlineBookingSelect = document.getElementById('using-online-booking');
const bookingBrandSection = document.getElementById('booking-brand-section');


 // --- Initialization ---
 window.onload = () => {
   console.log("window.onload triggered");
   handleRedirectHash(); // Check for OAuth token in hash first

   accessToken = localStorage.getItem('access_token'); // Read token
   userEmail = localStorage.getItem('userEmail'); // Try to read stored email
   visitId = localStorage.getItem('visitId');
   placeName = localStorage.getItem('placeName');
   placeAddress = localStorage.getItem('placeAddress');
   console.log("onload - accessToken:", accessToken ? 'Exists' : 'null');
   console.log("onload - userEmail:", userEmail);
   console.log("onload - visitId:", visitId);

   // Only check for accessToken to determine if logged in initially
   if (accessToken) {
     console.log("onload - Access token found. Initializing app.");
     initializeApp(); // Initialize app, which will fetch email if needed
   } else {
     console.log("onload - No access token, showing login.");
     showLoginSection();
   }
 };

 // initMap is called by the Google Maps script callback

 // --- Event Listeners ---
 document.getElementById('login-btn').onclick = handleLogin;
 document.getElementById('logout-btn').onclick = handleLogout;
 document.getElementById('photo-input').onchange = handlePhotoChange;
 document.getElementById('submit-checkout').onclick = handleSubmitCheckout;
 document.getElementById('back-to-map').onclick = handleBackToMap;
 // Add listeners for new conditional fields
 document.getElementById('revisit-needed').onchange = () => toggleConditionalVisibility('revisit-needed', 'contact-details');
 document.getElementById('using-pos').onchange = () => toggleConditionalVisibility('using-pos', 'pos-brand-section');
 document.getElementById('using-online-ordering').onchange = () => toggleConditionalVisibility('using-online-ordering', 'ordering-brand-section');
 document.getElementById('using-online-booking').onchange = () => toggleConditionalVisibility('using-online-booking', 'booking-brand-section');


 // --- App Initialization for Authenticated User ---
 async function initializeApp() {
    console.log("initializeApp called");
    loginSection.classList.add('hidden');

    if (!userEmail && accessToken) {
        console.log("initializeApp - Fetching user email from backend...");
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/me`, { headers: { 'Authorization': 'Bearer ' + accessToken }, mode: 'cors' });
            if (!response.ok) { throw new Error(`Failed to fetch email (${response.status})`); }
            const data = await response.json();
            if (data.email) { userEmail = data.email; localStorage.setItem('userEmail', userEmail); console.log("initializeApp - User email fetched:", userEmail); showUserStatus(); }
            else { throw new Error('Backend did not return email'); }
        } catch (error) { console.error("initializeApp - Failed to fetch user email:", error); alert("無法驗證您的登入狀態，請重新登入。"); handleLogout(); return; }
    } else if (userEmail) { showUserStatus(); }
    else { handleLogout(); return; }

    visitId = localStorage.getItem('visitId'); placeName = localStorage.getItem('placeName'); placeAddress = localStorage.getItem('placeAddress');
    if (visitId && placeName) { console.log("initializeApp - Visit in progress, showing checkout."); showCheckoutSection(); }
    else { console.log("initializeApp - No visit in progress, showing checkin."); showCheckInSection(); if (typeof google === 'object' && typeof google.maps === 'object' && !map) { console.log("initializeApp - Manually triggering map load sequence."); initMap(); } else if (map) { getCurrentLocationAndLoadMap(); } else { console.log("initializeApp - Google Maps API not ready yet."); } }
 }

// --- Map Initialization (Called by Google Maps API) ---
function initMap() { /* ... keep implementation ... */ console.log("Maps API loaded, calling initMap..."); accessToken = localStorage.getItem('access_token'); if (accessToken && !checkinSection.classList.contains('hidden')) { getCurrentLocationAndLoadMap(); } else { console.log("initMap - Skipping map load (not authenticated or not on checkin screen)."); loadingMapDiv.classList.add('hidden'); if (!accessToken) { showLoginSection(); } } }
function getCurrentLocationAndLoadMap() { /* ... keep implementation ... */ loadingMapDiv.innerText = '取得目前位置...'; loadingMapDiv.classList.remove('hidden'); mapDiv.style.display = 'block'; if (navigator.geolocation) { navigator.geolocation.getCurrentPosition( (position) => { const userLocation = { lat: position.coords.latitude, lng: position.coords.longitude }; console.log("User location:", userLocation); loadingMapDiv.innerText = '載入地圖與附近店家...'; if (!map) { createMap(userLocation); } else { map.setCenter(userLocation); } searchNearbyPlaces(userLocation); }, (error) => { console.error("Geolocation error:", error); loadingMapDiv.innerText = '無法取得位置，請允許權限。'; alert(`無法取得位置: ${error.message}`); }, { enableHighAccuracy: true } ); } else { loadingMapDiv.innerText = '瀏覽器不支援定位功能。'; alert('瀏覽器不支援定位功能。'); } }
function createMap(location) { /* ... keep implementation ... */ console.log("Creating map centered at:", location); map = new google.maps.Map(mapDiv, { center: location, zoom: 17, mapTypeControl: false, streetViewControl: false }); new google.maps.Marker({ position: location, map: map, title: "我的位置", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "#ffffff" } }); infoWindow = new google.maps.InfoWindow(); if (google.maps.places && google.maps.places.PlacesService) { console.log("Creating PlacesService."); placesService = new google.maps.places.PlacesService(map); } else { console.error("Places library not loaded!"); alert("地圖地點服務載入失敗。"); loadingMapDiv.innerText = '地圖地點服務載入失敗。'; } }
function searchNearbyPlaces(location) { /* ... keep implementation ... */ const request = { location: location, radius: '50' }; console.log("Attempting nearbySearch with request:", request); if (!placesService) { console.error("placesService not initialized!"); alert("地點搜尋服務未就緒。"); return; } placesService.nearbySearch(request, (results, status) => { console.log("nearbySearch callback status:", status); loadingMapDiv.classList.add('hidden'); clearMarkers(); if (status === google.maps.places.PlacesServiceStatus.OK && results) { console.log(`Found ${results.length} places nearby.`); if (results.length === 0) { alert("附近 50 公尺內找不到地點標記。"); } results.forEach(place => createMarker(place)); } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) { console.log("No places found nearby."); alert("附近 50 公尺內找不到地點標記。"); } else { console.error("Places API search failed:", status); alert("搜尋附近地點時發生錯誤: " + status); } }); }
function createMarker(place) { /* ... keep implementation using addEventListener ... */ if (!place.geometry || !place.geometry.location) return; const marker = new google.maps.Marker({ map: map, position: place.geometry.location, title: place.name }); markers.push(marker); google.maps.event.addListener(marker, "click", () => { const placeId = place.place_id; const placeNameStr = escapeJS(place.name); const placeAddressStr = escapeJS(place.vicinity || ''); const content = ` <div class="infowindow-content"> <strong>${place.name}</strong> <span>${place.vicinity || '無地址資訊'}</span> <button id="infowindow-btn-${placeId}">選擇此店家 (Check-in)</button> </div>`; infoWindow.setContent(content); infoWindow.open(map, marker); google.maps.event.addListenerOnce(infoWindow, 'domready', () => { const button = document.getElementById(`infowindow-btn-${placeId}`); if (button) { button.addEventListener('click', () => { handleSelectPlaceFromMap(placeId, place.name, place.vicinity || ''); }); } else { console.error("Could not find select button in InfoWindow with ID:", `infowindow-btn-${placeId}`); } }); }); }
function clearMarkers() { /* ... keep existing ... */ markers.forEach(marker => marker.setMap(null)); markers = []; }
function escapeJS(str) { /* ... keep existing ... */ return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n') : ''; }

// --- UI Section Toggling ---
function showLoginSection() { /* ... keep existing ... */ loginSection.classList.remove('hidden'); userStatusDiv.classList.add('hidden'); checkinSection.classList.add('hidden'); checkoutSection.classList.add('hidden'); mapDiv.style.display = 'none'; loadingMapDiv.classList.add('hidden'); }
function showUserStatus() { /* ... keep existing ... */ if (userEmail) { userEmailSpan.textContent = `登入身分： ${userEmail}`; userStatusDiv.classList.remove('hidden'); loginSection.classList.add('hidden'); } else { showLoginSection(); } }
function showCheckInSection() { /* ... keep existing ... */ showUserStatus(); checkinSection.classList.remove('hidden'); checkoutSection.classList.add('hidden'); mapDiv.style.display = 'block'; loadingMapDiv.classList.remove('hidden'); clearVisitData(); if (typeof google === 'object' && typeof google.maps === 'object' && !map) { getCurrentLocationAndLoadMap(); } else if (map) { loadingMapDiv.classList.add('hidden'); } }
function showCheckoutSection() { /* ... keep existing, reset new fields ... */ showUserStatus(); checkinSection.classList.add('hidden'); checkoutSection.classList.remove('hidden'); mapDiv.style.display = 'none'; loadingMapDiv.classList.add('hidden'); selectedPlaceDiv.innerHTML = `<strong>${placeName}</strong><br/><span>地址：${placeAddress || 'N/A'}</span>`; document.getElementById('photo-input').value = ''; photoPreview.style.display = 'none'; photoPreview.src = ''; document.getElementById('contact-role').value = ''; revisitNeededSelect.value = '否'; document.getElementById('contact-person').value = ''; document.getElementById('contact-info').value = ''; document.getElementById('notes').value = ''; document.getElementById('brand-status').value = ''; document.getElementById('using-pos').value = '否'; document.getElementById('pos-brand').value = ''; document.getElementById('using-online-ordering').value = '否'; document.getElementById('ordering-brand').value = ''; document.getElementById('using-online-booking').value = '否'; document.getElementById('booking-brand').value = ''; toggleContactDetails(); toggleConditionalVisibility('using-pos', 'pos-brand-section'); toggleConditionalVisibility('using-online-ordering', 'ordering-brand-section'); toggleConditionalVisibility('using-online-booking', 'booking-brand-section'); }

// --- Data Handling ---
function clearVisitData() { /* ... keep existing ... */ visitId = null; placeName = null; placeAddress = null; photoBase64 = ''; photoMimeType = ''; photoFilename = ''; localStorage.removeItem('visitId'); localStorage.removeItem('placeName'); localStorage.removeItem('placeAddress'); }

// --- Auth (Reverted to Implicit Flow) ---
function handleLogin() {
    const redirectUri = window.location.origin + window.location.pathname;
    // Add userinfo scopes needed for People API verification
    const scope = 'openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&hd=${COMPANY_DOMAIN}&prompt=select_account`;
    window.location.href = authUrl;
}
function handleRedirectHash() { /* ... keep existing logic ... */ const hash = window.location.hash.substring(1); if (hash) { const params = new URLSearchParams(hash); const token = params.get('access_token'); const error = params.get('error'); window.location.hash = ''; if (token) { accessToken = token; localStorage.setItem('access_token', accessToken); } else if (error) { console.error('OAuth Error:', error); alert('登入失敗: ' + error); localStorage.removeItem('access_token'); } } }
function handleLogout() { /* ... keep existing ... */ console.log("Logging out..."); accessToken = null; userEmail = null; clearVisitData(); localStorage.removeItem('access_token'); localStorage.removeItem('userEmail'); showLoginSection(); }

// --- API Calls (Uses Access Token) ---
async function handleSelectPlaceFromMap(pId, pName, pAddress) { /* ... keep existing ... */ if (!accessToken) { alert('請先登入'); handleLogin(); return; } if (infoWindow) infoWindow.close(); const controlsLoading = document.createElement('div'); controlsLoading.innerText = '記錄進店資訊...'; checkinSection.appendChild(controlsLoading); try { const response = await fetch(`${API_BASE_URL}/api/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken }, mode: 'cors', body: JSON.stringify({ placeId: pId, placeName: pName, placeAddress: pAddress, placePhone: '' }) }); const result = await response.json(); checkinSection.removeChild(controlsLoading); if (response.ok && result.success && result.visitId) { visitId = result.visitId; placeName = pName; placeAddress = result.formattedAddress || pAddress; /* Use formatted address from backend */ localStorage.setItem('visitId', visitId); localStorage.setItem('placeName', placeName); localStorage.setItem('placeAddress', placeAddress); showCheckoutSection(); } else { throw new Error(result.error || `Check-in API failed (${response.status})`); } } catch (error) { console.error('Check-in failed:', error); checkinSection.removeChild(controlsLoading); alert('記錄進店資訊失敗: ' + error.message); } }
function handlePhotoChange(e) { /* ... keep existing ... */ const file = e.target.files[0]; if (!file) { photoBase64 = ''; photoPreview.style.display = 'none'; return; } photoMimeType = file.type; photoFilename = file.name; const reader = new FileReader(); reader.onload = () => { photoBase64 = reader.result; photoPreview.src = photoBase64; photoPreview.style.display = 'block'; }; reader.onerror = () => { alert('讀取照片失敗'); photoPreview.style.display = 'none'; photoBase64 = ''; }; reader.readAsDataURL(file); }
 async function handleSubmitCheckout() { /* ... keep existing logic ... */ const contactRole = document.getElementById('contact-role').value; const revisitNeeded = revisitNeededSelect.value === '是'; const contactPersonInput = document.getElementById('contact-person'); const contactInfoInput = document.getElementById('contact-info'); const notes = document.getElementById('notes').value; const brandStatus = brandStatusSelect.value; const usingPOS = usingPOSSelect.value === '是'; const posBrand = usingPOS ? document.getElementById('pos-brand').value.trim() : ''; const usingOnlineOrdering = usingOnlineOrderingSelect.value === '是'; const orderingBrand = usingOnlineOrdering ? document.getElementById('ordering-brand').value.trim() : ''; const usingOnlineBooking = usingOnlineBookingSelect.value === '是'; const bookingBrand = usingOnlineBooking ? document.getElementById('booking-brand').value.trim() : ''; let contactPerson = ''; let contactInfo = ''; if (!accessToken) { alert('請先登入'); handleLogin(); return; } if (!contactRole) { alert('請選擇接觸人員角色'); return; } if (!brandStatus) { alert('請選擇品牌狀況'); return; } if (!visitId) { alert('發生錯誤，找不到拜訪 ID'); clearVisitData(); showCheckInSection(); return; } if (revisitNeeded) { contactPerson = contactPersonInput.value.trim(); contactInfo = contactInfoInput.value.trim(); if (!contactPerson || !contactInfo) { alert('預計再訪時，請填寫聯絡人姓名與聯絡電話'); return; } } if (usingPOS && !posBrand) { alert('請填寫 POS 品牌'); return; } if (usingOnlineOrdering && !orderingBrand) { alert('請填寫線上點餐品牌'); return; } if (usingOnlineBooking && !bookingBrand) { alert('請填寫線上訂位品牌'); return; } const controlsLoading = document.createElement('div'); controlsLoading.innerText = '送出拜訪紀錄...'; checkoutSection.appendChild(controlsLoading); try { const response = await fetch(`${API_BASE_URL}/api/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken }, mode: 'cors', body: JSON.stringify({ visitId: visitId, contactRole: contactRole, revisitNeeded: revisitNeeded, contactPerson: contactPerson, contactInfo: contactInfo, notes: notes, photoBase64: photoBase64, photoMimeType: photoMimeType, photoFilename: photoFilename, brandStatus: brandStatus, usingPOS: usingPOS, posBrand: posBrand, usingOnlineOrdering: usingOnlineOrdering, orderingBrand: orderingBrand, usingOnlineBooking: usingOnlineBooking, bookingBrand: bookingBrand }) }); const result = await response.json(); checkoutSection.removeChild(controlsLoading); if (response.ok && result.success) { alert('紀錄已成功送出！'); clearVisitData(); showCheckInSection(); getCurrentLocationAndLoadMap(); } else { throw new Error(result.error || `Check-out API failed (${response.status})`); } } catch (error) { console.error('Check-out failed:', error); checkoutSection.removeChild(controlsLoading); alert('送出紀錄失敗: ' + error.message); } }

// --- UI Logic Functions ---
function toggleConditionalVisibility(selectElementId, targetDivId) { /* ... keep existing ... */ const selectElement = document.getElementById(selectElementId); const targetDiv = document.getElementById(targetDivId); if (selectElement && targetDiv) { if (selectElement.value === '是') { targetDiv.classList.remove('hidden'); } else { targetDiv.classList.add('hidden'); } } }
function toggleContactDetails() { toggleConditionalVisibility('revisit-needed', 'contact-details'); }
function handleBackToMap() { /* ... keep existing ... */ if (confirm("確定要返回地圖嗎？目前填寫的 Check-out 資料將不會儲存。")) { showCheckInSection(); getCurrentLocationAndLoadMap(); } }

// Make map init globally accessible for API callback
window.initMap = initMap;
// Removed global assignment for handleSelectPlaceFromMap as addEventListener is used
