param([string]$Source='C:\Export\hourly\20261026-1640\data',[string]$Out='C:\Export\hourly\20261026-1640\inventory_summary.json')
$ErrorActionPreference='Stop'
$files=Get-ChildItem -LiteralPath $Source -File -Filter '*.csv'
$empty=@($files | Where-Object Length -EQ 0 | Select-Object -ExpandProperty Name)
$summary=[ordered]@{
  generated_at_utc=[DateTime]::UtcNow.ToString('o')
  source_type='read_only_csv_snapshot'
  live_sql_connected=$false
  file_count=@($files).Count
  total_bytes=($files | Measure-Object -Property Length -Sum).Sum
  zero_byte_count=$empty.Count
  zero_byte_names=$empty
  status='snapshot_inventory_only'
}
$json=$summary | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($Out,$json,[System.Text.UTF8Encoding]::new($false))
Write-Output $json
