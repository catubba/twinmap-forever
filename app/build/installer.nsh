; Before it touches the files, the installer looks whether Twinmap is running, and closes it. The
; stock check starts PowerShell three times over (is it there, may it run, the list of processes),
; seconds each time, in the installer and again in the uninstaller of the version before: twelve
; seconds of an update with nothing to show for them. The task list of Windows answers at once,
; and the stock check already knows how to use it where there is no PowerShell.
; What the stock check leans on, and leaves out when a check of ours is given.
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  Var /GLOBAL IsPowerShellAvailable ; 0 = available, 1 = not: the stock check then asks the task list
  StrCpy $IsPowerShellAvailable 1
  !insertmacro _CHECK_APP_RUNNING
!macroend
