import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = Number(process.env.PORT || 3002);

const agents = new Map(); 
const sockets = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "dashboard")));

wss.on("connection", (socket) => {
  let agentId = null;

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.type === "auth") {
      socket.send(JSON.stringify({ type: "auth_ok" }));
      return;
    }

    if (message.type === "agent_state") {
      // FIXED: Use the socket's IP address as the unique ID so identical PC names don't overwrite each other
      agentId = socket.remoteAddress; 
      message.data.id = agentId;

      agents.set(agentId, message.data);
      sockets.set(agentId, socket);
      return;
    }
  });

  socket.on("close", () => {
    if (agentId && agents.has(agentId)) {
        const agent = agents.get(agentId);
        agent.status = "Offline"; 
        agents.set(agentId, agent);
    }
  });
});

app.get("/api/status", (req, res) => {
  res.json(Array.from(agents.values()));
});

app.post("/api/run-backup", (req, res) => {
  const { agentId, folderName } = req.body;
  const socket = sockets.get(agentId);
  
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify({ type: "run_backup", folderName }));
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Agent is offline" });
  }
});

// NEW: Endpoint to read the NAS folders directly from Render
app.get("/api/nas-folders", (req, res) => {
    exec('./rclone lsd "Synology-R:XTREME POS DATA" --config "./rclone.conf" --no-check-certificate', (error, stdout, stderr) => {
        if (error) {
            console.error("NAS Error:", error.message);
            return res.status(500).json({ error: "Failed to read NAS" });
        }
        const lines = stdout.split('\n');
        const folders = [];
        for (let line of lines) {
            const match = line.match(/^\s*-1\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+-1\s+(.*)$/);
            if (match) {
                folders.push({ name: match[2].trim(), date: match[1] });
            }
        }
        res.json(folders);
    });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dashboard", "index.html")));
server.listen(PORT, () => console.log(`CRM Server running on port ${PORT}`));