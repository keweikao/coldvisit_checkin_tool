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
            if (!response.ok) { throw new Error(`Failed to fetch email (${response.status})`); } // Throw error on non-2xx status
            const data = await response.json();
            if (data.email) {
                userEmail = data.email;
                localStorage.setItem('userEmail', userEmail);
                console.log("initializeApp - User email fetched:", userEmail);
                showUserStatus();
            } else {
                throw new Error('Backend did not return email');
            }
        } catch (error) {
            console.error("initializeApp - Failed to fetch user email:", error);
            // Check if it's likely an auth error (401)
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                 alert("您的登入已過期或無效，請重新登入。(Init)");
            } else {
                 alert("無法驗證您的登入狀態，請重新登入。");
            }
            handleLogout(); // Logout regardless of specific error during init email fetch
            return;
        }
    } else if (userEmail) {
        showUserStatus();
    } else {
        // No token and no stored email, force logout/login
        handleLogout();
        return;
    }

    // Proceed if email is confirmed
    visitId = localStorage.getItem('visitId');
    placeName = localStorage.getItem('placeName');
    placeAddress = localStorage.getItem('placeAddress');
    if (visitId && placeName) {
        console.log("initializeApp - Visit in progress, showing checkout.");
        showCheckoutSection();
    } else {
        console.log("initializeApp - No visit in progress, showing checkin.");
        showCheckInSection();
        // Ensure map loads if needed
        if (typeof google === 'object' && typeof google.maps === 'object' && !map) {
            console.log("initializeApp - Manually triggering map load sequence.");
            initMap(); // Call initMap which calls getCurrentLocationAndLoadMap if appropriate
        } else if (map) {
            getCurrentLocationAndLoadMap(); // Refresh map if already initialized
        } else {
            console.log("initializeApp - Google Maps API not ready yet.");
            // initMap will be called by the API callback later
        }
    }
 }

// --- Map Initialization (Called by Google Maps API) ---
function initMap() {
    console.log("Maps API loaded, calling initMap...");
    accessToken = localStorage.getItem('access_token'); // Re-check token just in case
    if (accessToken && !checkinSection.classList.contains('hidden')) {
        // Only load map if user is logged in AND on the check-in screen
        getCurrentLocationAndLoadMap();
    } else {
        console.log("initMap - Skipping map load (not authenticated or not on checkin screen).");
        loadingMapDiv.classList.add('hidden'); // Hide loading indicator
        if (!accessToken) {
            showLoginSection(); // Ensure login is shown if not authenticated
        }
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
                    lng: position.coords.longitude
                };
                console.log("User location:", userLocation);
                loadingMapDiv.innerText = '載入地圖與附近店家...';

                if (!map) { // Create map only if it doesn't exist
                    createMap(userLocation);
                } else { // Otherwise, just center it
                    map.setCenter(userLocation);
                }
                searchNearbyPlaces(userLocation); // Search nearby after map is ready/centered
            },
            (error) => {
                console.error("Geolocation error:", error);
                loadingMapDiv.innerText = '無法取得位置，請允許權限。';
                alert(`無法取得位置: ${error.message}`);
                // Optionally hide map or show a message
            },
            { enableHighAccuracy: true } // Request high accuracy
        );
    } else {
        loadingMapDiv.innerText = '瀏覽器不支援定位功能。';
        alert('瀏覽器不支援定位功能。');
        // Optionally hide map or show a message
    }
}

function createMap(location) {
    console.log("Creating map centered at:", location);
    map = new google.maps.Map(mapDiv, {
        center: location,
        zoom: 17, // Zoom level
        mapTypeControl: false, // Hide map type control (Satellite/Map)
        streetViewControl: false // Hide Street View Pegman
    });

    // Add a marker for the user's current location
    new google.maps.Marker({
        position: location,
        map: map,
        title: "我的位置",
        icon: { // Custom icon (blue circle)
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff"
        }
    });

    infoWindow = new google.maps.InfoWindow(); // Initialize InfoWindow

    // Ensure PlacesService is available before creating it
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
    const request = {
        location: location,
        radius: '50', // Search within 50 meters
        // Using specific types relevant to potential clients (adjust as needed)
        // types: ['restaurant', 'cafe', 'bar', 'bakery', 'food']
        // Omitting 'types' might yield broader results if needed
    };
    console.log("Attempting nearbySearch with request:", request);

    if (!placesService) {
        console.error("placesService not initialized!");
        alert("地點搜尋服務未就緒。");
        loadingMapDiv.classList.add('hidden'); // Hide loading indicator
        return;
    }

    placesService.nearbySearch(request, (results, status) => {
        console.log("nearbySearch callback status:", status);
        loadingMapDiv.classList.add('hidden'); // Hide loading indicator once search completes
        clearMarkers(); // Clear previous markers

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            console.log(`Found ${results.length} places nearby.`);
            if (results.length === 0) {
                alert("附近 50 公尺內找不到地點標記。");
            }
            results.forEach(place => createMarker(place));
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
    if (!place.geometry || !place.geometry.location) return; // Skip if no location data

    const marker = new google.maps.Marker({
        map: map,
        position: place.geometry.location,
        title: place.name // Tooltip on hover
    });
    markers.push(marker); // Keep track of markers to clear them later

    // Use addListener for click events
    google.maps.event.addListener(marker, "click", () => {
        const placeId = place.place_id;
        const placeNameStr = escapeJS(place.name); // Escape name for use in JS/HTML
        const placeAddressStr = escapeJS(place.vicinity || ''); // Use vicinity as address, escape it

        // InfoWindow content with a button
        const content = `
            <div class="infowindow-content">
                <strong>${place.name}</strong><br>
                <span>${place.vicinity || '無地址資訊'}</span><br>
                <button id="infowindow-btn-${placeId}">選擇此店家 (Check-in)</button>
            </div>`;

        infoWindow.setContent(content);
        infoWindow.open(map, marker);

        // Add listener *after* the InfoWindow is ready (domready)
        google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
            const button = document.getElementById(`infowindow-btn-${placeId}`);
            if (button) {
                // Use addEventListener for the button click
                button.addEventListener('click', () => {
                    handleSelectPlaceFromMap(placeId, place.name, place.vicinity || '');
                });
            } else {
                console.error("Could not find select button in InfoWindow with ID:", `infowindow-btn-${placeId}`);
            }
        });
    });
}

function clearMarkers() {
    markers.forEach(marker => marker.setMap(null)); // Remove markers from map
    markers = []; // Clear the array
}

// Helper to escape strings for safe use in JS/HTML attributes
function escapeJS(str) {
    return str ? str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n') : '';
}


// --- UI Section Toggling ---
function showLoginSection() {
    loginSection.classList.remove('hidden');
    userStatusDiv.classList.add('hidden');
    checkinSection.classList.add('hidden');
    checkoutSection.classList.add('hidden');
    mapDiv.style.display = 'none'; // Hide map
    loadingMapDiv.classList.add('hidden'); // Hide loading indicator
}

function showUserStatus() {
    if (userEmail) {
        userEmailSpan.textContent = `登入身分： ${userEmail}`;
        userStatusDiv.classList.remove('hidden');
        loginSection.classList.add('hidden'); // Hide login section
    } else {
        // If somehow userEmail is missing, show login
        showLoginSection();
    }
}

function showCheckInSection() {
    showUserStatus(); // Ensure user status is visible
    checkinSection.classList.remove('hidden');
    checkoutSection.classList.add('hidden');
    mapDiv.style.display = 'block'; // Show map container
    loadingMapDiv.classList.remove('hidden'); // Show loading indicator initially
    clearVisitData(); // Clear any previous visit details

    // If map API is ready but map not created, or needs refresh
    if (typeof google === 'object' && typeof google.maps === 'object') {
        getCurrentLocationAndLoadMap(); // Get location and load/refresh map
    } else {
        // Map API not ready yet, initMap will handle it later
        console.log("showCheckInSection - Google Maps API not ready yet.");
    }
}

function showCheckoutSection() {
    showUserStatus(); // Ensure user status is visible
    checkinSection.classList.add('hidden');
    checkoutSection.classList.remove('hidden');
    mapDiv.style.display = 'none'; // Hide map
    loadingMapDiv.classList.add('hidden'); // Hide loading indicator

    // Display selected place
    selectedPlaceDiv.innerHTML = `<strong>${placeName}</strong><br/><span>地址：${placeAddress || 'N/A'}</span>`;

    // Reset form fields
    document.getElementById('photo-input').value = ''; // Clear file input
    photoPreview.style.display = 'none'; // Hide preview
    photoPreview.src = ''; // Clear preview source
    document.getElementById('contact-role').value = '';
    revisitNeededSelect.value = '否';
    document.getElementById('contact-person').value = '';
    document.getElementById('contact-info').value = '';
    document.getElementById('notes').value = '';
    // Reset new fields
    brandStatusSelect.value = '';
    usingPOSSelect.value = '否';
    document.getElementById('pos-brand').value = '';
    usingOnlineOrderingSelect.value = '否';
    document.getElementById('ordering-brand').value = '';
    usingOnlineBookingSelect.value = '否';
    document.getElementById('booking-brand').value = '';

    // Ensure conditional fields visibility is correct based on defaults
    toggleContactDetails();
    toggleConditionalVisibility('using-pos', 'pos-brand-section');
    toggleConditionalVisibility('using-online-ordering', 'ordering-brand-section');
    toggleConditionalVisibility('using-online-booking', 'booking-brand-section');
}


// --- Data Handling ---
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
    console.log("Cleared visit data from variables and localStorage.");
}


// --- Auth (Implicit Flow) ---
function handleLogin() {
    const redirectUri = window.location.origin + window.location.pathname;
    // Scopes required: openid, email, profile are standard.
    // userinfo scopes are often needed for backend verification via People API/UserInfo endpoint.
    const scope = 'openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&hd=${COMPANY_DOMAIN}&prompt=select_account`;
    console.log("Redirecting to Google for login...");
    window.location.href = authUrl;
}

function handleRedirectHash() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const error = params.get('error');

        // Clear the hash from the URL immediately
        window.location.hash = '';

        if (token) {
            console.log("OAuth token received in hash.");
            accessToken = token;
            localStorage.setItem('access_token', accessToken);
            // Don't call initializeApp here directly, let window.onload handle it
            // to ensure DOM is fully loaded.
        } else if (error) {
            console.error('OAuth Error:', error);
            alert('登入失敗: ' + error);
            localStorage.removeItem('access_token'); // Clear potentially bad token
        }
    }
}

function handleLogout() {
    console.log("Logging out...");
    accessToken = null;
    userEmail = null;
    clearVisitData(); // Clear visit details on logout
    localStorage.removeItem('access_token');
    localStorage.removeItem('userEmail');
    // Optionally revoke token on Google's side (more complex, usually not needed for implicit flow logout)
    // const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${accessToken}`;
    // fetch(revokeUrl, { method: 'POST', mode: 'no-cors' }); // Fire and forget
    showLoginSection(); // Show login screen
}


// --- API Calls (Uses Access Token) ---
async function handleSelectPlaceFromMap(pId, pName, pAddress) {
    if (!accessToken) {
        alert('請先登入');
        handleLogin();
        return;
    }
    if (infoWindow) infoWindow.close(); // Close the map InfoWindow

    // Show loading indicator on check-in section
    const controlsLoading = document.createElement('div');
    controlsLoading.innerText = '記錄進店資訊...';
    controlsLoading.id = 'checkin-loading'; // Add an ID for easier removal
    checkinSection.appendChild(controlsLoading);

    try {
        const response = await fetch(`${API_BASE_URL}/api/checkin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken // Send token
            },
            mode: 'cors', // Enable CORS
            body: JSON.stringify({
                placeId: pId,
                placeName: pName,
                placeAddress: pAddress, // Send original vicinity address
                placePhone: '' // Phone will be fetched by backend
            })
        });

        const result = await response.json(); // Always try to parse JSON response
        checkinSection.removeChild(controlsLoading); // Remove loading indicator

        if (response.ok && result.success && result.visitId) {
            // Success
            visitId = result.visitId;
            placeName = pName;
            placeAddress = result.formattedAddress || pAddress; // Use formatted address from backend if available
            localStorage.setItem('visitId', visitId);
            localStorage.setItem('placeName', placeName);
            localStorage.setItem('placeAddress', placeAddress);
            console.log(`Check-in successful for ${placeName}, visitId: ${visitId}`);
            showCheckoutSection(); // Move to checkout screen
        } else {
            // Handle backend error or non-ok response
            throw new Error(result.error || `Check-in API failed (${response.status})`);
        }
    } catch (error) {
        console.error('Check-in failed:', error);
        // Remove loading indicator if it still exists (e.g., network error)
        const loadingIndicator = document.getElementById('checkin-loading');
        if (loadingIndicator && loadingIndicator.parentNode === checkinSection) {
            checkinSection.removeChild(loadingIndicator);
        }
        // **MODIFIED:** Check if the error message indicates a 401 Unauthorized status
        if (error instanceof Error && (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized'))) {
             alert('您的登入已過期或無效，請重新登入。(Check-in)');
             handleLogout(); // Clear token and show login
        } else {
            // Other types of errors
            alert('記錄進店資訊失敗: ' + error.message);
        }
    }
}

function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) {
        photoBase64 = '';
        photoMimeType = '';
        photoFilename = '';
        photoPreview.style.display = 'none'; // Hide preview
        return;
    }

    // Basic validation (optional: add size limit)
    if (!file.type.startsWith('image/')) {
        alert('請選擇圖片檔案');
        e.target.value = ''; // Clear the input
        return;
    }

    photoMimeType = file.type;
    photoFilename = file.name;

    const reader = new FileReader();
    reader.onload = () => {
        photoBase64 = reader.result; // Contains data:image/jpeg;base64,...
        photoPreview.src = photoBase64;
        photoPreview.style.display = 'block'; // Show preview
    };
    reader.onerror = () => {
        alert('讀取照片失敗');
        photoPreview.style.display = 'none';
        photoBase64 = '';
        photoMimeType = '';
        photoFilename = '';
    };
    reader.readAsDataURL(file); // Read file as Base64
}

async function handleSubmitCheckout() {
    // --- Get Form Values ---
    const contactRole = document.getElementById('contact-role').value;
    const revisitNeeded = revisitNeededSelect.value === '是';
    const contactPersonInput = document.getElementById('contact-person');
    const contactInfoInput = document.getElementById('contact-info');
    const notes = document.getElementById('notes').value.trim();
    const brandStatus = brandStatusSelect.value;
    const usingPOS = usingPOSSelect.value === '是';
    const posBrand = usingPOS ? document.getElementById('pos-brand').value.trim() : '';
    const usingOnlineOrdering = usingOnlineOrderingSelect.value === '是';
    const orderingBrand = usingOnlineOrdering ? document.getElementById('ordering-brand').value.trim() : '';
    const usingOnlineBooking = usingOnlineBookingSelect.value === '是';
    const bookingBrand = usingOnlineBooking ? document.getElementById('booking-brand').value.trim() : '';
    let contactPerson = '';
    let contactInfo = '';

    // --- Basic Validations ---
    if (!accessToken) { alert('請先登入'); handleLogin(); return; }
    if (!contactRole) { alert('請選擇接觸人員角色'); return; }
    if (!brandStatus) { alert('請選擇品牌狀況'); return; }
    if (!visitId) { alert('發生錯誤，找不到拜訪 ID，請返回地圖重新 Check-in'); clearVisitData(); showCheckInSection(); return; }

    // Conditional validations
    if (revisitNeeded) {
        contactPerson = contactPersonInput.value.trim();
        contactInfo = contactInfoInput.value.trim();
        if (!contactPerson || !contactInfo) {
            alert('預計再訪時，請填寫聯絡人姓名與聯絡電話');
            return;
        }
    }
    if (usingPOS && !posBrand) { alert('請填寫 POS 品牌'); return; }
    if (usingOnlineOrdering && !orderingBrand) { alert('請填寫線上點餐品牌'); return; }
    if (usingOnlineBooking && !bookingBrand) { alert('請填寫線上訂位品牌'); return; }

    // --- Show Loading Indicator ---
    const controlsLoading = document.createElement('div');
    controlsLoading.innerText = '送出拜訪紀錄...';
    controlsLoading.id = 'checkout-loading'; // Add ID
    checkoutSection.appendChild(controlsLoading);

    // --- Prepare Payload ---
    const payload = {
        visitId: visitId,
        contactRole: contactRole,
        revisitNeeded: revisitNeeded,
        contactPerson: contactPerson,
        contactInfo: contactInfo,
        notes: notes,
        photoBase64: photoBase64, // Send full Data URL (backend can parse)
        photoMimeType: photoMimeType,
        photoFilename: photoFilename,
        brandStatus: brandStatus,
        usingPOS: usingPOS,
        posBrand: posBrand,
        usingOnlineOrdering: usingOnlineOrdering,
        orderingBrand: orderingBrand,
        usingOnlineBooking: usingOnlineBooking,
        bookingBrand: bookingBrand
    };

    // --- API Call ---
    try {
        const response = await fetch(`${API_BASE_URL}/api/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            },
            mode: 'cors',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        checkoutSection.removeChild(controlsLoading); // Remove loading

        if (response.ok && result.success) {
            alert('紀錄已成功送出！');
            clearVisitData(); // Clear current visit
            showCheckInSection(); // Go back to map/check-in view
            // Optionally refresh map location/places after successful checkout
            // getCurrentLocationAndLoadMap();
        } else {
            throw new Error(result.error || `Check-out API failed (${response.status})`);
        }
    } catch (error) {
        console.error('Check-out failed:', error);
        // Remove loading indicator if it still exists
        const loadingIndicator = document.getElementById('checkout-loading');
        if (loadingIndicator && loadingIndicator.parentNode === checkoutSection) {
            checkoutSection.removeChild(loadingIndicator);
        }
        // **MODIFIED:** Check if the error message indicates a 401 Unauthorized status
        if (error instanceof Error && (error.message.includes('401') || error.message.toLowerCase().includes('unauthorized'))) {
             alert('您的登入已過期或無效，請重新登入。(Check-out)');
             handleLogout(); // Clear token and show login
        } else {
            // Other types of errors
            alert('送出紀錄失敗: ' + error.message);
        }
    }
}


// --- UI Logic Functions ---
function toggleConditionalVisibility(selectElementId, targetDivId) {
    const selectElement = document.getElementById(selectElementId);
    const targetDiv = document.getElementById(targetDivId);
    if (selectElement && targetDiv) {
        // Show if '是' (Yes) is selected, hide otherwise
        if (selectElement.value === '是') {
            targetDiv.classList.remove('hidden');
        } else {
            targetDiv.classList.add('hidden');
            // Optional: Clear input fields within the hidden div
            // targetDiv.querySelectorAll('input, textarea').forEach(input => input.value = '');
        }
    }
}

// Specific toggle for contact details based on revisit needed
function toggleContactDetails() {
    toggleConditionalVisibility('revisit-needed', 'contact-details');
}

function handleBackToMap() {
    if (confirm("確定要返回地圖嗎？目前填寫的 Check-out 資料將不會儲存。")) {
        // Don't clear visitId/placeName from localStorage here,
        // just switch the view. If they check in again, it will be cleared.
        showCheckInSection();
        // Optionally refresh map
        // getCurrentLocationAndLoadMap();
    }
}

// Make map init globally accessible for API callback
window.initMap = initMap;
