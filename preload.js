const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('openclawAPI', {
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  getInstallDir: () => ipcRenderer.invoke('get-install-dir'),
  selectInstallDir: () => ipcRenderer.invoke('select-install-dir'),
  setInstallDir: (dir) => ipcRenderer.invoke('set-install-dir', dir),

  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowToggleFullscreen: () => ipcRenderer.invoke('window-toggle-fullscreen'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),

  checkOpenclawVersions: () => ipcRenderer.invoke('check-openclaw-versions'),

  installOpenclaw: () => ipcRenderer.invoke('install-openclaw'),

  onInstallLog: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('install-log', handler)
    return () => ipcRenderer.removeListener('install-log', handler)
  },

  onInstallProgress: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('install-progress', handler)
    return () => ipcRenderer.removeListener('install-progress', handler)
  },

  saveApiConfig: (apiKeys) => ipcRenderer.invoke('save-api-config', apiKeys),

  injectSkills: () => ipcRenderer.invoke('inject-skills'),

  copyLauncherToDesktop: () => ipcRenderer.invoke('copy-launcher-to-desktop'),

  verifyPassword: (input) => ipcRenderer.invoke('verify-password', input),

  openTerminal: () => ipcRenderer.invoke('open-terminal')
})
