// 系统托盘：显示/隐藏、手动乱跑、暂停乱跑、开机自启开关、退出。
const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

function getAutoLaunch() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunch(on) {
  app.setLoginItemSettings({ openAtLogin: !!on });
}

function setupTray(win, wander) {
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray.png');
  const img = nativeImage.createFromPath(iconPath);
  const tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('月薪喵 桌宠');

  const rebuild = () => {
    const menu = Menu.buildFromTemplate([
      { label: '显示 / 隐藏', click: () => (win.isVisible() ? win.hide() : win.show()) },
      { label: '让它乱跑一下', click: () => wander.wanderNow() },
      {
        label: '暂停乱跑',
        type: 'checkbox',
        checked: wander.isPaused(),
        click: (mi) => wander.setPaused(mi.checked),
      },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: getAutoLaunch(),
        click: (mi) => { setAutoLaunch(mi.checked); rebuild(); },
      },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
  };

  rebuild();
  // 左键点托盘图标 = 显示/隐藏（Windows 右键自带弹出菜单，不再手动弹避免双菜单）
  tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
  return tray;
}

module.exports = { setupTray, getAutoLaunch, setAutoLaunch };
