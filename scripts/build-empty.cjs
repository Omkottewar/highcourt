// Builds an independent import-testing edition without changing the office app.
const fs = require('node:fs')
const path = require('node:path')
const { build, Platform } = require('electron-builder')
const root = path.join(__dirname, '..')
const original = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const stage = path.join(root, '.cache', 'empty-edition')
fs.mkdirSync(stage, { recursive: true })
fs.cpSync(path.join(root, 'build'), path.join(stage, 'build'), { recursive: true })
fs.cpSync(path.join(root, 'desktop'), path.join(stage, 'desktop'), { recursive: true, filter: source => !source.endsWith('.test.cjs') })
let main = fs.readFileSync(path.join(stage, 'desktop/main.cjs'), 'utf8')
main = main.replace("const indexPath =", "app.setName('CourtDesk Import Test')\napp.setPath('userData', path.join(app.getPath('appData'), 'CourtDesk Import Test'))\n\nconst indexPath =")
main = main.replace("title: 'High Court Case Management'", "title: 'CourtDesk Import Test — Empty Edition'")
const start = main.indexOf('    const seed=')
const end = main.indexOf('    register=openRegister(filename)', start)
if (start < 0 || end < 0) throw new Error('Could not locate seed initialization; refusing to build an ambiguous edition.')
main = main.slice(0, start) + main.slice(end)
fs.writeFileSync(path.join(stage, 'desktop/main.cjs'), main)
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: 'courtdesk-import-test', productName: 'CourtDesk Import Test', version: original.version,
  private: true, main: 'desktop/main.cjs', description: 'Separate empty CourtDesk edition for testing Excel and CSV imports',
}, null, 2))
build({ projectDir: stage, targets: Platform.WINDOWS.createTarget('nsis'), config: {
  ...original.build, appId: 'com.highcourt.casemanagement.importtest', productName: 'CourtDesk Import Test',
  directories: { app: stage, output: path.join(root, 'desktop-empty-dist') },
  electronVersion: require('electron/package.json').version, extraResources: [],
  nsis: { ...original.build.nsis, shortcutName: 'CourtDesk Import Test', uninstallDisplayName: 'CourtDesk Import Test' },
} }).catch(error => { console.error(error); process.exitCode = 1 })
