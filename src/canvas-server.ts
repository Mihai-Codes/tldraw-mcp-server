/**
 * tldraw Canvas Server
 *
 * Express server that hosts the tldraw React app and provides
 * a REST API + WebSocket for real-time canvas synchronization.
 */

import express from "express";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// TODO: REST API endpoints for element CRUD
// TODO: WebSocket server for real-time sync
// TODO: Serve tldraw React frontend

app.listen(PORT, HOST, () => {
  console.log(`tldraw canvas server running at http://${HOST}:${PORT}`);
});
