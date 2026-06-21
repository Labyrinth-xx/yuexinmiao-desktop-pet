# 架构 · 月薪喵桌宠

## 目标 & 技术栈
Windows 桌面宠物：透明置顶、点击穿透、待机 + 随机乱跑 + 拖拽，给非技术用户一键安装。
- **Electron 42**（透明窗口/点击穿透/托盘/开机自启一站搞定，可在 macOS 直接交叉打包 Windows）
- **electron-builder 26**（NSIS 安装包，oneClick 免管理员）
- 素材处理：**ffmpeg + Python/Pillow**（抠图、动画 WebP、图标）

## 目录结构
```
main.js                 入口：单实例锁、装配窗口/乱跑/托盘
preload.js              contextBridge 安全桥（穿透切换 + 拖拽）
src/main/
  petWindow.js          建透明置顶窗口、默认穿透、拖拽 IPC
  wander.js             乱跑引擎（定时随机平移，缓动）
  tray.js               托盘菜单 + 开机自启
  settings.js           userData/settings.json 持久化（记“首次运行”）
src/renderer/
  index.html/style.css  显示 cat.webp，透明背景
  renderer.js           剪影命中检测 + 拖拽（透明区穿透，猫身可抓）
assets/                 cat.webp(动画) mask.png(命中剪影) tray.png 图标
scripts/                cutout.py / make_icons.py（素材管线，不打进包）
```

## 数据流 / 模块关系
```
                 ┌──────────── main.js ────────────┐
                 │ whenReady: 建窗 + 乱跑 + 托盘     │
                 └───┬───────────┬─────────────┬────┘
                     │           │             │
              petWindow.js   wander.js      tray.js ── setLoginItemSettings(开机自启)
                     │           │  setPosition   │
            透明置顶/穿透窗      定时随机平移      托盘菜单(显示/暂停/自启/退出)
                     │                            
         BrowserWindow(transparent,alwaysOnTop)   
                     │  loadFile                   
              src/renderer (cat.webp)              
                     │  mousemove 命中 mask.png     
        renderer.js ─┴─> preload(IPC) ─> petWindow:
            在猫身上 setIgnoreMouseEvents(false) 可拖
            在透明区 setIgnoreMouseEvents(true,forward) 穿透
```

关键点：默认整窗 `setIgnoreMouseEvents(true,{forward:true})` 鼠标穿透，渲染层用 `mask.png`
剪影逐像素判断光标是否在猫身上，是→临时关穿透（可拖），离开→恢复穿透。猫被拖/手动触发时
`wander` 暂停。

## 已验证 / 未验证
- ✅ macOS 实测：透明渲染、始终置顶、右下待机、定时乱跑（平台无关逻辑，等同 Windows）。
- ✅ 在 macOS 用 electron-builder 成功打出 Windows NSIS 安装包，asar 内素材齐全。
- ⚠️ 仅 Windows 能最终确认：点击穿透、拖拽、托盘交互、开机自启、未签名 SmartScreen 提示。

## Delete Path（干净删除整个项目）
1. 删目录 `desktop-cat-pet/`（含代码、素材、scripts、dist 安装包）。
2. 已安装到 Windows 的：开始菜单/设置里卸载「月薪喵桌宠」；它只写 `%APPDATA%/月薪喵桌宠/`
   (settings.json) 和一个开机自启注册表项，卸载即清。
3. 无其它全局副作用（不写系统目录、不装服务）。
