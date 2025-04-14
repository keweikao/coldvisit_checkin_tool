import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { PassThrough } from 'stream'; // Needed for Drive upload
import { Buffer } from 'buffer'; // Needed for Buffer.from

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = 'https://coldvisit-checkin.zeabur.app';
const SPREADSHEET_ID = '1iby3tt6iCBvuWJDt8aBeuJTKUVmrLgJBJljatooMIb0';
const SHEET_NAME = '拜訪紀錄'; // Make sure this matches your sheet name
const DRIVE_FOLDER_ID = '13kgNwlFW4uU-XCRjuFW-UFU5Pbrp1MzT'; // Updated Folder ID
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784';
const EXPECTED_OAUTH_CLIENT_ID = '916934078689-iiqq9op8ee3q810ut8cclhbdg470puf0.apps.googleusercontent.com'; // Add your Client ID for verification

// Determine __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Service Account Key - Prioritize environment variable
const KEY_JSON_CONTENT = process.env.GOOGLE_CREDENTIALS_JSON;
const KEY_FILE_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'service-account-key.json'); // Fallback

// --- Google API Auth (Service Account) ---
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

async function createGoogleAuthClient() {
  try {
    if (KEY_JSON_CONTENT) {
      console.log("Authenticating using GOOGLE_CREDENTIALS_JSON environment variable.");
      const credentials = JSON.parse(KEY_JSON_CONTENT);
      const auth = new GoogleAuth({ credentials, scopes: SCOPES });
      return await auth.getClient();
    } else {
      console.log(`Authenticating using key file path: ${KEY_FILE_PATH}`);
      const auth = new GoogleAuth({ keyFile: KEY_FILE_PATH, scopes: SCOPES });
      return await auth.getClient();
    }
  } catch (err) {
    console.error("Error creating Google Auth client:", err.message);
    if (!KEY_JSON_CONTENT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error(`Key file path used: ${KEY_FILE_PATH}. Does 'service-account-key.json' exist relative to server.js or is GOOGLE_APPLICATION_CREDENTIALS set?`);
    }
    throw new Error("Failed to authenticate with Google APIs. Check service account key setup.");
  }
}

// --- Google OAuth Token Verification ---
async function verifyGoogleOAuthToken(token) {
  if (!token) return null;
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token verification failed (${response.status}): ${errorText}`);
      return null;
    }
    const tokenInfo = await response.json();
    if (tokenInfo.aud !== EXPECTED_OAUTH_CLIENT_ID) {
      console.error(`Token verification failed: Invalid audience. Expected ${EXPECTED_OAUTH_CLIENT_ID}, got ${tokenInfo.aud}`);
       return null;
     }
     // Temporarily commented out issuer check
     // if (!tokenInfo.iss || !tokenInfo.iss.includes('accounts.google.com')) {
     //   console.error('Token verification failed: Invalid issuer.'); return null;
     // }
    if (!tokenInfo.exp) { console.error('Token verification failed: No expiration claim.'); return null; }
    if (tokenInfo.email && tokenInfo.email_verified === 'true') {
        console.log(`Token verified for email: ${tokenInfo.email}`);
        return tokenInfo.email;
    } else { console.error('Token verification failed: Email not verified or missing.'); return null; }
  } catch (error) { console.error('Error verifying Google OAuth token:', error); return null; }
}

// --- Authentication Middleware ---
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    let userEmail = null; let errorMsg = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        console.log("Attempting to verify token...");
        userEmail = await verifyGoogleOAuthToken(token);
        if (!userEmail) { errorMsg = 'Invalid or expired token.'; }
    } else { errorMsg = 'Authorization header missing or invalid.'; }
    if (!userEmail) {
        console.warn(`Authentication failed: ${errorMsg || 'No valid token found.'}`);
        return res.status(401).json({ error: 'Unauthorized', details: errorMsg || 'Valid token required.' });
    }
    req.userEmail = userEmail;
    console.log(`Authentication successful for: ${req.userEmail}`);
    next();
};

// --- Express App Setup ---
const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

// --- API Endpoints ---

// GET Nearby Places (Requires Authentication)
app.post('/api/getNearbyPlaces', authenticateUser, async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) { return res.status(400).json({ error: 'Missing latitude or longitude' }); }
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('YOUR_')) { console.error("Maps API Key missing."); return res.status(500).json({ error: 'Server config error' }); }
  const radius = 500; const type = 'food'; const language = 'zh-TW';
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&language=${language}&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    console.log(`Fetching places for ${lat},${lng} (User: ${req.userEmail})`);
    const placesResponse = await fetch(url);
    const placesData = await placesResponse.json();
    if (!placesResponse.ok) { console.error(`Places API Error (${placesResponse.status}):`, placesData); throw new Error(placesData?.error_message || `Places API failed (${placesResponse.status})`); }
    console.log(`Found ${placesData.results?.length || 0} places`);
    res.json(placesData);
  } catch (error) { console.error('Error fetching nearby places:', error); res.status(500).json({ error: 'Failed to fetch nearby places', details: error.message }); }
});

// POST Check-in (Uses authenticateUser middleware)
app.post('/api/checkin', authenticateUser, async (req, res) => {
  const { placeName, placeAddress, placeId } = req.body; // Phone comes from Details API now
  const userEmail = req.userEmail;

  if (!placeName || !placeAddress || !placeId) { return res.status(400).json({ error: 'Missing placeId, place name or address' }); }

  let fetchedPlacePhone = '';
  try {
    // --- Fetch Place Details (Phone Number) ---
    console.log(`Fetching details for Place ID: ${placeId}`);
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}&language=zh-TW`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();
    if (detailsResponse.ok && detailsData.result && detailsData.result.formatted_phone_number) {
        fetchedPlacePhone = detailsData.result.formatted_phone_number;
        console.log(`Found phone number: ${fetchedPlacePhone}`);
    } else { console.warn(`Could not fetch phone number for ${placeId}. Status: ${detailsData.status}`, detailsData.error_message || ''); }
  } catch (detailsError) { console.error(`Error fetching place details for ${placeId}:`, detailsError); }
  // --- End Fetch Place Details ---

  try {
    const auth = await createGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const visitId = Utilities.getUuid();
    const now = new Date();
    const values = [[
        visitId, userEmail, placeName, fetchedPlacePhone, placeAddress, now.toISOString(),
        '', '', '', '', '', '', '', placeId
    ]];

    console.log(`Appending check-in for ${placeName} by ${userEmail}`);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:O`,
      valueInputOption: 'USER_ENTERED', requestBody: { values: values },
    });

    console.log('Check-in successful');
    res.json({ success: true, visitId: visitId, checkInTime: now.toISOString() });
  } catch (error) {
    console.error('Check-in failed:', error);
    res.status(500).json({ error: 'Check-in failed', details: error.message });
  }
});

// POST Check-out (Uses authenticateUser middleware)
app.post('/api/checkout', authenticateUser, async (req, res) => {
  const { visitId, contactRole, revisitNeeded, notes, photoBase64, photoMimeType, photoFilename } = req.body;
  const contactPerson = revisitNeeded ? req.body.contactPerson : '';
  const contactInfo = revisitNeeded ? req.body.contactInfo : '';
  const userEmail = req.userEmail;

  if (!visitId || !contactRole) { return res.status(400).json({ error: 'Missing visitId or contactRole' }); }
  if (revisitNeeded && (!contactPerson || !contactInfo)) { return res.status(400).json({ error: 'Missing contactPerson or contactInfo when revisit is needed' }); }

  try {
    const auth = await createGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const now = new Date();

    // 1. Find row
    console.log(`Finding row for visitId: ${visitId}`);
    const rangeData = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:O` });
    let rowIndex = -1; let checkInTime = null; let rowOwnerEmail = null;
    if (rangeData.data.values) {
        for (let i = 1; i < rangeData.data.values.length; i++) {
            if (rangeData.data.values[i][0] === visitId) {
                rowIndex = i + 1; rowOwnerEmail = rangeData.data.values[i][1]; checkInTime = new Date(rangeData.data.values[i][5]); break;
            }
        }
    }
    if (rowIndex === -1) { console.error(`Visit ID ${visitId} not found.`); return res.status(404).json({ error: 'Visit ID not found' }); }
    console.log(`Found visitId ${visitId} at row ${rowIndex} owned by ${rowOwnerEmail}`);

    // Security Check
    if (userEmail !== rowOwnerEmail) { console.warn(`User mismatch: ${userEmail} != ${rowOwnerEmail}`); return res.status(403).json({ error: 'Forbidden' }); }

    // 2. Upload Photo
    let photoUrl = '';
    if (photoBase64 && photoMimeType && photoFilename) {
      console.log(`Uploading photo: ${photoFilename}`);
      try {
        const base64Data = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64;
        const decodedBytes = Buffer.from(base64Data, 'base64');
        const bufferStream = new PassThrough(); bufferStream.end(decodedBytes);
        const fileMetadata = { name: `${visitId}_${photoFilename}`, parents: [DRIVE_FOLDER_ID] };
        const media = { mimeType: photoMimeType, body: bufferStream };
        const file = await drive.files.create({ requestBody: fileMetadata, media: media, fields: 'id, webViewLink' });
        await drive.permissions.create({ fileId: file.data.id, requestBody: { role: 'reader', type: 'anyone' } });
        photoUrl = file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`;
        console.log(`Photo uploaded: ${photoUrl}`);
      } catch (driveErr) {
          console.error('Drive upload error:', driveErr.message);
          if (driveErr.message.includes('File not found') || driveErr.message.includes('notFound')) { console.error(`Potential issue: Drive Folder ID "${DRIVE_FOLDER_ID}" might be incorrect or service account lacks Editor permission.`); }
          else if (driveErr.message.includes('permission')) { console.error(`Potential issue: Service account might lack Editor permission on Drive Folder ID "${DRIVE_FOLDER_ID}".`); }
          photoUrl = 'Upload Error';
      }
    }

    // 3. Calculate Duration
    const durationMin = checkInTime ? Math.round((now - checkInTime) / 60000) : 0;

    // 4. Update Sheet (Columns: G=Out, H=Dur, I=Person, J=Info, K=Revisit, L=Role, M=Photo, N=Notes)
    const valuesToUpdate = [
        { range: `${SHEET_NAME}!G${rowIndex}`, values: [[now.toISOString()]] }, { range: `${SHEET_NAME}!H${rowIndex}`, values: [[durationMin]] },
        { range: `${SHEET_NAME}!I${rowIndex}`, values: [[contactPerson]] }, { range: `${SHEET_NAME}!J${rowIndex}`, values: [[contactInfo]] },
        { range: `${SHEET_NAME}!K${rowIndex}`, values: [[revisitNeeded ? '是' : '否']] }, { range: `${SHEET_NAME}!L${rowIndex}`, values: [[contactRole]] },
        { range: `${SHEET_NAME}!M${rowIndex}`, values: [[photoUrl]] }, { range: `${SHEET_NAME}!N${rowIndex}`, values: [[notes || '']] },
    ];
    console.log(`Updating sheet row ${rowIndex}`);
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: 'USER_ENTERED', data: valuesToUpdate } });

    console.log('Check-out successful');
    res.json({ success: true, checkOutTime: now.toISOString(), durationMinutes: durationMin });
  } catch (error) {
    console.error('Check-out failed:', error);
    res.status(500).json({ error: 'Check-out failed', details: error.message });
  }
});

// Basic health check
app.get('/', (req, res) => { res.send('Coldvisit Backend (Node.js) is running!'); });

// --- Start Server ---
app.listen(PORT, () => { console.log(`Server listening on port ${PORT}`); });

// --- Helper Functions ---
const Utilities = { getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }) };
