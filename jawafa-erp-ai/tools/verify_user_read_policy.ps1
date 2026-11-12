#Requires -Version 5.1
<#
.SYNOPSIS
  Read-only, fail-closed security acceptance probe for Jawafa_DB user_read.
.DESCRIPTION
  This is an OPERATOR-INITIATED gate. It never queries financial rows, posts,
  edits, exports credentials, or stores login secrets. It is NOT a production
  SQL bridge and must not be exposed to a browser or a public runner.
  The encrypted PSCredential is decrypted only by Windows DPAPI on the
  authorized server, in the matching Windows identity context.
#>
[CmdletBinding()]
param(
  [switch]$SelfTest,
  [string]$Server = 'JAWAFFASVR',
  [string]$Database = 'Jawafa_DB',
  [string]$CredentialFile = '',
  [string[]]$ApprovedViews = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-UserReadVerdict {
  param([hashtable]$Facts)
  $blocked = New-Object System.Collections.Generic.List[string]
  if ($Facts.Connected -ne $true) { [void]$blocked.Add('CONNECTION_NOT_VERIFIED') }
  if ($Facts.Login -cne 'user_read') { [void]$blocked.Add('LOGIN_NOT_USER_READ') }
  if ($Facts.Database -cne 'Jawafa_DB') { [void]$blocked.Add('WRONG_DATABASE') }
  if ($Facts.EncryptedAndTrustedTls -ne $true) {
    [void]$blocked.Add('TRUSTED_TLS_NOT_VERIFIED')
  }
  if ($Facts.Sysadmin -ne 0 -or $Facts.DbOwner -ne 0 -or
      $Facts.DbWriter -ne 0 -or $Facts.DdlAdmin -ne 0) {
    [void]$blocked.Add('ELEVATED_ROLE_PRESENT_OR_UNKNOWN')
  }
  # db_datareader grants broad read across all user tables. The approved
  # production design MUST replace it with explicit grants on allowlisted
  # views/objects; the gate does not change permissions on the server.
  if ($Facts.DbReader -ne 0) {
    [void]$blocked.Add('BROAD_DB_DATAREADER_REQUIRES_SCOPE_REVIEW')
  }
  if ($Facts.WritableObjects -ne 0 -or $Facts.WritableSchemas -ne 0 -or
      $Facts.WritableDatabasePermissions -ne 0) {
    [void]$blocked.Add('DML_OR_DDL_PERMISSION_PRESENT_OR_UNKNOWN')
  }
  if ($Facts.ApprovedViewCount -le 0 -or
      $Facts.SelectableApprovedViews -ne $Facts.ApprovedViewCount) {
    [void]$blocked.Add('APPROVED_VIEWS_NOT_VERIFIED')
  }
  return [pscustomobject]@{
    status = if ($blocked.Count -eq 0) { 'ELIGIBLE_FOR_INDEPENDENT_REVIEW' }
             else { 'BLOCKED' }
    blockers = @($blocked.ToArray())
    # "ELIGIBLE" does not prove backend API auth, auditing, restore testing,
    # original-finance reconciliation, or approval for live dashboards.
    connectionIsNotProductionApproval = $true
  }
}

if ($SelfTest) {
  # Synthetic data ONLY. This path MUST NOT access DPAPI or any SQL server.
  $good = @{
    Connected = $true; Login = 'user_read'; Database = 'Jawafa_DB'
    EncryptedAndTrustedTls = $true
    Sysadmin = 0; DbOwner = 0; DbWriter = 0; DdlAdmin = 0; DbReader = 0
    WritableObjects = 0; WritableSchemas = 0
    WritableDatabasePermissions = 0
    ApprovedViewCount = 2; SelectableApprovedViews = 2
  }
  $result = Get-UserReadVerdict $good
  if ($result.status -ne 'ELIGIBLE_FOR_INDEPENDENT_REVIEW') {
    throw 'SELF_TEST_CLEAN_READONLY_REJECTED'
  }
  foreach ($k in @('Connected', 'EncryptedAndTrustedTls', 'DbReader',
                   'Sysadmin', 'DbOwner', 'DbWriter', 'DdlAdmin',
                   'WritableObjects', 'WritableSchemas',
                   'WritableDatabasePermissions', 'SelectableApprovedViews')) {
    $bad = $good.Clone()
    if ($k -eq 'Connected' -or $k -eq 'EncryptedAndTrustedTls') {
      $bad[$k] = $false
    } elseif ($k -eq 'SelectableApprovedViews') {
      $bad[$k] = 1
    } else {
      $bad[$k] = 1
    }
    if ((Get-UserReadVerdict $bad).status -ne 'BLOCKED') {
      throw 'SELF_TEST_FAIL_OPEN'
    }
  }
  foreach ($value in @('sa', 'USER_READ_WRONG', '')) {
    $bad = $good.Clone(); $bad.Login = $value
    if ((Get-UserReadVerdict $bad).status -ne 'BLOCKED') {
      throw 'SELF_TEST_WRONG_LOGIN_NOT_BLOCKED'
    }
  }
  $bad = $good.Clone(); $bad.ApprovedViewCount = 0
  if ((Get-UserReadVerdict $bad).status -ne 'BLOCKED') {
    throw 'SELF_TEST_EMPTY_ALLOWLIST_NOT_BLOCKED'
  }
  Write-Output 'PASS: synthetic user_read least-privilege, TLS and fail-closed checks'
  exit 0
}

# Approved target and in-server secrets only. No user input reaches SQL syntax.
if ($Server -cne 'JAWAFFASVR' -or $Database -cne 'Jawafa_DB') {
  throw 'UNAPPROVED_SQL_TARGET'
}
if ($CredentialFile -eq '') {
  $CredentialFile = Join-Path $env:ProgramData 'Jawafa\Secrets\Jawafa_user_read_DPAPI.xml'
}
$expectedSecretPath = Join-Path $env:ProgramData 'Jawafa\Secrets\Jawafa_user_read_DPAPI.xml'
if ($CredentialFile -cne $expectedSecretPath -or
    -not (Test-Path -LiteralPath $CredentialFile -PathType Leaf)) {
  throw 'EXPECTED_SERVER_DPAPI_FILE_UNAVAILABLE'
}
$viewPattern = '^[A-Za-z_][A-Za-z_0-9]{0,127}\.[A-Za-z_][A-Za-z_0-9]{0,127}$'
foreach ($name in $ApprovedViews) {
  if ($name -cnotmatch $viewPattern) { throw 'INVALID_APPROVED_VIEW_IDENTIFIER' }
}

$connection = $null
$command = $null
$reader = $null
$credential = $null
try {
  $credential = Import-Clixml -LiteralPath $CredentialFile
  if ($credential -isnot [System.Management.Automation.PSCredential] -or
      $credential.UserName -cne 'user_read') {
    throw 'DPAPI_CREDENTIAL_NOT_USER_READ'
  }

  # SQL Server SqlCredential takes a SecureString; no -P, cleartext password,
  # SQL auth token in a process argument, environment variable or log.
  Add-Type -AssemblyName System.Data
  $sqlCredential = [System.Data.SqlClient.SqlCredential]::new(
    'user_read', $credential.Password
  )
  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source'] = $Server
  $builder['Initial Catalog'] = $Database
  $builder['Encrypt'] = $true
  $builder['TrustServerCertificate'] = $false
  $builder['Integrated Security'] = $false
  $builder['Connect Timeout'] = 7
  $builder['Application Name'] = 'Jawafa_UserRead_ReadOnly_Verification'
  $builder['ApplicationIntent'] = 'ReadOnly'
  $connection = [System.Data.SqlClient.SqlConnection]::new(
    $builder.ConnectionString
  )
  $connection.Credential = $sqlCredential
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandTimeout = 10

  # Metadata only: not one invoice/cheque/journal/inventory row is queried.
  # Each result is returned only as a role/permission boolean or total count.
  $command.CommandText = @'
SELECT
  CONVERT(nvarchar(128), ORIGINAL_LOGIN()) AS sql_login,
  DB_NAME() AS database_name,
  COALESCE(IS_SRVROLEMEMBER('sysadmin'), -1) AS sysadmin_role,
  COALESCE(IS_MEMBER('db_owner'), -1) AS owner_role,
  COALESCE(IS_MEMBER('db_datawriter'), -1) AS writer_role,
  COALESCE(IS_MEMBER('db_ddladmin'), -1) AS ddl_role,
  COALESCE(IS_MEMBER('db_datareader'), -1) AS broad_reader_role,
  (
    SELECT COUNT_BIG(*)
      FROM sys.tables t
     WHERE t.is_ms_shipped = 0
       AND (
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(t.schema_id))
           + '.' + QUOTENAME(t.name), 'OBJECT', 'INSERT'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(t.schema_id))
           + '.' + QUOTENAME(t.name), 'OBJECT', 'UPDATE'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(t.schema_id))
           + '.' + QUOTENAME(t.name), 'OBJECT', 'DELETE'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(t.schema_id))
           + '.' + QUOTENAME(t.name), 'OBJECT', 'ALTER'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(SCHEMA_NAME(t.schema_id))
           + '.' + QUOTENAME(t.name), 'OBJECT', 'CONTROL'), 0) = 1
       )
  ) AS writable_table_count,
  (
    SELECT COUNT_BIG(*)
      FROM sys.schemas s
     WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
       AND (
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(s.name),
           'SCHEMA', 'INSERT'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(s.name),
           'SCHEMA', 'UPDATE'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(s.name),
           'SCHEMA', 'DELETE'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(s.name),
           'SCHEMA', 'ALTER'), 0) = 1 OR
         COALESCE(HAS_PERMS_BY_NAME(QUOTENAME(s.name),
           'SCHEMA', 'CONTROL'), 0) = 1
       )
  ) AS writable_schema_count,
  (
    SELECT COUNT_BIG(*)
      FROM sys.fn_my_permissions(NULL, 'DATABASE')
     WHERE permission_name IN ('INSERT','UPDATE','DELETE','ALTER',
         'CONTROL','CREATE TABLE','CREATE VIEW','TAKE OWNERSHIP')
  ) AS database_mutation_permissions
'@
  $reader = $command.ExecuteReader()
  if (-not $reader.Read()) { throw 'SQL_IDENTITY_RESULT_EMPTY' }
  $login = $reader.GetString(0)
  $db = $reader.GetString(1)
  $facts = @{
    Connected = $true
    Login = $login
    Database = $db
    EncryptedAndTrustedTls = $true # Open() requires Encrypt=True and valid cert.
    Sysadmin = [int]$reader.GetValue(2)
    DbOwner = [int]$reader.GetValue(3)
    DbWriter = [int]$reader.GetValue(4)
    DdlAdmin = [int]$reader.GetValue(5)
    DbReader = [int]$reader.GetValue(6)
    WritableObjects = [long]$reader.GetValue(7)
    WritableSchemas = [long]$reader.GetValue(8)
    WritableDatabasePermissions = [long]$reader.GetValue(9)
    ApprovedViewCount = $ApprovedViews.Count
    SelectableApprovedViews = 0
  }
  $reader.Close()
  $reader = $null

  # Check only named approved views by passing the name as a SQL parameter.
  # This checks effective permissions; it never SELECTs any financial rows.
  foreach ($view in $ApprovedViews) {
    $command.Parameters.Clear()
    $command.CommandText =
      "SELECT COALESCE(HAS_PERMS_BY_NAME(@view, 'OBJECT', 'SELECT'), 0)"
    $param = $command.Parameters.Add('@view',
      [System.Data.SqlDbType]::NVarChar, 258)
    $param.Value = $view
    $hasSelect = [int]$command.ExecuteScalar()
    if ($hasSelect -eq 1) { $facts.SelectableApprovedViews += 1 }
  }

  $result = Get-UserReadVerdict $facts
  [pscustomobject]@{
    status = $result.status
    loginIsUserRead = ($facts.Login -ceq 'user_read')
    databaseIsJawafa = ($facts.Database -ceq 'Jawafa_DB')
    trustedTlsRequired = $true
    broadDbDataReader = ($facts.DbReader -eq 1)
    approvedViewCount = $facts.ApprovedViewCount
    selectGrantedOnApprovedViewCount = $facts.SelectableApprovedViews
    metadataMutationObjectCount = $facts.WritableObjects
    metadataMutationSchemaCount = $facts.WritableSchemas
    metadataMutationDatabasePermissionCount =
      $facts.WritableDatabasePermissions
    blockers = $result.blockers
    verifiedOriginalFinancialRowCount = 0
    productionApproved = $false
  } | ConvertTo-Json -Depth 4 -Compress
  if ($result.status -ne 'ELIGIBLE_FOR_INDEPENDENT_REVIEW') { exit 2 }
} catch {
  # Log only a non-sensitive failure code/class. Never echo exception.Message:
  # it can contain internal host or user/credential metadata.
  [pscustomobject]@{
    status = 'BLOCKED'
    failureType = $_.Exception.GetType().Name
    noCredentialOrFinancialContentReturned = $true
    productionApproved = $false
  } | ConvertTo-Json -Compress
  exit 2
} finally {
  if ($reader) { $reader.Close() }
  if ($command) { $command.Dispose() }
  if ($connection) { $connection.Dispose() }
  $credential = $null
  $sqlCredential = $null
}
