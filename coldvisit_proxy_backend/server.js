import express from 'express';
import fetch from 'node-fetch'; // Use node-fetch v3+ with ESM
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port or default

// --- Configuration ---
// Ideally, use environment variables for these
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXaR8ec2R-VQPFxqxeorqXV_O733wQccp8KTZ4lZRDEoUrluPuVuU6pwX5gSKnAAHF/exec'; // Standalone Script URL
const FRONTEND_ORIGIN = 'https://coldvisit-checkin.zeabur.app';

// --- Middleware ---

// Enable CORS for the specific frontend origin
app.use(cors({
  origin: FRONTEND_ORIGIN
}));

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 photo data

// --- Routes ---

// Single proxy endpoint for all App Script actions
app.post('/api/proxy', async (req, res) => {
  console.log('Received proxy request for action:', req.body.action); // Log action

  // Extract Authorization header (if present) from incoming request
  const authHeader = req.headers.authorization; // Lowercase 'authorization' is standard

  // Prepare headers for App Script request
  const scriptHeaders = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    scriptHeaders['Authorization'] = authHeader;
  }

  try {
    const scriptResponse = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: scriptHeaders,
      body: JSON.stringify(req.body), // Forward the entire body from frontend
      // redirect: 'follow' // App Script might issue redirects, follow them
    });

    // Forward the status code from App Script
    res.status(scriptResponse.status);

    // Forward the response body (JSON or text) from App Script
    const contentType = scriptResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const scriptJson = await scriptResponse.json();
      console.log('App Script JSON response:', scriptJson);
      res.json(scriptJson);
    } else {
      const scriptText = await scriptResponse.text();
      console.log('App Script Text response:', scriptText);
      res.send(scriptText);
    }

  } catch (error) {
    console.error('Error proxying to App Script:', error);
    res.status(500).json({ error: 'Proxy failed', details: error.message });
  }
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('Coldvisit Proxy Backend is running!');
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Proxy server listening on port ${port}`);
});
