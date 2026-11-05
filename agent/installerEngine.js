import fs from "fs";
import path from "path";
import { spawn } from "child_process";

async function killPosProcesses() {
  console.log("[INSTALLER] Killing any running POS processes to prevent file locks...");
  return new Promise((resolve) => {
    const script = `
$exclude = @("node", "universal2026092", "cmd", "conhost", "explorer", "powershell", "python")
Get-Process | Where-Object {
    ($_.ProcessName -like "*pos*" -or $_.ProcessName -like "*universal*") -and
    $exclude -notcontains $_.ProcessName
} | Stop-Process -Force -ErrorAction SilentlyContinue
`;
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", script]);
    child.on("close", () => resolve());
  });
}

export async function runInstaller(installerPath) {
  console.log("\n==========================================");
  console.log("[INSTALLER] Starting UniversalPOS installer");
  console.log("==========================================");
  console.log(`[INSTALLER] File: ${installerPath}`);

  if (!fs.existsSync(installerPath)) throw new Error(`Installer file does not exist: ${installerPath}`);
  const stats = fs.statSync(installerPath);
  if (stats.size <= 0) throw new Error("Installer file is empty.");

  await killPosProcesses();

  console.log("[INSTALLER] Launching PyAutoGUI automation script...");
  const pythonScript = path.join(process.cwd(), "automate_installer.py");

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [pythonScript, installerPath]);

    pythonProcess.stdout.on("data", (data) => { process.stdout.write(data.toString()); });
    pythonProcess.stderr.on("data", (data) => { console.error(data.toString()); });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        console.log("[INSTALLER] PyAutoGUI script completed successfully.");
        resolve({ success: true, installerPath });
      } else {
        reject(new Error(`PyAutoGUI script failed with exit code ${code}`));
      }
    });
  });
}