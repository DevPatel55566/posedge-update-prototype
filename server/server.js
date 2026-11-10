// import express from "express";
// import http from "http";
// import path from "path";
// import fs from "fs";
// import crypto from "crypto";
// import { exec, execSync } from "child_process"; // Added execSync back
// import { fileURLToPath } from "url";
// import dotenv from "dotenv";
// import { WebSocketServer } from "ws";

// dotenv.config();
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocketServer({ server });
// const PORT = Number(process.env.PORT || 3002);

// // --- 1. CREATE RCLONE.CONF AUTOMATICALLY ---
// const rcloneConfPath = path.join(process.cwd(), 'rclone.conf');
// if (!fs.existsSync(rcloneConfPath)) {
//     const configContent = `[Synology-R]
// type = webdav
// url = https://xtreme.dyndns.org:5006
// vendor = other
// user = xtssupport
// pass = hVQCx8pra3beHh2sjOpB7D2vqsPjdAW2viQYXAM
// no_check_certificate = true`;
//     fs.writeFileSync(rcloneConfPath, configContent);
//     console.log("Created missing rclone.conf on server.");
// }
// // -------------------------------------------

// // --- 2. AUTO-DOWNLOAD RCLONE (This worked perfectly in your last log) ---
// function ensureRcloneExists() {
//     const rclonePath = path.join(process.cwd(), 'rclone');
//     if (!fs.existsSync(rclonePath)) {
//         console.log("Rclone not found. Downloading...");
//         try {
//             execSync('curl -L -o rclone.zip https://downloads.rclone.org/rclone-current-linux-amd64.zip');
//             execSync('unzip -o rclone.zip');
//             execSync('mv rclone-*/rclone .');
//             execSync('chmod +x rclone');
//             execSync('rm -rf rclone-* rclone.zip');
//             console.log("Rclone downloaded and ready.");
//         } catch (err) {
//             console.error("Failed to download rclone:", err.message);
//         }
//     }
// }
// ensureRcloneExists();
// // -------------------------------------------

// const agents = new Map(); 
// const sockets = new Map();

// app.use(express.json());
// app.use(express.static(path.join(__dirname, "..", "dashboard")));

// wss.on("connection", (socket) => {
//   let agentId = null;

//   socket.on("message", (raw) => {
//     const message = JSON.parse(raw.toString());

//     if (message.type === "auth") {
//       socket.send(JSON.stringify({ type: "auth_ok" }));
//       return;
//     }

//     if (message.type === "agent_state") {
//       // Use a safe md5 hash of the IP for the ID
//       agentId = crypto.createHash('md5').update(socket.remoteAddress).digest('hex');
//       message.data.id = agentId;
//       agents.set(agentId, message.data);
//       sockets.set(agentId, socket);
//       return;
//     }
//   });

//   socket.on("close", () => {
//     if (agentId && agents.has(agentId)) {
//         const agent = agents.get(agentId);
//         agent.status = "Offline"; 
//         agents.set(agentId, agent);
//     }
//   });
// });

// app.get("/api/status", (req, res) => {
//   res.json(Array.from(agents.values()));
// });

// app.post("/api/run-backup", (req, res) => {
//   const { agentId, folderName } = req.body;
//   const socket = sockets.get(agentId);
  
//   if (socket && socket.readyState === 1) {
//     socket.send(JSON.stringify({ type: "run_backup", folderName }));
//     res.json({ success: true });
//   } else {
//     res.status(400).json({ error: "Agent is offline" });
//   }
// });

// app.get("/api/nas-folders", (req, res) => {
//     // We use the local path to the downloaded rclone binary here
//     const rclonePath = path.join(process.cwd(), 'rclone');
//     exec(`"${rclonePath}" lsd "Synology-R:XTREME POS DATA" --config "${rcloneConfPath}" --no-check-certificate`, (error, stdout, stderr) => {
//         if (error) {
//             console.error("NAS Error:", error.message);
//             return res.status(500).json({ error: "Failed to read NAS" });
//         }
//         const lines = stdout.split('\n');
//         const folders = [];
//         for (let line of lines) {
//             const match = line.match(/^\s*-1\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+-1\s+(.*)$/);
//             if (match) {
//                 folders.push({ name: match[2].trim(), date: match[1] });
//             }
//         }
//         res.json(folders);
//     });
// });

// app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "dashboard", "index.html")));
// server.listen(PORT, () => console.log(`CRM Server running on port ${PORT}`));

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { exec, execSync } from "child_process";
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

// --- CREATE RCLONE.CONF AUTOMATICALLY ---
const rcloneConfPath = path.join(process.cwd(), 'rclone.conf');
if (!fs.existsSync(rcloneConfPath)) {
    const configContent = `[Synology-R]
type = webdav
url = https://xtreme.dyndns.org:5006
vendor = other
user = xtssupport
pass = hVQCx8pra3beHh2sjOpB7D2vqsPjdAW2viQYXAM
no_check_certificate = true`;
    fs.writeFileSync(rcloneConfPath, configContent);
    console.log("Created missing rclone.conf on server.");
}

// --- AUTO-DOWNLOAD RCLONE ---
function ensureRcloneExists() {
    const rclonePath = path.join(process.cwd(), 'rclone');
    if (!fs.existsSync(rclonePath)) {
        console.log("Rclone not found. Downloading...");
        try {
            execSync('curl -L -o rclone.zip https://downloads.rclone.org/rclone-current-linux-amd64.zip');
            execSync('unzip -o rclone.zip');
            execSync('mv rclone-*/rclone .');
            execSync('chmod +x rclone');
            execSync('rm -rf rclone-* rclone.zip');
            console.log("Rclone downloaded and ready.");
        } catch (err) {
            console.error("Failed to download rclone:", err.message);
        }
    }
}
ensureRcloneExists();

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
      // UNIQUE ID FIX: We use the IP address to create a unique hash. 
      // It DOES NOT use the computer name to identify the machine anymore.
      agentId = crypto.createHash('md5').update(socket.remoteAddress).digest('hex');
      message.data.id = agentId;
      
      // If this is a new connection, save the date. If reconnecting, keep the original date.
      if (agents.has(agentId) && agents.get(agentId).dateStarted) {
          message.data.dateStarted = agents.get(agentId).dateStarted;
      } else {
          message.data.dateStarted = new Date().toISOString();
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

app.get("/api/nas-folders", (req, res) => {
    const rclonePath = path.join(process.cwd(), 'rclone');
    exec(`"${rclonePath}" lsd "Synology-R:XTREME POS DATA" --config "${rcloneConfPath}" --no-check-certificate`, (error, stdout, stderr) => {
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