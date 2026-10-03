const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
Menu.setApplicationMenu(null)
const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

const indexPath = path.join(__dirname, '../build/index.html')
const appURL = pathToFileURL(indexPath).href
let mainWindow
let register
const { openRegister } = require('./database.cjs')

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: 1440, height: 960, minWidth: 1000, minHeight: 700,
    title: 'High Court Case Management',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== appURL) event.preventDefault()
  })
  // The existing print action writes a case sheet to a blank child window.
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
  await fs.writeFile(result.filePath, Buffer.from(bytes))
  return { canceled: false }
})

ipcMain.handle('local-database', async (event, operation, payload) => {
  if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== appURL) throw new Error('Invalid database sender')
  try {
    let value
    switch(operation) {
      case 'search': value=register.search(payload); break
      case 'all': value=register.search(payload,true); break
      case 'create': value=register.create(payload); break
      case 'update': value=register.update(payload.key,payload.data); break
      case 'delete': value=register.delete(payload); break
      case 'import': value=register.importRows(payload); break
      case 'keys': value=register.keys(); break
      case 'next': value=register.next(); break
      case 'districts': value=register.districts(); break
      case 'titles': value=register.titles(); break
      case 'addMaster': value=register.addMaster(payload); break
      case 'pdf': value=register.pdf(payload); break
      case 'types': value=register.types(); break
      case 'advocates': value=register.advocates(payload); break
      case 'info': value=register.info(); break
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
app.whenReady().then(async () => {
  try {
    const filename=path.join(app.getPath('userData'),'data','courtdesk.sqlite')
    const seed=app.isPackaged ? path.join(process.resourcesPath,'initial-register.sqlite') : path.join(__dirname,'../data/initial-register.sqlite')
    if(!require('node:fs').existsSync(filename) && require('node:fs').existsSync(seed)) {
      await fs.mkdir(path.dirname(filename),{recursive:true})
      await fs.copyFile(seed,filename+'.initializing')
      await fs.rename(filename+'.initializing',filename)
    }
    register=openRegister(filename)
    if(register.info().count) {
      const daily=path.join(app.getPath('userData'),'data','backups',`daily-${new Date().toISOString().slice(0,10)}.sqlite`)
      if(!require('node:fs').existsSync(daily))register.backup(daily)
    }
    const { session }=require('electron')
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_,callback)=>callback({cancel:true}))
    createWindow()
  } catch(error) {dialog.showErrorBox('Cannot open local database',error.message);app.quit()}
})
app.on('will-quit',()=>register?.close())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
