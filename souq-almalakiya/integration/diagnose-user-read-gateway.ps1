#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only, fail-closed preflight for the Jawafa commerce catalog reader.
.DESCRIPTION
  Detects host, Windows service identity, TCP listener and SQL TLS trust.
  Does not read, decrypt, print or modify secrets. Does not log in as sa.
  A successful Windows integrated test is NOT proof of user_read SQL login.
  Never publishes this report to a public dashboard automatically.
.EXAMPLE
  powershell.exe -NoProfile -File .\diagnose-user-read-gateway.ps1
#>
$ErrorActionPreference='Stop'
$evidence=[ordered]@{
  schema='jawafa-user-read-gateway-preflight-v1'
  timestamp=(Get-Date).ToUniversalTime().ToString('o')
  host=$env:COMPUTERNAME
  runAs=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  sqlServiceRunning=$false
  readerPort3467Listening=$false
  secretReadableByCurrentIdentity=$false
  strictSqlTlsAndWindowsLogin=$false
  authenticatedAsUserRead=$false
  dmlDeniedVerified=$false
  approvedStockSemantics=$false
  approvedTaxPriceSemantics=$false
  status='BLOCKED'
  blockers=@()
}
try{$svc=Get-Service -Name 'MSSQLSERVER';$evidence.sqlServiceRunning=($svc.Status -eq 'Running')}catch{$evidence.blockers+= 'SQL_SERVICE_NOT_AVAILABLE'}
try{$port=Get-NetTCPConnection -LocalPort 3467 -State Listen -ErrorAction Stop;$evidence.readerPort3467Listening=(@($port).Count -gt 0)}catch{$evidence.blockers+='READER_GATEWAY_PORT_NOT_LISTENING'}
$secret='C:\ProgramData\Jawafa\Secrets\Jawafa_user_read_DPAPI.xml'
try{
  $file=Get-Item -LiteralPath $secret -ErrorAction Stop
  $evidence.secretReadableByCurrentIdentity=($file.PSIsContainer -eq $false)
}catch{
  $evidence.blockers+='DPAPI_FILE_NOT_ACCESSIBLE_TO_CURRENT_IDENTITY'
}
# STRICT TLS handshake. No TrustServerCertificate bypass, no SQL credentials,
# and no SQL DML or DDL. Windows integrated is a diagnostic ONLY.
$connection=New-Object System.Data.SqlClient.SqlConnection
$connection.ConnectionString='Server=JAWAFFASVR;Database=master;Integrated Security=SSPI;Encrypt=True;TrustServerCertificate=False;Connect Timeout=4;Application Name=JawafaCatalogPreflightReadOnly'
try{
  $connection.Open()
  $query=$connection.CreateCommand()
  $query.CommandText='SELECT ORIGINAL_LOGIN()'
  $evidence.strictSqlTlsAndWindowsLogin=($null -ne $query.ExecuteScalar())
}catch{
  $message=[string]$_.Exception.Message
  if($message -match 'certificate|SSL Provider|trust chain'){$evidence.blockers+='SQL_TLS_TRUST_CHAIN_NOT_VERIFIED'}
  elseif($message -match 'Login failed|18456'){$evidence.blockers+='CURRENT_WINDOWS_IDENTITY_NOT_AUTHORIZED_FOR_SQL'}
  else{$evidence.blockers+='SQL_CONNECTIVITY_NOT_VERIFIED'}
}finally{$connection.Dispose()}
if(-not $evidence.sqlServiceRunning){$evidence.blockers+='SQL_SERVICE_STOPPED'}
if(-not $evidence.readerPort3467Listening){$evidence.blockers+='USER_READ_GATEWAY_ABSENT'}
# Explicitly remain BLOCKED: metadata can never prove all required gates.
$evidence.blockers+='REQUIRES_INDEPENDENT_USER_READ_TLS_DML_AND_STOCK_PRICE_EVIDENCE'
[pscustomobject]$evidence | ConvertTo-Json -Depth 4
exit 2
