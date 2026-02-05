Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Percorso della cartella app
appPath = "C:\Users\vitto\Desktop\HACCP_APP"

' Controlla se il server è già attivo
On Error Resume Next
Set objHTTP = CreateObject("WinHttp.WinHttpRequest.5.1")
objHTTP.Open "GET", "http://localhost:5000", False
objHTTP.SetTimeouts 1000, 1000, 1000, 1000
objHTTP.Send

serverGiaAttivo = (objHTTP.Status = 200)
On Error Goto 0

If Not serverGiaAttivo Then
    ' Avvia il server in modo nascosto (senza finestra)
    WshShell.Run "cmd /c cd /d """ & appPath & """ && node server.js", 0, False
    
    ' Aspetta 3 secondi che il server si avvii
    WScript.Sleep 3000
End If

' Trova Chrome o Edge per modalità app
chromePath = ""
edgePath = ""
browserCmd = ""

' Cerca Chrome
If objFSO.FileExists("C:\Program Files\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    browserCmd = """" & chromePath & """ --app=http://localhost:5000 --window-size=1400,900"
ElseIf objFSO.FileExists("C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    browserCmd = """" & chromePath & """ --app=http://localhost:5000 --window-size=1400,900"
End If

' Cerca Edge se Chrome non trovato
If browserCmd = "" Then
    If objFSO.FileExists("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") Then
        edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        browserCmd = """" & edgePath & """ --app=http://localhost:5000 --window-size=1400,900"
    ElseIf objFSO.FileExists("C:\Program Files\Microsoft\Edge\Application\msedge.exe") Then
        edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
        browserCmd = """" & edgePath & """ --app=http://localhost:5000 --window-size=1400,900"
    End If
End If

' Apri come app e ASPETTA che l'utente la chiuda
If browserCmd <> "" Then
    ' Avvia browser e aspetta che si chiuda (True = aspetta)
    WshShell.Run browserCmd, 1, True
    
    ' Quando l'utente chiude la finestra, arriviamo qui
    ' Chiudi il server automaticamente
    If Not serverGiaAttivo Then
        ' Chiudi il server solo se l'abbiamo avviato noi
        WshShell.Run "powershell -WindowStyle Hidden -Command ""Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force""", 0, False
    End If
Else
    ' Fallback: apri browser normale
    WshShell.Run "http://localhost:5000", 1, False
End If
