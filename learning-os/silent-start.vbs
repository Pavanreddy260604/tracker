Set WshShell = CreateObject("WScript.Shell") 
WshShell.Run "cmd /c cd backend && npm run dev", 0
WshShell.Run "cmd /c cd frontend && npm run dev", 0
WshShell.Run "cmd /c ollama run gemma3:4b", 0
Set WshShell = Nothing
