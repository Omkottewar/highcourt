# Automatic daily CourtDesk backups

Configured on this PC at 18:00 local time for both installed editions:

- Office: `D:\CourtDesk Backups\Office`
- Import test: `D:\CourtDesk Backups\ImportTest`

The tasks are named `CourtDesk Daily Backup - Office` and `CourtDesk Daily Backup - ImportTest` in Windows Task Scheduler. They use the installed app's bundled SQLite runtime, so no separate SQLite or Node installation is required. CourtDesk can be closed. The PC must be on and this Windows user signed in; missed runs are attempted when available. Failures are retried three times at 15-minute intervals.

Each run creates a dated, verified `.sqlite` file. It uses SQLite's consistent backup API while the app is open, including committed data in the write-ahead log. Existing backups are retained; no automatic deletion is configured. Restore a chosen file through CourtDesk's Local database ? Restore backup.

The installed helper/configuration and `backup-log.jsonl` are in `%LOCALAPPDATA%\CourtDesk Backup\Office` and `ImportTest`. Check Task Scheduler's Last Run Result (0 means success) or the JSON log. If the application executable moves, update `appExe` in its config.json.

For another PC, copy this folder and run `Install-DailyBackup.ps1` with `-AppExe`, `-DatabasePath`, `-Destination`, optional `-Time 18:00` and `-Edition Office` or `ImportTest`. Find the working database path in the app's Local database panel. Setup verifies an initial backup before registering a task and refuses to replace an existing task automatically.

These schedules are set up on this PC only; they are not part of the app installers. A folder on the same PC protects against accidental record changes but not loss of that PC or drive.
