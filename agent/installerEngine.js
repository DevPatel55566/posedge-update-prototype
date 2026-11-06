import fs from "fs";
import { spawn } from "child_process";

export async function runInstaller(installerPath) {
  console.log("\n==========================================");
  console.log("[INSTALLER] Starting Fully Hardcoded Auto-Install");
  console.log("==========================================");

  const escapedPath = installerPath.replace(/'/g, "''");

  // We removed -PassThru and $proc.Id. We find the window by its Title.
  const psScript = `
    # 1. Kill any running POS software
    $exclude = @("node", "cmd", "conhost", "explorer", "powershell", "python")
    Get-Process | Where-Object {
        ($_.ProcessName -like "*pos*" -or $_.ProcessName -like "*universal*") -and
        $exclude -notcontains $_.ProcessName
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    # 2. Launch the installer
    Write-Host "[INSTALLER] Launching installer..."
    Start-Process -FilePath '${escapedPath}'
    Start-Sleep -Seconds 5

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName Microsoft.VisualBasic

    function Send-Keys {
        param([string]$keys, [int]$wait = 1)
        # AppActivate by Title is much more reliable than PID
        [Microsoft.VisualBasic.Interaction]::AppActivate("Universal POS Setup")
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait($keys)
        Start-Sleep -Seconds $wait
    }

    # 3. STEP 1: Warning Dialog (Press Enter to hit OK)
    Write-Host "[INSTALLER] Step 1: Dismissing Warning Dialog..."
    Send-Keys "{ENTER}" 2

    # 4. STEP 2: Welcome Screen (Press Enter for Next >)
    Write-Host "[INSTALLER] Step 2: Welcome Screen..."
    Send-Keys "{ENTER}" 2

    # 5. STEP 3: License Agreement (3 Tabs to checkbox, Space to check, Enter for Next >)
    Write-Host "[INSTALLER] Step 3: License Agreement..."
    Send-Keys "{TAB}" 1
    Send-Keys "{TAB}" 1
    Send-Keys "{TAB}" 1
    Send-Keys " " 1
    Send-Keys "{ENTER}" 2

    # 6. STEP 4: Choose Components (Space to uncheck Backup, Enter for Next >)
    Write-Host "[INSTALLER] Step 4: Choose Components..."
    Send-Keys " " 1
    Send-Keys "{ENTER}" 2

    # 7. STEP 5: Install Location (Enter for Install)
    Write-Host "[INSTALLER] Step 5: Install Location..."
    Send-Keys "{ENTER}" 2

    # 8. STEP 6: Completing Screen (Wait 90 seconds for install, Space to uncheck Readme, Enter for Finish)
    Write-Host "[INSTALLER] Step 6: Waiting 90 seconds for installation to complete..."
    Start-Sleep -Seconds 90
    Send-Keys " " 1
    Send-Keys "{ENTER}" 2

    # 9. STEP 7: Database Upgrade Prompts
    Write-Host "[INSTALLER] Step 7: Waiting 15 seconds for Database Prompts..."
    Start-Sleep -Seconds 15
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
    Start-Sleep -Seconds 1
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Seconds 5
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Host "[INSTALLER] All steps completed successfully."
  `;

  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript]);
    
    child.stdout.on("data", (data) => { process.stdout.write(data.toString()); });
    child.stderr.on("data", (data) => { console.error(data.toString()); });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("[INSTALLER] Installation sequence completed.");
        resolve({ success: true });
      } else {
        reject(new Error(`Installer sequence failed with code ${code}`));
      }
    });
  });
}