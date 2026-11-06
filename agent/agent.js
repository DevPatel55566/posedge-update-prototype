import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import crypto from "crypto";
import { spawn } from "child_process";
import WebSocket from "ws";
import { runInstaller } from "./installerEngine.js";
import { performBackup } from "./backupEngine.js";
import { scanLicense } from "./licenseScanner.js";
import { getLatestRelease } from "./universalPosReleaseChecker.js";

const CONFIG_PATH = path.join(process.cwd(), "config.json");
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const computerName = os.hostname();

let socket = null;
let backupTimer = null;

const state = {
    status: "Starting", computer: computerName, client: null, address: null,
    licenseDetected: false, licenseFile: null, currentOperation: "Idle",
    latestRelease: null, downloadedInstaller: null, error: null,
    lastBackup: null, nextBackup: null
};

function send(message) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
function reportState() { send({ type: "agent_state", data: state }); }
function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
    send({ type: "log", message });
}

// Send history log to server
function logHistory(action, status, details) {
    send({
        type: "log_history",
        data: {
            timestamp: new Date().toISOString(),
            computer: state.computer,
            client: state.client || "Unknown",
            action: action,
            status: status,
            details: details || "No details"
        }
    });
}

async function discoverLicense() {
    try {
        const result = scanLicense(config.dataPath);
        if (!result.detected) {
            state.licenseDetected = false; state.client = null;
            state.error = result.reason || "No .lic file found"; reportState(); return;
        }
        state.licenseDetected = true; state.client = result.name; state.address = result.address;
        state.error = null; reportState();
    } catch (error) { state.error = error.message; reportState(); }
}

async function triggerBackup(manualFolderName = null) {
    const finalFolderName = manualFolderName || state.client;
    if (!finalFolderName) { log("Backup skipped: No name."); return; }

    state.currentOperation = "Running NAS Backup"; reportState();
    log(`Starting backup for ${finalFolderName}...`);

    try {
        const backupResult = await performBackup(config.dataPath, config.backupPath, finalFolderName);
        state.currentOperation = "Backup Complete";
        state.lastBackup = new Date().toISOString();
        log(`Backup successful! Saved to: ${backupResult.destination}`);
        logHistory("Backup", "Success", backupResult.destination);
    } catch (error) {
        state.currentOperation = "Backup Failed"; state.error = error.message;
        log(`Backup failed: ${error.message}`);
        logHistory("Backup", "Failed", error.message); 
    }
    reportState();
}

function scheduleBackup() {
    if (backupTimer) clearTimeout(backupTimer);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    state.nextBackup = new Date(Date.now() + TWENTY_FOUR_HOURS).toISOString();
    reportState();
    backupTimer = setTimeout(async () => { await triggerBackup(); scheduleBackup(); }, TWENTY_FOUR_HOURS);
}

function downloadFile(url, destination, cookies = {}) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { "User-Agent": "Mozilla/5.0", Cookie: Object.entries(cookies).map(([n, v]) => `${n}=${v}`).join("; ") } }, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume(); downloadFile(new URL(response.headers.location, url).href, destination, cookies).then(resolve).catch(reject); return;
            }
            if (response.statusCode !== 200) { response.resume(); return reject(new Error(`HTTP ${response.statusCode}`)); }
            const file = fs.createWriteStream(destination); response.pipe(file);
            file.on("finish", () => { file.close(error => { if (error) return reject(error); resolve(); }); });
        });
        request.on("error", reject);
    });
}

function calculateSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}

async function checkLatestRelease() {
    try {
        state.currentOperation = "Checking latest release"; reportState();
        const release = await getLatestRelease(config.universalPos.username, config.universalPos.password);
        state.latestRelease = { version: release.versionNumber, fileName: release.fileName, url: release.url };
        state.error = null; reportState();
    } catch (error) { state.error = error.message; reportState(); throw error; }
}

async function downloadLatestRelease() {
    try {
        state.currentOperation = "Downloading release"; reportState();
        const release = await getLatestRelease(config.universalPos.username, config.universalPos.password);
        const downloadPath = config.downloadPath || "C:\\Downloads";
        if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });
        const uniqueName = `${Date.now()}_${release.fileName}`;
        const destination = path.join(downloadPath, uniqueName);
        
        log(`Downloading to ${destination}...`);
        await downloadFile(release.url, destination, release.cookies || {});
        const sha256 = await calculateSha256(destination);
        state.downloadedInstaller = { version: release.versionNumber, fileName: uniqueName, path: destination, sha256 };
        state.error = null; reportState();
    } catch (error) { state.error = error.message; reportState(); throw error; }
}

async function installLatestRelease() {
    try {
        if (!state.downloadedInstaller) throw new Error("No installer available.");
        state.currentOperation = "Launching Installer"; reportState();
        
        // This just OPENS the installer. It does not click anything.
        await runInstaller(state.downloadedInstaller.path);
        
        state.currentOperation = "Waiting for Manual Installation"; reportState();
        log("Installer launched. Please click through the installation manually on the screen.");
        log("Once finished, go to the dashboard and click 'Run Backup Now' to start the first backup.");
        
        logHistory("Install", "Launched", `Version ${state.downloadedInstaller.version}`);
        
        // We do NOT trigger the backup here anymore. You will do it manually from the dashboard.
    } catch (error) {
        state.currentOperation = "Installer launch failed"; state.error = error.message; reportState();
        logHistory("Install", "Failed", error.message); 
        throw error;
    }
}

async function runFullAutomation() {
    try {
        log("STARTING FULL AUTOMATED UPDATE WORKFLOW");
        await checkLatestRelease();
        await downloadLatestRelease();
        await installLatestRelease();
        log("==========================================");
        log("INSTALLER LAUNCHED. PLEASE INSTALL MANUALLY.");
        log("WHEN DONE, CLICK 'RUN BACKUP NOW' ON THE DASHBOARD.");
        log("==========================================");
    } catch (error) {
        log(`Automation FAILED: ${error.message}`);
    }
}

function connect() {
    socket = new WebSocket(config.serverUrl);
    socket.on("open", () => socket.send(JSON.stringify({ type: "auth", token: config.agentToken })));
    socket.on("message", async raw => {
        try {
            const message = JSON.parse(raw.toString());
            if (message.type === "auth_ok") { state.status = "Ready"; reportState(); await discoverLicense(); return; }
            if (message.type === "check_latest_release") { await checkLatestRelease(); return; }
            if (message.type === "download_latest_release") { await downloadLatestRelease(); return; }
            if (message.type === "install_latest_release") { await installLatestRelease(); return; }
            if (message.type === "run_backup") { await triggerBackup(message.folderName); return; }
            if (message.type === "auto_update") { await runFullAutomation(); return; }
        } catch (error) { console.error("Message error:", error.message); }
    });
    socket.on("close", () => { state.status = "Offline"; reportState(); setTimeout(connect, 3000); });
}
setInterval(async () => { if (socket && socket.readyState === WebSocket.OPEN) await discoverLicense(); }, 30000);
connect();