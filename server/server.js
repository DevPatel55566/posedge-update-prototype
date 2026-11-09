import express from "express";
import http from "http";
import path from "path";
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
  let computerName = null;

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.type === "auth") {
      socket.send(JSON.stringify({ type: "auth_ok" }));
      return;
    }

    if (message.type === "agent_state") {
      computerName = message.data.computer;
      agents.set(computerName, message.data);
      sockets.set(computerName, socket);
      return;
    }
  });

  socket.on("close", () => {
    if (computerName) {
        const agent = agents.get(computerName);
        if (agent) { agent.status = "Offline"; agents.set(computerName, agent); }
    }
  });
});

app.get("/api/status", (req, res) => {
  res.json(Array.from(agents.values()));
});

app.post("/api/run-backup", (req, res) => {
  const { computer, folderName } = req.body;
  const socket = sockets.get(computer);
  
  if (socket && socket.readyState === 1) {
    socket.send(JSON.stringify({ type: "run_backup", folderName }));
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Agent is offline" });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dashboard", "index.html")));
server.listen(PORT, () => console.log(`CRM Server running on port ${PORT}`));