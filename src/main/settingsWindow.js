// 设置窗口：普通带边框单例窗，与宠物窗口隔离。读写 settings，保存后 behavior 热生效。
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let winRef = null;
let ipcReady = false;

function registerIpc(settings, behavior, onApplied) {
  if (ipcReady) return;
  ipcReady = true;
  ipcMain.handle('settings:get', () => settings.getAll());
  ipcMain.handle('settings:save', (_e, partial) => {
    behavior.applyConfig(partial); // 内部 merge 落盘 + 重排定时器，立即生效
    if (typeof onApplied === 'function') onApplied(); // 同步托盘勾选态等 UI
    return settings.getAll();
  });
}

function createSettingsWindow(settings, behavior, onApplied) {
  registerIpc(settings, behavior, onApplied);
  if (winRef && !winRef.isDestroyed()) {
    winRef.show();
    winRef.focus();
    return winRef;
  }
  const win = new BrowserWindow({
    width: 400,
    height: 560,
    title: '月薪喵 设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'settings.html'));
  win.on('closed', () => { if (winRef === win) winRef = null; });
  winRef = win;
  return win;
}

module.exports = { createSettingsWindow };
