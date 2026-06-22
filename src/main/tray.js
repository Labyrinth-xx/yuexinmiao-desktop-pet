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
  // macOS 用手绘线条模板图标（随菜单栏明暗自动反色，@2x 由命名自动加载）；
  // 其他平台用彩色猫头 tray.png。
  const isMac = process.platform === 'darwin';
  const iconFile = isMac ? 'trayTemplate.png' : 'tray.png';
  const iconPath = path.join(__dirname, '..', '..', 'assets', iconFile);
  const img = nativeImage.createFromPath(iconPath);
  // macOS 的 Tray 必须有有效图标，传空图会直接抛错崩溃；缺图标时给出可操作的提示
  if (img.isEmpty()) throw new Error(`托盘图标缺失: ${iconPath}\n先跑: npm run assets`);
  if (isMac) img.setTemplateImage(true);
  const tray = new Tray(img);
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
