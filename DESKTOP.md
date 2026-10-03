# CourtDesk ? fully offline Windows app

CourtDesk 2.0 uses SQLite on this computer. No account, cloud credentials, internet connection or database server is required. Create, edit, delete, search, filter, sort, import, print and export work locally.

## Install and use

Run `desktop-dist/High Court Case Management Setup 2.0.2.exe`. The first launch copies the supplied register into the current Windows user's application-data folder. The exact location is shown under **Local database**. Later launches and upgrades keep this working database; they never replace it with the initial dataset.

The supplied register comes from the root `highcourt_export.csv`: 52,500 records were imported and 27 rows were held for correction. See `data/migration-review.csv` for source row numbers and reasons. The original CSV remains unchanged. The installer includes this office dataset, so distribute it only to intended users of these records.

The root CSV is the migration source; changes that existed only in the former online database or its downloaded browser copy are not included. The previous downloaded copy is left intact. Export any additional records to Excel/CSV and use **Import records** to review and add them locally. There is no ongoing synchronization.

## Backups

Choose **Local database ? Back up database** to save a complete `.sqlite` backup, preferably to another drive. **Restore backup** asks for a file and confirmation before replacing current records. A safety backup is created in the local data folder before restoration. Invalid backups are rejected without changing the register.

A daily backup is made when the app starts with existing records. These backups stay in the `data/backups` folder next to the working database and are retained until manually removed. They do not protect against loss of the entire drive. Backups contain case records, attached PDFs, and custom titles/types/advocates; saved views and interface preferences are separate device settings.

## Case management

Use Ctrl + K to search; choose the field and matching mode. Combine district, case type, year, date range, advocate, respondent and remark filters. Sort by two fields, choose columns, set row density and save named views. Districts and case types include the supplied office lists and existing local values. Add titles, case types (short code and full form), and advocates from the case form. Title and Type are separate selections pending confirmation of their mapping.

Registration number and year together identify a case for duplicate detection. Each local row also has an internal ID so edits and deletions target exactly one record. The highlighted PDF registration label shows only the registration number.

Each case can have one PDF attachment (up to 50 MB). Select a file in New Case or Edit Case; saving replaces the previous attachment. Download it from case details. The generated case sheet is separate: its top line uses the selected Title and leaves the number and year suffix blank for handwriting. Respondent numbers are editable beside names. New entries default to the current local date and year.

## Excel / CSV import and export

Use **Import** to select Excel or CSV, map columns and review validation and duplicates. Headerless legacy root CSV columns are recognized. Existing registration/year identities are skipped; duplicate identities within the selected file and invalid rows are held back. Download the review report to locate corrections. The final local insert is one transaction: either all valid new rows are saved, or none are.

Use **Export records** to choose Excel or CSV, all matching results/current page/selected rows, and output columns. Filters and sorting are preserved. **Print / Save PDF** opens the case document; select a PDF destination and A4 paper in the print dialog. Fonts are bundled locally.

## Development and validation

Use Node.js 22.17 or later:

```powershell
npm ci
npm run desktop
npm test
npm run test:database
npm run desktop:dist
```

The desktop app is required for database operations; `npm start` alone does not expose the local SQLite file to a browser. No `.env` configuration is required. The SQLite implementation uses the runtime's built-in `node:sqlite`; there are no external native database modules to install.

`node scripts/migrate-local.cjs [source.csv] [new-database.sqlite]` prepares a new database and review report from a spreadsheet; it refuses to overwrite a destination. Default output is `data/initial-register.sqlite`, which is bundled by the installer build. Keep this local data directory available when rebuilding the office installer.

After building, run `node_modules/.bin/electron scripts/local-smoke.cjs` for isolated synthetic-data tests of offline CRUD, real spreadsheet import, exports, PDF content, persistence and backup/restore. Add `--packaged` to test the packaged application code. Remove `ELECTRON_RUN_AS_NODE` from the terminal environment first if it is set. `scripts/pdf-review.cjs` generates fictional PDF layout samples.

Legacy cloud scripts and configuration have been moved into ignored `.cache/legacy-cloud` for reference. They are not used or packaged. The app blocks outgoing HTTP, HTTPS and WebSocket requests.

## Separate empty import-test edition

`desktop-empty-dist/CourtDesk Import Test Setup 2.0.0.exe` installs **CourtDesk Import Test** alongside the original office app. It has a distinct application identity, shortcut and local profile (`%APPDATA%/CourtDesk Import Test`). It includes no case dataset and starts with zero records on first use. Import Excel/CSV through the usual reviewed import dialog. Imported records persist across restarts; reinstalling does not clear them.

The original app, populated installer and working database are unchanged. Build the empty edition from the current production bundle with `node scripts/build-empty.cjs`. Run `node_modules/.bin/electron scripts/local-smoke.cjs --empty` to verify it in an isolated test profile.
