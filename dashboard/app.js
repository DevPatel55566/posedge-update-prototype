async function getStatus() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    updateDashboard(data);
  } catch (error) { console.error("Status error:", error); }
}

function formatDate(value) { if (!value) return "—"; try { return new Date(value).toLocaleString(); } catch { return value; } }
function formatBytes(bytes) { if (!bytes) return "—"; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

function updateDashboard(data) {
  const connection = document.getElementById("connection");
  if (connection) { 
      data.agentOnline 
        ? (connection.textContent = "Agent Online", connection.className = "connection online") 
        : (connection.textContent = "Agent Offline", connection.className = "connection offline"); 
  }
  
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  
  set("computer", data.computer || "—");
  set("status", data.status || "—");
  set("lastSeen", formatDate(data.lastSeen));
  set("client", data.client || "—");
  set("address", data.address || "—");
  set("license", data.licenseDetected ? data.licenseFile || "Detected" : "Not detected");
  set("version", data.latestRelease?.version || "—");
  set("installer", data.downloadedInstaller?.path || data.downloadedInstaller?.fileName || "Not downloaded");
  set("operation", data.currentOperation || "Idle");
  set("error", data.error || "");
  set("installerFile", data.downloadedInstaller?.fileName || "—");
  set("installerSize", formatBytes(data.downloadedInstaller?.sizeBytes));
  set("installerHash", data.downloadedInstaller?.sha256 || "—");
  set("lastBackup", formatDate(data.lastBackup));
  set("nextBackup", formatDate(data.nextBackup));
}

async function checkLatestRelease() {
  const button = document.getElementById("checkReleaseButton");
  if (button) { button.disabled = true; button.textContent = "Checking..."; }
  try { await fetch("/api/check-update", { method: "POST" }); } catch (error) { alert("Server offline."); }
  if (button) { button.disabled = false; button.textContent = "Check Latest Release"; }
  getStatus();
}

async function downloadLatestRelease() {
  const button = document.getElementById("downloadButton");
  if (button) { button.disabled = true; button.textContent = "Downloading..."; }
  try { await fetch("/api/download-update", { method: "POST" }); } catch (error) { alert("Server offline."); }
  if (button) { button.disabled = false; button.textContent = "Download Latest Installer"; }
  getStatus();
}

async function runUpdate() { await downloadLatestRelease(); }

async function installLatestRelease() {
  const button = document.getElementById("installButton");
  if (button) { button.disabled = true; button.textContent = "Installing..."; }
  try { await fetch("/api/install-update", { method: "POST" }); } catch (error) { alert("Server offline."); }
  if (button) { button.disabled = false; button.textContent = "Install Latest Release"; }
  getStatus();
}

async function runBackup() {
  const button = document.querySelector('button[onclick="runBackup()"]');
  const folderInput = document.getElementById("backupFolderInput");
  const customFolderName = folderInput && folderInput.value.trim() !== "" ? folderInput.value.trim() : null;
  
  if (button) { button.disabled = true; button.textContent = "Backing up..."; }
  
  try {
    await fetch("/api/run-backup", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ folderName: customFolderName }) 
    });
  } catch (error) { alert("Server offline."); }
  
  if (button) { button.disabled = false; button.textContent = "Run Backup Now"; }
  getStatus();
}

async function runAutoUpdate() {
  const button = document.getElementById("autoUpdateButton");
  if (button) { button.disabled = true; button.textContent = "Running Full Automation..."; }
  try { await fetch("/api/auto-update", { method: "POST" }); } catch (error) { alert("Server offline."); }
  if (button) { button.disabled = false; button.textContent = "🚀 Start Full Auto Update"; }
  getStatus();
}

getStatus();
setInterval(getStatus, 2000); 