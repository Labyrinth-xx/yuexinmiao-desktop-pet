// 创建桌宠窗口：透明、无边框、置顶、默认鼠标穿透；处理交互切换、拖拽、动作/气泡推送。
// 窗口比可视猫大一圈：底部居中放 108×108 的猫，上方留白给提醒气泡（透明区照样穿透）。
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const WIN_W = 220;
const WIN_H = 160;
const CAT_DISP = 108; // 可视猫的边长（屏显尺寸）
// 可视猫四周的透明边距（= 窗口尺寸减去猫），让 DVD 漫游按"可视猫"贴边反弹而非透明窗口框。
const CAT_INSET = Object.freeze({ left: 56, right: 56, top: 48, bottom: 4 });
const HOME_MARGIN = 16; // 趴窝时可视猫距工作区右下角的间距
const ROOT = path.join(__dirname, '..', '..');

function createPetWindow() {
  const win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
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

  wireAssetIpc(win);
  wireMouseIpc(win);
  return win;
}

// 取某动作的素材 URL；name 为空（或动作目录不存在）回退到主漫游素材（跳舞猫）。
function actionAssetURLs(name) {
  if (name) {
    const dir = path.join(ROOT, 'assets', 'actions', name);
    const cat = path.join(dir, 'cat.webp');
    const mask = path.join(dir, 'mask.png');
    if (fs.existsSync(cat) && fs.existsSync(mask)) {
      return { catURL: pathToFileURL(cat).href, maskURL: pathToFileURL(mask).href };
    }
  }
  return {
    catURL: pathToFileURL(path.join(ROOT, 'assets', 'cat.webp')).href,
    maskURL: pathToFileURL(path.join(ROOT, 'assets', 'mask.png')).href,
  };
}

// 资源真实路径由主进程算好（asar 内也能正确定位）。
// behavior 通过 win.pushAction(name) 换动作、win.pushBubble(text) 控制气泡。
function wireAssetIpc(win) {
  let currentName = null; // 当前显示的动作名（null = 跳舞猫）

  ipcMain.handle('pet:assets', () => actionAssetURLs(currentName));

  win.pushAction = (name) => {
    currentName = name ?? null;
    if (win.isDestroyed()) return;
    win.webContents.send('pet:setAction', { name: currentName, ...actionAssetURLs(currentName) });
  };
  win.pushBubble = (text) => {
    if (win.isDestroyed()) return;
    win.webContents.send('pet:bubble', { text: text ?? null });
  };
}

function wireMouseIpc(win) {
  // 命中检测：在猫身上 -> 可交互(关穿透 + 临时可获焦)；在透明区 -> 穿透 + 不可获焦
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

// 趴窝坐标：让可视猫的右下角距工作区右下角 HOME_MARGIN（窗口透明边距允许略微出屏）。
function homePosition() {
  const wa = screen.getPrimaryDisplay().workArea;
  return [
    Math.round(wa.x + wa.width - HOME_MARGIN - CAT_INSET.left - CAT_DISP),
    Math.round(wa.y + wa.height - HOME_MARGIN - CAT_INSET.top - CAT_DISP),
  ];
}

function placeBottomRight(win) {
  const [x, y] = homePosition();
  win.setPosition(x, y);
}

module.exports = { createPetWindow, placeBottomRight, homePosition, actionAssetURLs, CAT_INSET, WIN_W, WIN_H };
