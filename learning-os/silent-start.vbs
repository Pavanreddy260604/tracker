Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run "cmd /c cd backend && npm run dev", 0
WshShell.Run "cmd /c cd frontend && npm run dev", 0
Set WshShell = Nothing
