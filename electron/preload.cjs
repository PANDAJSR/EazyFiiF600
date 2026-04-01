const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eazyFiiDesktop', {
  pickOpenDirectory: () => ipcRenderer.invoke('desktop:pick-open-directory'),
  pickSaveDirectory: () => ipcRenderer.invoke('desktop:pick-save-directory'),
  writeProjectFiles: (payload) => ipcRenderer.invoke('desktop:write-project-files', payload),
})
