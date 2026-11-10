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
  let agentId = null;

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.type === "auth") {
      socket.send(JSON.stringify({ type: "auth_ok" }));
      return;
    }

    if (message.type === "agent_state") {
      // Use the agent's unique ID if it sends one, otherwise use the socket's unique connection ID
      agentId = message.data.id || socket.id; 
      message.data.id = agentId;

      // Clean up: If an old offline machine with the same name exists, delete it
      for (const [key, val] of agents.entries()) {
          if (val.computer === message.data.computer && val.status === "Offline" && key !== agentId) {
              agents.delete(key);
              sockets.delete(key);
          }
      }

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

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dashboard", "index.html")));
server.listen(PORT, () => console.log(`CRM Server running on port ${PORT}`));