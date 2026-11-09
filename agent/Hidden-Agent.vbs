Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & Replace(WScript.ScriptFullName, "Hidden-Agent.vbs", "Start-Agent.bat") & Chr(34), 0
Set WshShell = Nothing