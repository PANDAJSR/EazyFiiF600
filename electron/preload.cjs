const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('eazyFiiDesktop', {
  pickOpenDirectory: () => ipcRenderer.invoke('desktop:pick-open-directory'),
  pickSaveDirectory: () => ipcRenderer.invoke('desktop:pick-save-directory'),
  writeProjectFiles: (payload) => ipcRenderer.invoke('desktop:write-project-files', payload),
  readTextFile: (payload) => ipcRenderer.invoke('desktop:read-text-file', payload),
  writeTextFile: (payload) => ipcRenderer.invoke('desktop:write-text-file', payload),
  agentChat: (payload) => ipcRenderer.invoke('agent:chat', payload),
  getAgentStatus: () => ipcRenderer.invoke('agent:get-status'),
  getAgentEnv: () => ipcRenderer.invoke('agent:get-env'),
  setAgentEnv: (payload) => ipcRenderer.invoke('agent:set-env', payload),
  sendAgentTrajectoryIssuesResponse: (payload) => ipcRenderer.send('agent:trajectory-issues:response', payload),
  onAgentTrajectoryIssuesRequest: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('agent:trajectory-issues:request', listener)
    return () => ipcRenderer.removeListener('agent:trajectory-issues:request', listener)
  },
  onAgentStream: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('agent:stream', listener)
    return () => ipcRenderer.removeListener('agent:stream', listener)
  },
})
