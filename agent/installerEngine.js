import fs from "fs";
import { spawn } from "child_process";

async function killPosProcesses() {
  return new Promise((resolve) => {
    const script = `
$exclude = @("node", "cmd", "conhost", "explorer", "powershell", "python")
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
  console.log("[INSTALLER] Starting Silent Install...");
  await killPosProcesses();

  const escapedPath = installerPath.replace(/'/g, "''");
  
  // /VERYSILENT runs it in the background. 
  // The script waits for it to finish, then waits 30s and sends 2 Enter keys for the DB prompt.
  const script = `
Start-Process -FilePath '${escapedPath}' -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -Wait
Write-Output "Install Finished. Waiting for DB Prompt..."
Start-Sleep -Seconds 20
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Seconds 1
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Seconds 5
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Output "Automation Complete"
`;

  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
    
    child.stdout.on("data", (data) => { process.stdout.write(data.toString()); });
    child.stderr.on("data", (data) => { console.error(data.toString()); });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("[INSTALLER] Silent installation successful.");
        resolve({ success: true });
      } else {
        reject(new Error(`Silent installer failed with code ${code}`));
      }
    });
  });
}