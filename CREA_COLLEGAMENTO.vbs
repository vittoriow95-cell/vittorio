Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\HACCP System.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\vitto\Desktop\HACCP_APP\AVVIA_HACCP.vbs"
oLink.WorkingDirectory = "C:\Users\vitto\Desktop\HACCP_APP"
oLink.Description = "HACCP System - Gestione Certificazioni e PEC"
oLink.IconLocation = "C:\Windows\System32\imageres.dll,1"
oLink.Save

WScript.Echo "Collegamento creato sul Desktop!"
