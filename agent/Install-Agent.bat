@echo off
title PosEdge Agent Installer
cd /d "%~dp0"

echo Creating startup shortcut...
set SCRIPT="%TEMP%\%RANDOM%-%RANDOM%-%RANDOM%-%RANDOM%.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PosEdgeAgent.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%~dp0Hidden-Agent.vbs" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%

echo Starting Agent in background...
start "" "%~dp0Hidden-Agent.vbs"

echo.
echo ========================================================
echo Installation Complete! 
echo The agent is now running silently in the background.
echo It will start automatically every time this PC reboots.
echo ========================================================
timeout /t 5