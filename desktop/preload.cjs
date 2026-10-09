const { contextBridge, ipcRenderer } = require('electron')

const argMap = {}
for (const a of process.argv) {
  const m = a.match(/^--courtdesk-([^=]+)=(.*)$/)
  if (m) argMap[m[1]] = m[2]
}

const mode = argMap.mode && argMap.mode !== 'unset' ? argMap.mode : null
const serverUrl = argMap.server || null

contextBridge.exposeInMainWorld('desktop', {
  mode,
  serverUrl,
  database: (operation, payload) => ipcRenderer.invoke('local-database', operation, payload),
  saveExport: (filename, bytes) => ipcRenderer.invoke('save-excel', filename, bytes),
  saveExcel: (filename, bytes) => ipcRenderer.invoke('save-excel', filename, bytes),
  config: () => ipcRenderer.invoke('courtdesk-config'),
  setMode: (newMode, url) => ipcRenderer.invoke('courtdesk-set-mode', newMode, url),
  resetMode: () => ipcRenderer.invoke('courtdesk-reset-mode'),
  localHasAdmin: () => ipcRenderer.invoke('courtdesk-local-has-admin'),
  localCreateFirstAdmin: (username, password) => ipcRenderer.invoke('courtdesk-local-create-first-admin', username, password),
  localLogin: (username, password) => ipcRenderer.invoke('courtdesk-local-login', username, password),
  localLogout: token => ipcRenderer.invoke('courtdesk-local-logout', token),
  localMe: token => ipcRenderer.invoke('courtdesk-local-me', token),
})
