// 入口：单实例锁 -> 建窗 + 行为状态机 + 托盘；常驻后台，由托盘"退出"才真退。
const { app } = require('electron');
const { createPetWindow, CAT_INSET } = require('./src/main/petWindow');
const { createBehavior } = require('./src/main/behavior');
const { setupTray, setAutoLaunch } = require('./src/main/tray');
const Settings = require('./src/main/settings');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win;
  let behavior;
  let settings;
  let tray; // 持有引用，防止被 GC 回收导致托盘消失

  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) app.dock.hide(); // mac 开发时不占 Dock

    win = createPetWindow();
    settings = new Settings();
    behavior = createBehavior(win, settings, { inset: CAT_INSET });
    tray = setupTray(win, behavior, settings);

    // 拖拽时抢占（暂停其它行为）；加一道保底：万一没收到 release（异常），12 秒后自动恢复
    let dragSafety = null;
    win.on('pet-grab', () => {
      behavior.onGrab();
      clearTimeout(dragSafety);
      dragSafety = setTimeout(() => behavior.onRelease(), 12000);
    });
    win.on('pet-release', () => {
      clearTimeout(dragSafety);
      behavior.onRelease();
    });

    firstRunDefaults();
    behavior.start();
  });

  app.on('second-instance', () => { if (win) win.show(); });
  app.on('window-all-closed', () => { /* 不退出，常驻托盘 */ });

  function firstRunDefaults() {
    if (!settings.get('initialized')) {
      if (process.platform === 'win32') setAutoLaunch(true); // 仅 Windows 首次默认开机自启
      settings.set('initialized', true);
    }
  }
}
