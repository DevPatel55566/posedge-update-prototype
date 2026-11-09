import fs from "fs";
import path from "path";
import os from "os";
import WebSocket from "ws";
import { performBackup } from "./backupEngine.js";

const CONFIG_PATH = path.join(process.cwd(), "config.json");
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const computerName = os.hostname();

const folderNameFile = path.join(process.cwd(), "folderName.txt");
const stateFile = path.join(process.cwd(), "backup_state.json");

let socket = null;
let backupTimer = null;
let pingInterval = null;

let savedState = { lastBackup: null };
if (fs.existsSync(stateFile)) {
    try { savedState = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch (e) {}
}

let state = {
    computer: computerName,
    folderName: "",
    status: "Connecting",
    lastBackup: savedState.lastBackup,
    nextBackup: null,
    currentOperation: "Idle",
    error: null
};

// Load saved folder name if it exists, otherwise leave it blank
if (fs.existsSync(folderNameFile)) {
    state.folderName = fs.readFileSync(folderNameFile, "utf8").trim();
}

function send(message) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
    send({ type: "log", message: msg });
}

async function triggerBackup() {
    // STRICT CHECK: If no name, do absolutely nothing.
    if (!state.folderName) {
        log("Backup skipped: No folder name set. Please type one in the dashboard.");
        state.error = "No folder name set.";
        send({ type: "agent_state", data: state });
        return;
    }

    state.currentOperation = "Running Backup";
    state.error = null;
    send({ type: "agent_state", data: state });
    log(`Starting backup for ${state.folderName}...`);

    try {
        const backupResult = await performBackup(config.dataPath, config.backupPath, state.folderName);
        
        state.currentOperation = "Idle";
        state.lastBackup = new Date().toISOString();
        savedState.lastBackup = state.lastBackup;
        fs.writeFileSync(stateFile, JSON.stringify(savedState));
        
        log(`Backup successful!`);
    } catch (error) {
        state.currentOperation = "Idle";
        state.error = error.message;
        log(`Backup failed: ${error.message}`);
    }
    
    scheduleNextBackup();
    send({ type: "agent_state", data: state });
}

function scheduleNextBackup() {
    if (backupTimer) clearTimeout(backupTimer);
    
    // Safety check: Never schedule if there's no name
    if (!state.folderName) return;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const lastEventTime = state.lastBackup ? new Date(state.lastBackup).getTime() : now;
    let nextTime = lastEventTime + TWENTY_FOUR_HOURS;
    
    if (nextTime < now) {
        nextTime = now + (60 * 1000); 
    }

    state.nextBackup = new Date(nextTime).toISOString();
    send({ type: "agent_state", data: state });
    
    const delay = nextTime - now;
    log(`Scheduling next backup in ${Math.round(delay / 1000 / 60 / 60)} hours.`);
    
    backupTimer = setTimeout(triggerBackup, delay);
}

function connect() {
    if (pingInterval) clearInterval(pingInterval);
    
    log(`Connecting to server...`);
    socket = new WebSocket(config.serverUrl);

    socket.on("open", () => {
        socket.send(JSON.stringify({ type: "auth", token: config.agentToken }));
        pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.ping();
        }, 30000);
    });

    socket.on("message", async (raw) => {
        const message = JSON.parse(raw.toString());
        
        if (message.type === "auth_ok") {
            state.status = "Online";
            log("Connected to dashboard.");
            send({ type: "agent_state", data: state });
            
            // ONLY schedule on startup IF a name was already saved
            if (state.folderName) {
                scheduleNextBackup();
            } else {
                log("Waiting for user to enter a backup folder name on the dashboard.");
            }
        }
        
        if (message.type === "run_backup") {
            if (message.folderName) {
                state.folderName = message.folderName;
                fs.writeFileSync(folderNameFile, state.folderName);
            }
            if (backupTimer) clearTimeout(backupTimer);
            await triggerBackup();
        }
    });

    socket.on("close", () => {
        state.status = "Offline";
        log("Disconnected. Reconnecting in 5s...");
        if (pingInterval) clearInterval(pingInterval);
        setTimeout(connect, 5000);
    });

    socket.on("error", (err) => console.error("WebSocket Error:", err.message));
}

connect();