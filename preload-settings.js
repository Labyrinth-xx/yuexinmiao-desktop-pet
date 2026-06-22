// 设置窗口的受控桥：只暴露读/存设置两个方法。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: (partial) => ipcRenderer.invoke('settings:save', partial),
});
