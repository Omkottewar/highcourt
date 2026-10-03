param(
  [Parameter(Mandatory=$true)][string]$AppExe,
  [Parameter(Mandatory=$true)][string]$DatabasePath,
  [Parameter(Mandatory=$true)][string]$Destination,
  [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')][string]$Time = '18:00',
  [ValidateSet('Office','ImportTest')][string]$Edition = 'Office'
)
$ErrorActionPreference = 'Stop'
$AppExe = (Resolve-Path -LiteralPath $AppExe).Path
$DatabasePath = (Resolve-Path -LiteralPath $DatabasePath).Path
if (-not [IO.Path]::IsPathRooted($Destination)) { throw 'Choose an absolute destination folder path.' }
$taskName = "CourtDesk Daily Backup - $Edition"
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw "A schedule already exists: $taskName. Review it in Task Scheduler before replacing it." }
$installFolder = Join-Path $env:LOCALAPPDATA "CourtDesk Backup\$Edition"
New-Item -ItemType Directory -Path $installFolder -Force | Out-Null
foreach ($name in @('backup.cjs','Run-Backup.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $installFolder $name) -Force }
$configPath = Join-Path $installFolder 'config.json'
@{ appExe=$AppExe; databasePath=$DatabasePath; destination=$Destination } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
# Complete and verify a backup before registering an unattended schedule.
& (Join-Path $installFolder 'Run-Backup.ps1') -ConfigPath $configPath
$runner = Join-Path $installFolder 'Run-Backup.ps1'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runner + '" -ConfigPath "' + $configPath + '"'
$action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($Time,'HH:mm',$null))
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Verified CourtDesk SQLite backup; no app window required.' | Out-Null
Write-Output "Daily backup installed for $Time while this Windows user is signed in. Missed runs are attempted when available. Destination: $Destination"
