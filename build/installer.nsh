!macro customInstall
  WriteRegExpandStr HKCU "Environment" "STORAGE_MODE" "sqlite"

  ExecWait 'netsh advfirewall firewall add rule name="HACCP Server 5000" dir=in action=allow protocol=TCP localport=5000'
  ExecWait 'netsh advfirewall firewall add rule name="HACCP Print Agent 7002" dir=in action=allow protocol=TCP localport=7002'

  CreateShortCut "$SMSTARTUP\\HACCP System.lnk" "$INSTDIR\\HACCP System.exe"
  CreateShortCut "$DESKTOP\\HACCP System.lnk" "$INSTDIR\\HACCP System.exe"
!macroend
