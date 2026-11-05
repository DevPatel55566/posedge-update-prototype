# setup.ps1 - Auto-installer for PosEdge Agent
$ErrorActionPreference = "Stop"
$InstallDir = "C:\PosEdgeAgent"

Write-Host "Creating installation directory at $InstallDir..."
If (!(Test-Path -Path $InstallDir)) { New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null }

Write-Host "Installing Node.js dependencies..."
Set-Location $InstallDir
npm install

Write-Host "Installing Python dependencies (PyAutoGUI, OpenCV)..."
python -m pip install pyautogui pygetwindow opencv-python pillow

Write-Host "Downloading Rclone..."
$rcloneUrl = "https://downloads.rclone.org/rclone-current-windows-amd64.zip"
$rcloneZip = "$InstallDir\rclone.zip"
Invoke-WebRequest -Uri $rcloneUrl -OutFile $rcloneZip
Expand-Archive -Path $rcloneZip -DestinationPath "$InstallDir\rclone" -Force
Remove-Item $rcloneZip
$rcloneExe = Get-ChildItem -Path "$InstallDir\rclone" -Filter "rclone.exe" -Recurse | Select-Object -First 1
Copy-Item $rcloneExe.FullName -Destination "C:\Windows\System32\rclone.exe" -Force

Write-Host "Setting up Auto-Start with Windows Task Scheduler..."
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "agent.js" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName "PosEdgeAgent" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "Starting the Agent for the first time..."
Start-Process -FilePath "node.exe" -ArgumentList "agent.js" -WorkingDirectory $InstallDir

Write-Host "Installation Complete! PosEdge Agent is now running in the background."
Start-Sleep -Seconds 5