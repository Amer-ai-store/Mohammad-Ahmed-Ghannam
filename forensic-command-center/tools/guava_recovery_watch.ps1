$ErrorActionPreference='Continue'
$root='C:\Export\hourly\20261026-1640'
$checks=@(@{name='fallback';port=3457;task='GuavaFallbackAPI'},@{name='proxy';port=3458;task='GuavaFailoverProxy'})
$events=@()
foreach($c in $checks){
  $up=$false
  try{$r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$c.port+'/api/health') -TimeoutSec 5; $up=($r.ok -eq $true -and $r.database -eq 'Jawafa_DB')}catch{}
  if(-not $up){
    $running=Get-NetTCPConnection -LocalPort $c.port -State Listen -ErrorAction SilentlyContinue
    if(-not $running){try{Start-ScheduledTask -TaskName $c.task -ErrorAction Stop; Start-Sleep -Seconds 3}catch{}}
    try{$r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$c.port+'/api/health') -TimeoutSec 6; $up=($r.ok -eq $true -and $r.database -eq 'Jawafa_DB')}catch{}
    $events+=($c.name+':'+$(if($up){'recovered'}else{'unavailable'}))
  }
}
$record=[ordered]@{time_utc=[DateTime]::UtcNow.ToString('o');events=$events;mode='local_api_process_recovery_only';accounting_data_modified=$false}
[IO.File]::WriteAllText((Join-Path $root 'guava_recovery_status.json'),($record|ConvertTo-Json -Depth 3),[Text.UTF8Encoding]::new($false))
if($events.Count -gt 0){Add-Content -LiteralPath (Join-Path $root 'guava_recovery_events.log') -Value (($record.time_utc)+' '+($events -join ','))}
$record|ConvertTo-Json -Depth 3
