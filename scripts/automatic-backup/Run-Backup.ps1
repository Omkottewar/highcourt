param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $config.appExe -PathType Leaf)) { throw 'The CourtDesk executable was not found.' }
$previousMode = $env:ELECTRON_RUN_AS_NODE
$previousConfig = $env:COURTDESK_BACKUP_CONFIG
try {
  $env:ELECTRON_RUN_AS_NODE = '1'
  $env:COURTDESK_BACKUP_CONFIG = (Resolve-Path -LiteralPath $ConfigPath).Path
  $helper = Join-Path $PSScriptRoot 'backup.cjs'
  $process = Start-Process -FilePath $config.appExe -ArgumentList ('"' + $helper + '"') -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Backup failed (exit $($process.ExitCode)). See backup-log.jsonl next to the configuration." }
} finally {
  $env:ELECTRON_RUN_AS_NODE = $previousMode
  $env:COURTDESK_BACKUP_CONFIG = $previousConfig
}
