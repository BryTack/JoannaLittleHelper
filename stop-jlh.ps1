# Force-close Word (no save prompt)
$word = Get-Process -Name WINWORD -ErrorAction SilentlyContinue
if ($word) {
  Write-Host "  Closing Word (unsaved changes will be lost)"
  Stop-Process -Name WINWORD -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "  Word was not running"
}

# Close cmd windows launched by start-jlh.bat, matched by command line content
$patterns = @('presidioServer', 'aiServer', 'dev-server', 'npm start')

# Close the JLH Launcher window by title (not CommandLine, to avoid matching restart-jlh)
Get-Process -Name cmd -ErrorAction SilentlyContinue | Where-Object {
  $_.MainWindowTitle -eq 'JLH Launcher'
} | ForEach-Object {
  Write-Host "  Closing JLH Launcher (PID $($_.Id))"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Get-WmiObject Win32_Process -Filter 'Name="cmd.exe"' | ForEach-Object {
  $cmdline = $_.CommandLine
  $procId  = $_.ProcessId
  foreach ($p in $patterns) {
    if ($cmdline -like "*$p*") {
      Write-Host "  Closing PID $procId ($p)"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      break
    }
  }
}
