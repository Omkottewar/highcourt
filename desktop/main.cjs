const { app, BrowserWindow, dialog, ipcMain, Menu, session } = require('electron')
Menu.setApplicationMenu(null)
const path = require('node:path')
const fsp = require('node:fs/promises')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const { openRegister } = require('./database.cjs')
const { startServer } = require('./server.cjs')
const { readConfig, writeConfig } = require('./config.cjs')

const indexPath = path.join(__dirname, '../build/index.html')
const appURL = pathToFileURL(indexPath).href
let mainWindow
let register
let serverInstance
let currentConfig = { mode: null, serverUrl: null }
let localUser = null

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1440, height: 960, minWidth: 1000, minHeight: 700,
    title: 'High Court Case Management',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      additionalArguments: [
        `--courtdesk-mode=${currentConfig.mode || 'unset'}`,
        `--courtdesk-server=${currentConfig.serverUrl || ''}`,
      ],
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== appURL) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => ({
    action: url === 'about:blank' ? 'allow' : 'deny',
    overrideBrowserWindowOptions: {
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: undefined },
    },
  }))
  mainWindow.webContents.on('did-create-window', child => {
    child.webContents.on('will-navigate', event => event.preventDefault())
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })
  mainWindow.loadFile(indexPath)
}

ipcMain.handle('save-excel', async (event, filename, bytes) => {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url.split('#')[0] !== appURL) throw new Error('Invalid export sender')
  if (!/^cases_(export|import_report)_\d{4}-\d{2}-\d{2}\.(xlsx|csv)$/.test(filename) ||
      !(bytes instanceof ArrayBuffer) || bytes.byteLength > 200 * 1024 * 1024) {
    throw new Error('Invalid case export')
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save case export', defaultPath: path.join(app.getPath('documents'), filename),
    filters: filename.endsWith('.csv') ? [{ name: 'CSV file', extensions: ['csv'] }] : [{ name: 'Excel workbook', extensions: ['xlsx'] }],
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await fsp.writeFile(result.filePath, Buffer.from(bytes))
  return { canceled: false }
})

ipcMain.handle('courtdesk-config', () => currentConfig)
ipcMain.handle('courtdesk-local-has-admin', () => {
  if (!register) throw new Error('Local database is not open.')
  return register.hasAnyAdmin()
})
ipcMain.handle('courtdesk-local-create-first-admin', (event, username, password) => {
  if (!register) throw new Error('Local database is not open.')
  if (register.hasAnyAdmin()) throw new Error('An admin account already exists on this PC.')
  register.createUser({ username, password, role: 'admin', created_by: 'setup' })
  const result = register.login(username, password)
  if (!result) throw new Error('Could not sign in after creating the admin account.')
  localUser = result.user
  return result
})
ipcMain.handle('courtdesk-local-login', (event, username, password) => {
  if (!register) throw new Error('Local database is not open.')
  const result = register.login(username, password)
  if (!result) throw new Error('Invalid username or password.')
  localUser = result.user
  return result
})
ipcMain.handle('courtdesk-local-logout', (event, token) => {
  if (register && token) register.sessionDelete(token)
  localUser = null
  return { ok: true }
})
ipcMain.handle('courtdesk-local-me', (event, token) => {
  if (!register || !token) return null
  const user = register.sessionLookup(token)
  if (user) localUser = user
  else localUser = null
  return user
})
ipcMain.handle('courtdesk-set-mode', async (event, mode, serverUrl) => {
  if (!['main','client'].includes(mode)) throw new Error('Invalid mode')
  if (mode === 'client') {
    const url = String(serverUrl || '').trim()
    if (!/^https?:\/\/.+/.test(url)) throw new Error('Enter a valid server URL (e.g. http://192.168.1.10:4788)')
    writeConfig(app.getPath('userData'), { mode: 'client', serverUrl: url })
  } else {
    writeConfig(app.getPath('userData'), { mode: 'main', serverUrl: null })
  }
  app.relaunch()
  app.exit(0)
})
ipcMain.handle('courtdesk-reset-mode', () => {
  writeConfig(app.getPath('userData'), { mode: null, serverUrl: null })
  app.relaunch()
  app.exit(0)
})

const ADMIN_OPS = new Set(['create','update','delete','import','keys','next','addMaster','backup','restore','listUsers','createUser','updateUser','editLog'])
const CLERK_OPS = new Set(['search','all','info','titles','types','districts','advocates','pdf','updateCaseNumber'])

ipcMain.handle('local-database', async (event, operation, payload) => {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== appURL) throw new Error('Invalid database sender')
  if (currentConfig.mode !== 'main' || !register) return { error: 'Local database is only available in main-server mode.' }
  if (!localUser) return { error: 'Not authenticated.' }
  if (ADMIN_OPS.has(operation) && localUser.role !== 'admin') return { error: 'Admin access required.' }
  if (!ADMIN_OPS.has(operation) && !CLERK_OPS.has(operation)) return { error: 'Unknown database operation.' }
  const actor = { id: localUser.id, username: localUser.username }
  try {
    let value
    switch(operation) {
      case 'search': value=register.search(payload); break
      case 'all': value=register.search(payload,true); break
      case 'create': value=register.create(payload); register.logAction({ user_id: actor.id, username: actor.username, action: 'case.create', case_id: value.id, case_regd_no: value.RegdNo, case_year: value.CYear }); break
      case 'update': value=register.update(payload.key,payload.data); register.logAction({ user_id: actor.id, username: actor.username, action: 'case.update', case_id: value.id, case_regd_no: value.RegdNo, case_year: value.CYear }); break
      case 'delete': value=register.delete(payload); register.logAction({ user_id: actor.id, username: actor.username, action: 'case.delete', case_regd_no: payload?.RegdNo, case_year: payload?.CYear }); break
      case 'import': value=register.importRows(payload); register.logAction({ user_id: actor.id, username: actor.username, action: 'case.import', changes: { imported: value.imported, skipped: value.skipped } }); break
      case 'updateCaseNumber': value=register.updateCaseNumber(payload.key, payload.caseNumber, actor); break
      case 'keys': value=register.keys(); break
      case 'next': value=register.next(); break
      case 'districts': value=register.districts(); break
      case 'titles': value=register.titles(); break
      case 'addMaster': value=register.addMaster(payload); break
      case 'pdf': value=register.pdf(payload); break
      case 'types': value=register.types(); break
      case 'advocates': value=register.advocates(payload); break
      case 'info': value=register.info(); break
      case 'listUsers': value=register.listUsers(); break
      case 'createUser': value=register.createUser({ ...payload, created_by: actor.username }); break
      case 'updateUser': value=register.updateUser(payload.id, payload.patch, actor); break
      case 'editLog': value=register.editLog(payload || {}); break
      case 'backup': {
        const chosen=await dialog.showSaveDialog(mainWindow,{title:'Back up local database',defaultPath:path.join(app.getPath('documents'),`CourtDesk-backup-${new Date().toISOString().slice(0,10)}.sqlite`),filters:[{name:'CourtDesk database',extensions:['sqlite']}]})
        value=chosen.canceled?{canceled:true}:register.backup(chosen.filePath); break
      }
      case 'restore': {
        const chosen=await dialog.showOpenDialog(mainWindow,{title:'Restore CourtDesk database backup',properties:['openFile'],filters:[{name:'CourtDesk database',extensions:['sqlite']}]})
        if(chosen.canceled) {value={canceled:true};break}
        const confirmation=await dialog.showMessageBox(mainWindow,{type:'warning',buttons:['Cancel','Restore backup'],defaultId:0,cancelId:0,title:'Replace local register?',message:'Restore this backup and replace the current local records?',detail:'A safety backup of your current database will be kept in the backups folder before restoring.'})
        value=confirmation.response===1?register.restore(chosen.filePaths[0]):{canceled:true};break
      }
      default: throw new Error('Unknown database operation')
    }
    return {value}
  } catch(error) {
    return {error: /UNIQUE constraint/i.test(error.message)?'A case with this registration number and year already exists.':error.message}
  }
})

function applyNetworkPolicy(mode, serverUrl) {
  const defaultSession = session.defaultSession
  if (mode === 'client' && serverUrl) {
    let allowedHost = ''
    try { allowedHost = new URL(serverUrl).host } catch {}
    defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (details, cb) => {
      try { const du = new URL(details.url); cb({ cancel: du.host !== allowedHost }) }
      catch { cb({ cancel: true }) }
    })
  } else {
    defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (_, cb) => cb({ cancel: true }))
  }
}

app.whenReady().then(async () => {
  try {
    currentConfig = readConfig(app.getPath('userData'))
    if (currentConfig.mode === 'main') {
      const filename = path.join(app.getPath('userData'), 'data', 'courtdesk.sqlite')
      const seed = app.isPackaged ? path.join(process.resourcesPath, 'initial-register.sqlite') : path.join(__dirname, '../data/initial-register.sqlite')
      if (!fs.existsSync(filename) && fs.existsSync(seed)) {
        await fsp.mkdir(path.dirname(filename), { recursive: true })
        await fsp.copyFile(seed, filename + '.initializing')
        await fsp.rename(filename + '.initializing', filename)
      }
      register = openRegister(filename)
      if (register.info().count) {
        const daily = path.join(app.getPath('userData'), 'data', 'backups', `daily-${new Date().toISOString().slice(0,10)}.sqlite`)
        if (!fs.existsSync(daily)) register.backup(daily)
      }
      try { serverInstance = startServer({ register, port: 4788 }) }
      catch (e) { dialog.showErrorBox('Cannot start API server', `Port 4788 may be in use.\n\n${e.message}`) }
    }
    applyNetworkPolicy(currentConfig.mode, currentConfig.serverUrl)
    createWindow()
  } catch (error) {
    dialog.showErrorBox('Cannot open local database', error.message)
    app.quit()
  }
})
app.on('will-quit', () => {
  try { serverInstance?.close() } catch {}
  try { register?.close() } catch {}
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
