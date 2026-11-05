# setup.ps1 - The Permanent Zero-Failure Version
$ErrorActionPreference = "Stop"
$InstallDir = $PSScriptRoot
$NodeExe = "C:\Program Files\nodejs\node.exe"
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"

Write-Host "=== Starting PosEdge Agent Installer ===" -ForegroundColor Cyan

# 1. Install Node.js (using Windows built-in curl.exe to bypass SSL)
if (!(Test-Path $NodeExe)) {
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    $nodeMsi = "$env:TEMP\node.msi"
    curl.exe -L -o "$nodeMsi" "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    Start-Process msiexec.exe -Wait -ArgumentList "/I `"$nodeMsi`" /qn /norestart"
    Remove-Item $nodeMsi
}

# 2. Install Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Python..." -ForegroundColor Yellow
    $pyExe = "$env:TEMP\python.exe"
    curl.exe -L -o "$pyExe" "https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe"
    Start-Process $pyExe -Wait -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"
    Remove-Item $pyExe
}

# 3. Force PATH update for Python
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 4. Install Python Libraries
Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
python -m pip install pyautogui pygetwindow opencv-python pillow

# 5. Install NPM dependencies ONLY if missing
if (!(Test-Path "$InstallDir\node_modules")) {
    Write-Host "Installing Node modules..." -ForegroundColor Cyan
    Set-Location $InstallDir
    & $NpmCmd install
}

# 6. Copy Bundled Rclone to System32 (No Downloads!)
if (!(Test-Path "C:\Windows\System32\rclone.exe")) {
    Write-Host "Installing Bundled Rclone..." -ForegroundColor Cyan
    if (Test-Path "$InstallDir\rclone.exe") {
        Copy-Item "$InstallDir\rclone.exe" -Destination "C:\Windows\System32\rclone.exe" -Force
    } else {
        Write-Host "WARNING: rclone.exe not found in the folder!" -ForegroundColor Red
    }
}

# 7. Set up Auto-Start with Absolute Path
Write-Host "Setting up Task Scheduler..." -ForegroundColor Cyan
$action = New-ScheduledTaskAction -Execute $NodeExe -Argument "agent.js" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "PosEdgeAgent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

# 8. Start the Agent
Write-Host "Starting the Agent..." -ForegroundColor Cyan
Start-Process -FilePath $NodeExe -ArgumentList "agent.js" -WorkingDirectory $InstallDir

Write-Host "=== Installation Complete! ===" -ForegroundColor Green
Start-Sleep -Seconds 3