$ErrorActionPreference='Continue'
$dir='C:\Export\hourly\20261026-1640'
$health='offline'
$sql='unreachable'
try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:3456/api/health' -TimeoutSec 7; if($r.ok -eq $true -and $r.database -eq 'Jawafa_DB'){$health='connected'} else {$health='unhealthy'} } catch { $health='offline' }
try { if(Test-NetConnection -ComputerName '127.0.0.1' -Port 1433 -InformationLevel Quiet -WarningAction SilentlyContinue){$sql='reachable'} } catch {}
$o=[ordered]@{timestamp_utc=[DateTime]::UtcNow.ToString('o');bridge=$health;sql_tcp=$sql;database='Jawafa_DB';source='local_read_only_health';restarted=$false}
[IO.File]::WriteAllText((Join-Path $dir 'bridge_health.json'),($o|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
if($health -ne 'connected' -or $sql -ne 'reachable'){ Add-Content -LiteralPath (Join-Path $dir 'bridge_alerts.log') -Value ($o.timestamp_utc+' bridge='+$health+' sql='+$sql) }
$o|ConvertTo-Json
