# setup.ps1 - Bulletproof Direct Download Installer
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$InstallDir = $PSScriptRoot

Write-Host "=== Starting PosEdge Agent Installer ===" -ForegroundColor Cyan

# 1. Install Node.js (Direct Download MSI)
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Downloading official installer..." -ForegroundColor Yellow
    $nodeMsi = "$env:TEMP\node-installer.msi"
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi
    Write-Host "Installing Node.js silently..." -ForegroundColor Yellow
    Start-Process msiexec.exe -Wait -ArgumentList "/I `"$nodeMsi`" /qn /norestart"
    Remove-Item $nodeMsi
} else {
    Write-Host "Node.js is already installed." -ForegroundColor Green
}

# 2. Install Python (Direct Download EXE)
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Downloading official installer..." -ForegroundColor Yellow
    $pyExe = "$env:TEMP\python-installer.exe"
    $pyUrl = "https://www.python.org/ftp/python/3.12.2/python-3.12.2-amd64.exe"
    Invoke-WebRequest -Uri $pyUrl -OutFile $pyExe
    Write-Host "Installing Python silently..." -ForegroundColor Yellow
    Start-Process $pyExe -Wait -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"
    Remove-Item $pyExe
} else {
    Write-Host "Python is already installed." -ForegroundColor Green
}

# 3. Refresh the PATH so the script can use Node and Python immediately
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 4. Install Python Libraries
Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
python -m pip install pyautogui pygetwindow opencv-python pillow

# 5. Download and Install Rclone
if (!(Test-Path "C:\Windows\System32\rclone.exe")) {
    Write-Host "Rclone not found. Downloading..." -ForegroundColor Cyan
    $rcloneUrl = "https://downloads.rclone.org/rclone-current-windows-amd64.zip"
    $rcloneZip = "$InstallDir\rclone.zip"
    Invoke-WebRequest -Uri $rcloneUrl -OutFile $rcloneZip
    Expand-Archive -Path $rcloneZip -DestinationPath "$InstallDir\rclone" -Force
    Remove-Item $rcloneZip
    $rcloneExe = Get-ChildItem -Path "$InstallDir\rclone" -Filter "rclone.exe" -Recurse | Select-Object -First 1
    
    Stop-Process -Name rclone -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Copy-Item $rcloneExe.FullName -Destination "C:\Windows\System32\rclone.exe" -Force
} else {
    Write-Host "Rclone is already installed. Skipping download." -ForegroundColor Green
}

# 6. Set up Auto-Start with Windows Task Scheduler
Write-Host "Setting up Auto-Start with Windows Task Scheduler..." -ForegroundColor Cyan
$nodePath = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "agent.js" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName "PosEdgeAgent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

# 7. Start the Agent
Write-Host "Starting the Agent..." -ForegroundColor Cyan
Start-Process -FilePath $nodePath -ArgumentList "agent.js" -WorkingDirectory $InstallDir

Write-Host "=== Installation Complete! ===" -ForegroundColor Green
Start-Sleep -Seconds 5