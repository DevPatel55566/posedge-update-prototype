# setup.ps1 - Permanent Path Fix
$ErrorActionPreference = "Stop"
$InstallDir = $PSScriptRoot

Write-Host "=== Starting PosEdge Agent Installer ===" -ForegroundColor Cyan
Write-Host "Installing to: $InstallDir" -ForegroundColor Cyan

# 1. Check and Install Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing via winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# 2. Check and Install Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Installing via winget..." -ForegroundColor Yellow
    winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# 3. Install Python Libraries
Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
python -m pip install pyautogui pygetwindow opencv-python pillow

# 4. Download and Install Rclone
Write-Host "Downloading Rclone..." -ForegroundColor Cyan
$rcloneUrl = "https://downloads.rclone.org/rclone-current-windows-amd64.zip"
$rcloneZip = "$InstallDir\rclone.zip"
Invoke-WebRequest -Uri $rcloneUrl -OutFile $rcloneZip
Expand-Archive -Path $rcloneZip -DestinationPath "$InstallDir\rclone" -Force
Remove-Item $rcloneZip
$rcloneExe = Get-ChildItem -Path "$InstallDir\rclone" -Filter "rclone.exe" -Recurse | Select-Object -First 1
Copy-Item $rcloneExe.FullName -Destination "C:\Windows\System32\rclone.exe" -Force

# 5. Set up Auto-Start with Windows Task Scheduler
Write-Host "Setting up Auto-Start with Windows Task Scheduler..." -ForegroundColor Cyan
# Find exactly where node.exe is so Task Scheduler never fails
$nodePath = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "agent.js" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName "PosEdgeAgent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

# 6. Start the Agent
Write-Host "Starting the Agent..." -ForegroundColor Cyan
Start-Process -FilePath $nodePath -ArgumentList "agent.js" -WorkingDirectory $InstallDir

Write-Host "=== Installation Complete! ===" -ForegroundColor Green
Start-Sleep -Seconds 5