// 创建桌宠窗口：透明、无边框、置顶、默认鼠标穿透；处理交互切换与拖拽 IPC。
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const CAT_W = 150; // 屏显尺寸；长宽比跟随 assets/cat.webp 画布(392×393≈1:1)，命中检测按比例映射
const CAT_H = 150;
const ROOT = path.join(__dirname, '..', '..');

function createPetWindow() {
  const win = new BrowserWindow({
    width: CAT_W,
    height: CAT_H,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false, // 待机时不抢焦点；交互（拖拽）时临时打开，见下方 pet:interactive
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  win.setIgnoreMouseEvents(true, { forward: true }); // 默认穿透，靠渲染层命中检测翻转
  placeBottomRight(win);

  wireAssetIpc();
  wireMouseIpc(win);
  return win;
}

// 资源真实路径由主进程算好（asar 内也能正确定位），避免渲染层相对路径打包后断掉
function wireAssetIpc() {
  ipcMain.handle('pet:assets', () => ({
    catURL: pathToFileURL(path.join(ROOT, 'assets', 'cat.webp')).href,
    maskURL: pathToFileURL(path.join(ROOT, 'assets', 'mask.png')).href,
  }));
}

function wireMouseIpc(win) {
  // 命中检测：在猫身上 -> 可交互(关穿透 + 临时可获焦，保证 Windows 上能收到 mousedown)
  //           在透明区 -> 穿透 + 不可获焦
  ipcMain.on('pet:interactive', (_e, on) => {
    if (win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!on, { forward: true });
    win.setFocusable(on);
  });

  // 手动拖拽：用屏幕坐标位移驱动窗口移动，稳定可控
  let origin = null;
  ipcMain.on('pet:dragStart', () => {
    origin = win.getPosition();
    win.emit('pet-grab');
  });
  ipcMain.on('pet:dragMove', (_e, dx, dy) => {
    if (origin) win.setPosition(origin[0] + Math.round(dx), origin[1] + Math.round(dy));
  });
  ipcMain.on('pet:dragEnd', () => {
    origin = null;
    win.emit('pet-release');
  });
}

function placeBottomRight(win) {
  const wa = screen.getPrimaryDisplay().workArea;
  const [w, h] = win.getSize();
  win.setPosition(wa.x + wa.width - w - 24, wa.y + wa.height - h - 24);
}

module.exports = { createPetWindow, placeBottomRight, CAT_W, CAT_H };
