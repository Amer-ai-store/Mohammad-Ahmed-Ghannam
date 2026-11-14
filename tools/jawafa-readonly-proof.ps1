#Requires -Version 5.1
<#
.SYNOPSIS
    Offline-capable, fail-closed ON-HOST SQL Server reader verification.
.DESCRIPTION
    Run ONLY on the authorized Windows host under the SAME Windows user that
    originally exported the DPAPI PSCredential. No SQL writes, DDL or SQL
    dynamic financial queries. A successful synthetic test is NOT live proof.
    A successful live session is NOT independent release authorization.
    Never upload raw output or Windows credential files to public GitHub.
.EXAMPLE
    .\tools\jawafa-readonly-proof.ps1 -SelfTest
.EXAMPLE
    .\tools\jawafa-readonly-proof.ps1 -ServerInstance 'SQL-CERT-VALID-NAME' `
      -CredentialPath '(private DPAPI file path)' -ApprovedViews 'dbo.ApprovedReadOnlyView'
#>
[CmdletBinding()]
param(
    [switch] $SelfTest,
    [string] $ServerInstance = '',
    [string] $CredentialPath = '',
    [string[]] $ApprovedViews = @(),
    [string] $Database = 'Jawafa_DB'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-SessionFacts {
    param([System.Collections.IDictionary] $Facts)
    return (
        $Facts['login'] -ceq 'user_read' -and
        $Facts['database'] -ceq 'Jawafa_DB' -and
        $Facts['tls_cert_verified'] -eq $true -and
        $Facts['views_verified'] -eq $true -and
        $Facts['db_owner'] -eq 0 -and
        $Facts['db_securityadmin'] -eq 0 -and
        $Facts['db_ddladmin'] -eq 0 -and
        $Facts['db_accessadmin'] -eq 0 -and
        $Facts['db_datareader'] -eq 0 -and
        $Facts['db_datawriter'] -eq 0 -and
        $Facts['sysadmin'] -eq 0 -and
        $Facts['db_insert'] -eq 0 -and
        $Facts['db_update'] -eq 0 -and
        $Facts['db_delete'] -eq 0 -and
        $Facts['db_control'] -eq 0 -and
        $Facts['db_execute'] -eq 0 -and
        $Facts['db_alter'] -eq 0 -and
        $Facts['db_take_ownership'] -eq 0
    )
}

if ($SelfTest) {
    $base = @{
        login = 'user_read'; database = 'Jawafa_DB'
        tls_cert_verified = $true; views_verified = $true
        db_owner = 0; db_securityadmin = 0; db_ddladmin = 0
        db_accessadmin = 0; db_datareader = 0; db_datawriter = 0
        sysadmin = 0; db_insert = 0; db_update = 0; db_delete = 0
        db_control = 0; db_execute = 0; db_alter = 0
        db_take_ownership = 0
    }
    $cases = @(
        @{ Name = 'positive synthetic'; Change = @{}; Expected = $true },
        @{ Name = 'deny sa'; Change = @{login='sa'}; Expected = $false },
        @{ Name = 'deny incorrect db'; Change = @{database='master'}; Expected = $false },
        @{ Name = 'deny unverified tls'; Change = @{tls_cert_verified=$false}; Expected = $false },
        @{ Name = 'deny missing view evidence'; Change = @{views_verified=$false}; Expected = $false },
        @{ Name = 'deny broad reader role'; Change = @{db_datareader=1}; Expected = $false },
        @{ Name = 'deny owner role'; Change = @{db_owner=1}; Expected = $false },
        @{ Name = 'deny writer role'; Change = @{db_datawriter=1}; Expected = $false },
        @{ Name = 'deny sysadmin'; Change = @{sysadmin=1}; Expected = $false },
        @{ Name = 'deny insert'; Change = @{db_insert=1}; Expected = $false },
        @{ Name = 'deny update'; Change = @{db_update=1}; Expected = $false },
        @{ Name = 'deny delete'; Change = @{db_delete=1}; Expected = $false },
        @{ Name = 'deny control'; Change = @{db_control=1}; Expected = $false },
        @{ Name = 'deny database execute'; Change = @{db_execute=1}; Expected = $false },
        @{ Name = 'deny database alter'; Change = @{db_alter=1}; Expected = $false },
        @{ Name = 'deny ownership takeover'; Change = @{db_take_ownership=1}; Expected = $false }
    )
    foreach ($case in $cases) {
        $facts = @{}
        foreach ($key in $base.Keys) { $facts[$key] = $base[$key] }
        foreach ($key in $case.Change.Keys) { $facts[$key] = $case.Change[$key] }
        if ((Test-SessionFacts $facts) -ne $case.Expected) {
            throw ('SELF_TEST_FAILED: ' + $case.Name)
        }
    }
    Write-Output ('PASS: ' + $cases.Count + ' synthetic, no-network, no-secret SQL release-gate cases')
    exit 0
}

$script:Report = [ordered]@{
    proof_type = 'ON_HOST_SQL_READER_GATE'
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    result = 'BLOCKED'
    reason_code = $null
    dpapi_credential_imported = $false
    sql_connection_opened = $false
    tls_client_certificate_validated = $false
    sql_identity_verified = $false
    schema_permissions_checked = $false
    approved_views_checked = 0
    approved_views_passed = 0
    per_view_results = @()
    independent_security_review = 'REQUIRED_NOT_PROVIDED_BY_THIS_TEST'
    server_level_grants_review = 'REQUIRED_SEPARATE_DBA_ATTESTATION'
    production_release_approved = $false
}
function Stop-Blocked([string] $ReasonCode) {
    $script:Report.reason_code = $ReasonCode
    $script:Report | ConvertTo-Json -Depth 6 -Compress
    exit 2
}
if ([string]::IsNullOrWhiteSpace($ServerInstance) -or
    [string]::IsNullOrWhiteSpace($CredentialPath) -or
    $ApprovedViews.Count -eq 0 -or $Database -cne 'Jawafa_DB') {
    Stop-Blocked 'MISSING_HOST_CREDENTIAL_OR_APPROVED_VIEWS'
}
if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) {
    Stop-Blocked 'DPAPI_FILE_NOT_ACCESSIBLE_TO_CURRENT_WINDOWS_USER'
}
$seen = @{}
foreach ($view in $ApprovedViews) {
    if ($view -cnotmatch '^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$') {
        Stop-Blocked 'APPROVED_VIEW_IDENTIFIERS_MUST_BE_SCHEMA_QUALIFIED'
    }
    if ($seen.ContainsKey($view.ToLowerInvariant())) {
        Stop-Blocked 'DUPLICATED_APPROVED_VIEW'
    }
    $seen[$view.ToLowerInvariant()] = $true
}
try {
    $credential = Import-Clixml -LiteralPath $CredentialPath -ErrorAction Stop
    if ($credential -isnot [System.Management.Automation.PSCredential] -or
        $credential.UserName -cne 'user_read') {
        Stop-Blocked 'DPAPI_OBJECT_IS_NOT_SQL_USER_READ'
    }
    $script:Report.dpapi_credential_imported = $true
} catch {
    Stop-Blocked 'DPAPI_IMPORT_OR_WINDOWS_IDENTITY_FAILED'
}

# SqlCredential keeps the password out of the connection string and all logs.
# TLS is mandatory and server certificate trust is never bypassed.
$connection = $null
try {
    Add-Type -AssemblyName System.Data
    $securePassword = $credential.Password
    if (-not $securePassword.IsReadOnly()) { $securePassword.MakeReadOnly() }
    $sqlCredential = [System.Data.SqlClient.SqlCredential]::new('user_read', $securePassword)
    $builder = [System.Data.SqlClient.SqlConnectionStringBuilder]::new()
    $builder.DataSource = $ServerInstance
    $builder.InitialCatalog = 'Jawafa_DB'
    $builder.IntegratedSecurity = $false
    $builder.Encrypt = $true
    $builder.TrustServerCertificate = $false
    $builder.ConnectTimeout = 10
    $builder.ApplicationName = 'Jawafa-Reader-Gate'
    $connection = [System.Data.SqlClient.SqlConnection]::new($builder.ConnectionString)
    $connection.Credential = $sqlCredential
    $connection.Open()
    $script:Report.sql_connection_opened = $true
    $script:Report.tls_client_certificate_validated = $true
} catch {
    if ($null -ne $connection) { $connection.Dispose() }
    Stop-Blocked 'SQL_AUTH_NETWORK_OR_TRUSTED_TLS_FAILED'
}

try {
    # Every server-side command below is SELECT only.
    $sql = @'
SELECT CAST(ORIGINAL_LOGIN() AS NVARCHAR(128)) AS login_name,
       CAST(DB_NAME() AS NVARCHAR(128)) AS database_name,
       ISNULL(IS_MEMBER(N'db_owner'), -1) AS db_owner,
       ISNULL(IS_MEMBER(N'db_securityadmin'), -1) AS db_securityadmin,
       ISNULL(IS_MEMBER(N'db_ddladmin'), -1) AS db_ddladmin,
       ISNULL(IS_MEMBER(N'db_accessadmin'), -1) AS db_accessadmin,
       ISNULL(IS_MEMBER(N'db_datareader'), -1) AS db_datareader,
       ISNULL(IS_MEMBER(N'db_datawriter'), -1) AS db_datawriter,
       ISNULL(IS_SRVROLEMEMBER(N'sysadmin'), -1) AS sysadmin,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'INSERT'), -1) AS db_insert,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'UPDATE'), -1) AS db_update,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'DELETE'), -1) AS db_delete,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CONTROL'), -1) AS db_control,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'EXECUTE'), -1) AS db_execute,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'ALTER'), -1) AS db_alter,
       ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'TAKE OWNERSHIP'), -1) AS db_take_ownership
'@
    $command = $connection.CreateCommand()
    $command.CommandText = $sql
    $command.CommandTimeout = 10
    $reader = $command.ExecuteReader()
    try {
        if (-not $reader.Read()) { throw 'NO_SQL_SESSION_RESULT' }
        $facts = @{
            login = [string]$reader['login_name']
            database = [string]$reader['database_name']
            tls_cert_verified = $true
            views_verified = $false
        }
        foreach ($field in @(
            'db_owner','db_securityadmin','db_ddladmin','db_accessadmin',
            'db_datareader','db_datawriter','sysadmin','db_insert',
            'db_update','db_delete','db_control','db_execute',
            'db_alter','db_take_ownership'
        )) { $facts[$field] = [int]$reader[$field] }
    } finally { $reader.Close(); $command.Dispose() }

    $script:Report.sql_identity_verified =
        ($facts['login'] -ceq 'user_read' -and $facts['database'] -ceq 'Jawafa_DB')
    $script:Report.schema_permissions_checked = $true
    $allViewsPass = $true
    foreach ($view in $ApprovedViews) {
        $objectCommand = $connection.CreateCommand()
        $objectCommand.CommandTimeout = 10
        $objectCommand.CommandText = @'
SELECT CASE WHEN OBJECT_ID(@obj, N'V') IS NOT NULL THEN 1 ELSE 0 END,
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'SELECT'), -1),
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'INSERT'), -1),
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'UPDATE'), -1),
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'DELETE'), -1),
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'ALTER'), -1),
       ISNULL(HAS_PERMS_BY_NAME(@obj, N'OBJECT', N'CONTROL'), -1)
'@
        [void]$objectCommand.Parameters.Add('@obj', [System.Data.SqlDbType]::NVarChar, 261)
        $objectCommand.Parameters['@obj'].Value = $view
        $viewReader = $objectCommand.ExecuteReader()
        try {
            if (-not $viewReader.Read()) { throw 'OBJECT_PERMISSION_PROBE_EMPTY' }
            $isView = ([int]$viewReader.GetValue(0) -eq 1)
            $selectOk = ([int]$viewReader.GetValue(1) -eq 1)
            $noWrites = (
                [int]$viewReader.GetValue(2) -eq 0 -and
                [int]$viewReader.GetValue(3) -eq 0 -and
                [int]$viewReader.GetValue(4) -eq 0 -and
                [int]$viewReader.GetValue(5) -eq 0 -and
                [int]$viewReader.GetValue(6) -eq 0
            )
        } finally { $viewReader.Close(); $objectCommand.Dispose() }

        $shapeReadOk = $false
        if ($isView -and $selectOk -and $noWrites) {
            # Identifier is validated above: no user input can inject SQL syntax.
            $parts = $view.Split('.')
            $probe = $connection.CreateCommand()
            $probe.CommandText = 'SELECT TOP (0) 1 FROM [' + $parts[0] + '].[' + $parts[1] + ']'
            $probe.CommandTimeout = 10
            try {
                $probeReader = $probe.ExecuteReader()
                $probeReader.Close()
                $shapeReadOk = $true
            } catch {
                $shapeReadOk = $false
            } finally { $probe.Dispose() }
        }
        $passed = ($isView -and $selectOk -and $noWrites -and $shapeReadOk)
        $script:Report.approved_views_checked++
        if ($passed) { $script:Report.approved_views_passed++ }
        else { $allViewsPass = $false }
        $script:Report.per_view_results += @{
            name = $view; is_view = $isView; select_only = ($selectOk -and $noWrites)
            select_shape_verified = $shapeReadOk; passed = $passed
        }
    }
    $facts['views_verified'] = $allViewsPass
    if (Test-SessionFacts $facts) {
        $script:Report.result = 'SESSION_GATE_PASS_NOT_RELEASE_APPROVAL'
        $script:Report.reason_code = 'INDEPENDENT_DBA_AND_SECURITY_ACCEPTANCE_PENDING'
        $script:Report | ConvertTo-Json -Depth 6 -Compress
        exit 0
    }
    Stop-Blocked 'SQL_LOGIN_TLS_OR_LEAST_PRIVILEGE_SCOPE_NOT_ACCEPTED'
} catch {
    # Intentional no exception details: messages can contain connection strings.
    Stop-Blocked 'SQL_PROOF_EXECUTION_FAILED'
} finally {
    if ($null -ne $connection) { $connection.Dispose() }
}
