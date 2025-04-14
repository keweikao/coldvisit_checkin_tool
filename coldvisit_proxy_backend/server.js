import express from 'express';
import fetch from 'node-fetch'; // Keep for Places API call (or remove if faking that too)
import cors from 'cors';
// Removed googleapis, GoogleAuth, path, fileURLToPath, PassThrough, Buffer

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = 'https://coldvisit-checkin.zeabur.app';
// Removed SPREADSHEET_ID, SHEET_NAME, DRIVE_FOLDER_ID
// Keep Maps API Key for direct call test, or remove if faking data
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyCwkcLZVbWHD_qPTJC5NfVDiiNSfcCH784';

// --- Express App Setup ---
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json()); // Keep JSON parsing

// --- API Endpoints ---

// GET Nearby Places (Return Dummy Data)
app.post('/api/getNearbyPlaces', async (req, res) => {
  console.log('Received request for /api/getNearbyPlaces (simplified)');
  // Simulate successful response with dummy data
  res.json({
    results: [
      { place_id: 'dummy_id_1', name: '測試餐廳 A (假資料)', vicinity: '測試地址 A', rating: 4.5, user_ratings_total: 100 },
      { place_id: 'dummy_id_2', name: '測試餐廳 B (假資料)', vicinity: '測試地址 B', rating: 4.0, user_ratings_total: 50 },
    ],
    status: 'OK'
  });
});

// POST Check-in (Return Dummy Success)
app.post('/api/checkin', async (req, res) => {
  const { placeName } = req.body;
  console.log(`Received request for /api/checkin for ${placeName} (simplified)`);
  const dummyVisitId = 'fake-' + Date.now(); // Generate a fake ID
  // Simulate successful check-in without Sheets interaction
  res.json({ success: true, visitId: dummyVisitId, checkInTime: new Date().toISOString() });
});

// POST Check-out (Return Dummy Success)
app.post('/api/checkout', async (req, res) => {
  const { visitId } = req.body;
  console.log(`Received request for /api/checkout for ${visitId} (simplified)`);
  // Simulate successful check-out without Sheets/Drive interaction
  res.json({ success: true, checkOutTime: new Date().toISOString(), durationMinutes: 15 }); // Dummy duration
});


// Basic health check
app.get('/', (req, res) => {
  res.send('Coldvisit Backend (Node.js) - Simplified Test Version');
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Simplified server listening on port ${PORT}`);
});

// Removed Utilities.getUuid as it's not strictly needed for this test
