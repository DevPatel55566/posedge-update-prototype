import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import fs from "fs";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT || 3002);
const AGENT_TOKEN = process.env.AGENT_TOKEN || "change-this-token";

const state = {
  agentOnline: false, computer: null, status: "Offline", client: null, address: null, 
  licenseDetected: false, licenseFile: null, currentOperation: "Idle", 
  latestRelease: null, downloadedInstaller: null, error: null, lastSeen: null, 
  lastBackup: null, nextBackup: null
};

// NEW: Store history events in memory
let historyLog = [];

let agentSocket = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "dashboard")));

function sendToAgent(message) {
  if (!agentSocket || agentSocket.readyState !== 1) return false;
  agentSocket.send(JSON.stringify(message));
  return true;
}

wss.on("connection", (socket) => {
  let authenticated = false;
  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      
      if (message.type === "auth") {
        if (message.token !== AGENT_TOKEN) { socket.close(); return; }
        authenticated = true;
        agentSocket = socket;
        state.agentOnline = true;
        state.status = "Ready";
        state.lastSeen = new Date().toISOString();
        socket.send(JSON.stringify({ type: "auth_ok" }));
        console.log("Agent authenticated");
        return;
      }

      if (!authenticated) { socket.close(); return; }

      if (message.type === "agent_state") {
        Object.assign(state, message.data || {});
        state.agentOnline = true;
        state.lastSeen = new Date().toISOString();
        return;
      }

      if (message.type === "log") {
        console.log(`[AGENT] ${message.message || ""}`);
      }

      // NEW: Receive history logs from the agent
      if (message.type === "log_history") {
        historyLog.unshift({ ...message.data, id: Date.now() }); // Add to top
        if (historyLog.length > 100) historyLog.pop(); // Keep only last 100 to save memory
      }

    } catch (error) { console.error("Invalid WebSocket message:", error.message); }
  });

  socket.on("close", () => {
    if (agentSocket === socket) {
      agentSocket = null;
      state.agentOnline = false;
      state.status = "Offline";
    }
    console.log("Agent disconnected");
  });
});

app.get("/api/status", (req, res) => res.json(state));

// NEW: Endpoint to fetch history
app.get("/api/history", (req, res) => {
  res.json(historyLog);
});

app.get("/api/download-agent", (req, res) => {
  const zipPath = path.join(__dirname, "agent.zip");
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, "agent.zip");
  } else {
    res.status(404).send("Agent ZIP not found on server.");
  }
});


app.post("/api/check-update", (req, res) => {
  if (!sendToAgent({ type: "check_latest_release" })) return res.status(503).json({ success: false, error: "Agent is offline" });
  res.json({ success: true });
});

app.post("/api/download-update", (req, res) => {
  if (!sendToAgent({ type: "download_latest_release" })) return res.status(503).json({ success: false, error: "Agent is offline" });
  res.json({ success: true });
});

app.post("/api/install-update", (req, res) => {
  if (!sendToAgent({ type: "install_latest_release" })) return res.status(503).json({ success: false, error: "Agent is offline" });
  res.json({ success: true });
});

app.post("/api/run-backup", (req, res) => {
  const customFolderName = req.body.folderName || null;
  if (!sendToAgent({ type: "run_backup", folderName: customFolderName })) return res.status(503).json({ success: false, error: "Agent is offline" });
  res.json({ success: true });
});

app.post("/api/auto-update", (req, res) => {
  if (!sendToAgent({ type: "auto_update" })) return res.status(503).json({ success: false, error: "Agent is offline" });
  res.json({ success: true });
});

app.get("/api/install.bat", (req, res) => {
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="Install-PosEdge.bat"');

  // Fixed: Using Join-Path to avoid quote-stripping issues
  const psCommand = `
$ErrorActionPreference = 'Stop';
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
$url = 'https://posedge-update-prototype.onrender.com/api/download-agent';
$zip = Join-Path $env:TEMP 'agent.zip';
$dest = 'C:\\PosEdgeAgent';
Write-Host 'Downloading Agent...' -ForegroundColor Cyan;
curl.exe -L -o "$zip" "$url";
Write-Host 'Extracting Files...' -ForegroundColor Cyan;
Expand-Archive -Path $zip -DestinationPath $dest -Force;
$setupFile = Get-ChildItem -Path $dest -Filter 'setup.ps1' -Recurse | Select-Object -First 1;
if ($setupFile) {
    Set-Location $setupFile.DirectoryName;
    Write-Host 'Running Setup...' -ForegroundColor Cyan;
    powershell -ExecutionPolicy Bypass -File setup.ps1
} else {
    Write-Host 'ERROR: setup.ps1 not found!' -ForegroundColor Red
}
`.replace(/\n/g, ' '); // Flatten to a single line

  const batContent = `@echo off
title PosEdge Agent Installer
echo ========================================================
echo Installing PosEdge Agent. Please do not close this window.
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"
echo.
echo Installation Complete! You can close this window now.
pause`;

  res.send(batContent);
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dashboard", "index.html")));

server.listen(PORT, () => console.log(`PosEdge Update Manager server running at http://localhost:${PORT}`));