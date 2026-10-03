const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  database: (operation, payload) => ipcRenderer.invoke('local-database', operation, payload),
  saveExport: (filename, bytes) => ipcRenderer.invoke('save-excel', filename, bytes),
  saveExcel: (filename, bytes) => ipcRenderer.invoke('save-excel', filename, bytes),
})
