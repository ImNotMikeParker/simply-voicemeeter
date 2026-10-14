# Force-restarts the plugin: ends every Node process running this plugin (Stream Deck can leave more than one
# behind after a crash-restart cycle) and waits for Stream Deck to relaunch exactly one fresh process.
$pattern = "com\.mjp\.simplyvoicemeeter\.sdPlugin"
function Get-PluginProcs { Get-CimInstance Win32_Process -Filter "Name like 'node%'" | Where-Object { $_.CommandLine -match $pattern } }

$procs = @(Get-PluginProcs)
if ($procs.Count -eq 0) { Write-Host "Plugin process not found (is Stream Deck running and the plugin linked?)"; exit 1 }
foreach ($p in $procs) {
  try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Host "Stopped plugin process $($p.ProcessId) (started $($p.CreationDate.ToString('HH:mm:ss')))" }
  catch { Write-Host "Could not stop $($p.ProcessId): $($_.Exception.Message)" }
}
# Anything that is still alive (or got spawned while we were killing) goes too, so only one fresh process remains.
Start-Sleep -Milliseconds 500
foreach ($p in @(Get-PluginProcs)) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Host "Stopped straggler $($p.ProcessId)" } catch {} }

$deadline = (Get-Date).AddSeconds(15)
do { Start-Sleep -Milliseconds 500; $again = @(Get-PluginProcs) } while ($again.Count -eq 0 -and (Get-Date) -lt $deadline)
if ($again.Count -gt 0) { foreach ($p in $again) { Write-Host "Stream Deck relaunched the plugin (pid $($p.ProcessId), started $($p.CreationDate.ToString('HH:mm:ss')))" } }
else { Write-Host "Plugin did not come back within 15 s; Stream Deck usually relaunches it shortly." }
