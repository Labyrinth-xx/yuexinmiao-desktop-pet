// 入口：单实例锁 -> 建窗 + 乱跑引擎 + 托盘；常驻后台，由托盘"退出"才真退。
const { app } = require('electron');
const { createPetWindow } = require('./src/main/petWindow');
const { createWander } = require('./src/main/wander');
const { setupTray, setAutoLaunch } = require('./src/main/tray');
const Settings = require('./src/main/settings');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win;
  let wander;
  let tray; // 持有引用，防止被 GC 回收导致托盘消失

  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) app.dock.hide(); // mac 开发时不占 Dock

    win = createPetWindow();
    wander = createWander(win);
    tray = setupTray(win, wander);

    // 拖拽时暂停乱跑；加一道保底：万一没收到 release（异常），12 秒后自动恢复
    let dragSafety = null;
    win.on('pet-grab', () => {
      wander.pauseForDrag();
      clearTimeout(dragSafety);
      dragSafety = setTimeout(() => wander.resumeFromDrag(), 12000);
    });
    win.on('pet-release', () => {
      clearTimeout(dragSafety);
      wander.resumeFromDrag();
    });

    firstRunDefaults();
    wander.start();
  });

  app.on('second-instance', () => { if (win) win.show(); });
  app.on('window-all-closed', () => { /* 不退出，常驻托盘 */ });

  function firstRunDefaults() {
    const s = new Settings();
    if (!s.get('initialized')) {
      if (process.platform === 'win32') setAutoLaunch(true); // 仅 Windows 首次默认开机自启
      s.set('initialized', true);
    }
  }
}
