const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('pet', {
  workArea: () => ipcRenderer.invoke('workArea'),
  moveTo: (x, y) => ipcRenderer.send('moveTo', x, y),
  openDashboard: () => ipcRenderer.send('openDashboard'),
  openUrl: (u) => ipcRenderer.send('openUrl', u),
  greet: (ctx) => ipcRenderer.invoke('greet', ctx),
  chat: (payload) => ipcRenderer.invoke('chat', payload),
})
