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
const DRIVE_FOLDER_ID = '1dXsdp2AsBjP5te30Uv8IyFvjkLNWitU9';
// Read Maps API Key from environment variable if available, otherwise use hardcoded (less secure)
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784';

// Determine __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: Service Account Key - Prioritize environment variable
const KEY_JSON_CONTENT = process.env.GOOGLE_CREDENTIALS_JSON;
const KEY_FILE_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'service-account-key.json'); // Fallback

// --- Google API Auth ---
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

async function createGoogleAuthClient() {
  // --- Debugging: Check if googleapis can be resolved ---
  // Removed debug code as it wasn't helpful before import error
  // --- Original Auth Logic ---
  try {
    if (KEY_JSON_CONTENT) {
      // Prioritize using JSON content from environment variable
      console.log("Authenticating using GOOGLE_CREDENTIALS_JSON environment variable.");
      const credentials = JSON.parse(KEY_JSON_CONTENT);
      const auth = new GoogleAuth({ credentials, scopes: SCOPES });
      return await auth.getClient();
    } else {
      // Fallback to using key file path
      console.log(`Authenticating using key file path: ${KEY_FILE_PATH}`);
      const auth = new GoogleAuth({ keyFile: KEY_FILE_PATH, scopes: SCOPES });
      return await auth.getClient();
    }
  } catch (err) {
    console.error("Error creating Google Auth client:", err.message);
    // Log the problematic key content/path if possible, carefully
    if (!KEY_JSON_CONTENT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error(`Key file path used: ${KEY_FILE_PATH}. Does 'service-account-key.json' exist relative to server.js or is GOOGLE_APPLICATION_CREDENTIALS set?`);
    }
    throw new Error("Failed to authenticate with Google APIs. Check service account key setup (environment variable or key file).");
  }
}

// --- Express App Setup ---
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '10mb' })); // For Base64 photo data

 // --- API Endpoints ---

 // Removed /api/getNearbyPlaces as it's now handled by frontend Maps JS API

 // POST Check-in
 // TODO: Implement proper user authentication/identification middleware
//       For now, we'll extract email from the token if provided, otherwise use placeholder
app.post('/api/checkin', async (req, res) => {
  const { placeName, placePhone, placeAddress, placeId } = req.body; // Added placeId
  const authHeader = req.headers.authorization;
  let userEmail = 'unknown@example.com'; // Default

  // Basic token extraction (replace with proper JWT verification if using standard tokens)
  if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      // Here you would typically verify the token and extract user info
      // For Google OAuth token, you might call the tokeninfo endpoint (less secure from backend)
      // Or ideally, use a proper auth library. For now, just log it.
      console.log("Received token (verification not implemented):", token);
      // Placeholder: Decode basic info if it were a JWT - DO NOT use in prod
      // try { userEmail = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).email || userEmail; } catch {}
  }


  if (!placeName || !placeAddress || !placeId) { // Added placeId check
      return res.status(400).json({ error: 'Missing placeId, place name or address' });
  }

  try {
    const auth = await createGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const visitId = Utilities.getUuid(); // Use helper
    const now = new Date();

    const values = [
      [
        visitId,
        userEmail, // Use extracted/default email
        placeName,
        placePhone || '',
        placeAddress,
        now.toISOString(), // Use ISO string for consistency
        '', // Check-out Time
        '', // Duration
        '', // Contact Person
        '', // Contact Info
        '', // Revisit Needed
        '', // Photo Link
        '', // Notes
        placeId // Store Place ID (e.g., in Column N) - Adjust range below if needed
      ]
    ];

    console.log(`Appending check-in for ${placeName} by ${userEmail}`);
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:N`, // Append, assuming Place ID is in Col N
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });

    console.log('Check-in successful');
    res.json({ success: true, visitId: visitId, checkInTime: now.toISOString() });

  } catch (error) {
    console.error('Check-in failed:', error);
    res.status(500).json({ error: 'Check-in failed', details: error.message });
  }
});

// POST Check-out
// TODO: Implement proper user authentication/identification middleware
app.post('/api/checkout', async (req, res) => {
  const { visitId, contactPerson, contactInfo, revisitNeeded, notes, photoBase64, photoMimeType, photoFilename } = req.body;
  const authHeader = req.headers.authorization;
  let userEmail = 'unknown@example.com'; // Default

  if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      console.log("Received token (verification not implemented):", token);
      // Add token verification logic here if needed
  }

  if (!visitId || !contactPerson || !contactInfo) {
    return res.status(400).json({ error: 'Missing visitId, contactPerson, or contactInfo' });
  }

  try {
    const auth = await createGoogleAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
    const now = new Date();

    // 1. Find the row corresponding to visitId
    console.log(`Finding row for visitId: ${visitId}`);
    const rangeData = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:M`, // Read existing columns
    });

    let rowIndex = -1;
    let checkInTime = null;
    if (rangeData.data.values) {
        for (let i = 1; i < rangeData.data.values.length; i++) {
            if (rangeData.data.values[i][0] === visitId) {
                rowIndex = i + 1;
                checkInTime = new Date(rangeData.data.values[i][5]); // Column F (index 5) is Check-in Time
                break;
            }
        }
    }

    if (rowIndex === -1) {
        console.error(`Visit ID ${visitId} not found in sheet.`);
        return res.status(404).json({ error: 'Visit ID not found' });
    }
    console.log(`Found visitId ${visitId} at row ${rowIndex}`);

    // 2. Upload Photo to Drive (if provided)
    let photoUrl = '';
    if (photoBase64 && photoMimeType && photoFilename) {
      console.log(`Uploading photo: ${photoFilename}`);
      try {
        const base64Data = photoBase64.includes(',') ? photoBase64.split(',')[1] : photoBase64;
        const decodedBytes = Buffer.from(base64Data, 'base64');

        const bufferStream = new PassThrough();
        bufferStream.end(decodedBytes);

        const fileMetadata = {
          name: `${visitId}_${photoFilename}`,
          parents: [DRIVE_FOLDER_ID],
        };
        const media = {
          mimeType: photoMimeType,
          body: bufferStream,
        };

        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, webViewLink',
        });

        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone', // Consider 'domain' if needed: domain: 'ichef.com.tw'
            },
        });

        photoUrl = file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`;
        console.log(`Photo uploaded: ${photoUrl}`);
      } catch (driveErr) {
        console.error('Drive upload error:', driveErr);
        photoUrl = 'Upload Error';
      }
    }

    // 3. Calculate Duration
    const durationMin = checkInTime ? Math.round((now - checkInTime) / 60000) : 0;

    // 4. Prepare data for Sheets update
    const valuesToUpdate = [
        { range: `${SHEET_NAME}!G${rowIndex}`, values: [[now.toISOString()]] }, // Col G: Check-out Time
        { range: `${SHEET_NAME}!H${rowIndex}`, values: [[durationMin]] },       // Col H: Duration
        { range: `${SHEET_NAME}!I${rowIndex}`, values: [[contactPerson]] },     // Col I: Contact Person
        { range: `${SHEET_NAME}!J${rowIndex}`, values: [[contactInfo]] },       // Col J: Contact Info
        { range: `${SHEET_NAME}!K${rowIndex}`, values: [[revisitNeeded ? '是' : '否']] }, // Col K: Revisit
        { range: `${SHEET_NAME}!L${rowIndex}`, values: [[photoUrl]] },          // Col L: Photo Link
        { range: `${SHEET_NAME}!M${rowIndex}`, values: [[notes || '']] },       // Col M: Notes
    ];

    console.log(`Updating sheet row ${rowIndex}`);
    const result = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: valuesToUpdate,
        },
    });

    console.log('Check-out successful');
    res.json({ success: true, checkOutTime: now.toISOString(), durationMinutes: durationMin });

  } catch (error) {
    console.error('Check-out failed:', error);
    res.status(500).json({ error: 'Check-out failed', details: error.message });
  }
});


// Basic health check
app.get('/', (req, res) => {
  res.send('Coldvisit Backend (Node.js) is running!');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// --- Helper Functions ---
// Basic UUID generation (replace with a robust library if needed)
const Utilities = {
    getUuid: () => {
        // Basic RFC4122 version 4 compliant UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};
