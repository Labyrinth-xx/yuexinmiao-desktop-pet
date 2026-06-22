# 架构 · 月薪喵桌宠

## 目标 & 技术栈
桌面宠物（Windows + macOS）：透明置顶、点击穿透。平时趴角落按**时间段**换待机动作，
**定时提醒**（喝水/久坐）时跳出来"走停弹气泡"，还能**随机 DVD 漫游**卖萌；各项可在设置页独立开关。
- **Electron 42**（透明窗口/点击穿透/托盘/开机自启一站搞定，可在 macOS 直接交叉打包 Windows）
- **electron-builder 26**（NSIS / dmg）
- 素材处理：**Python/Pillow**（动画 WebP、命中剪影 mask、图标）

## 目录结构
```
main.js                 入口：单实例锁、装配窗口/状态机/托盘，转发拖拽事件
preload.js              宠物窗安全桥（穿透切换 + 拖拽 + 接收换动作/气泡推送）
preload-settings.js     设置窗安全桥（读/存设置）
src/main/
  petWindow.js          建透明置顶窗（220×160，底部居中放猫）、拖拽 IPC、
                        win.pushAction(换动作素材)/win.pushBubble(气泡) 推送、homePosition(趴窝坐标)
  behavior.js           ★行为状态机（中枢）：协调 IDLE/ROAM/REMIND/DRAG，优先级抢占
  wander.js             motion 库（纯算法）：easeTo 缓动平移 + dvdRoam 碰边反弹漫游
  actions.js            纯函数：按时间挑时间段(day/dusk/night) + 从池子随机挑待机动作
  reminders.js          喝水/久坐两个独立定时器，到点回调 behavior
  phrases.js            提醒文案池（喝水/久坐各若干条，随机抽）
  tray.js               托盘菜单（显示/乱跑/暂停乱跑/设置/自启/退出）
  settingsWindow.js     设置窗（单例）+ settings:get/save IPC
  settings.js           userData/settings.json 持久化（DEFAULTS 深合并）
src/renderer/
  index.html/style.css  底部居中显示猫 + 上方提醒气泡，透明背景
  renderer.js           剪影命中检测(基于猫 img 渲染矩形) + 拖拽 + 接收换动作/气泡
  settings.html/css/js  设置表单（四组开关 + 间隔）
assets/
  cat.webp / mask.png   主漫游素材（跳舞猫）+ 命中剪影
  actions/<name>/       每个待机动作一套 {cat.webp, mask.png}
  source/actions/*.gif  待机动作源 GIF（归集自桌面，跑 cutout.py 生成上面的 actions/）
scripts/                cutout.py（批处理源 GIF）/ make_icons.py
```

## 数据流 / 模块关系
```
        ┌──────────────────── main.js ────────────────────┐
        │ whenReady: 建窗 + createBehavior + 托盘           │
        └──┬──────────────┬───────────────────────┬────────┘
           │              │                        │
      petWindow.js   behavior.js (状态机)        tray.js ── 设置… → settingsWindow.js
       透明置顶窗      IDLE>换动作  ROAM>DVD漫游                   │ settings:get/save
       win.pushAction  REMIND>走停弹气泡  DRAG>抢占          settings.js(深合并落盘)
       win.pushBubble  │  调用                                   │ applyConfig 热生效
           │           ├─ wander.js   (easeTo / dvdRoam → setPosition)
           │           ├─ actions.js  (currentBucket / pickAction)
           │           ├─ reminders.js(到点 onFire → 入队)
           │           └─ phrases.js  (随机文案)
           │ loadFile / webContents.send(pet:setAction / pet:bubble)
      src/renderer (cat.webp + 气泡 DOM)
           │ mousemove 命中 当前动作的 mask
   renderer.js ─> preload(IPC) ─> petWindow:
       在猫身上 setIgnoreMouseEvents(false) 可拖；在透明区 穿透
```

关键点：
- **状态机优先级 DRAG > REMIND > ROAM > IDLE**：高优先级抢占低优先级，任意时刻至多一个 motion。
  退出非 IDLE 态都 easeTo 回角落再 enterIdle。
- **提醒走停**：REMIND 不边走边弹——`走一段(dvdRoam) → 停下 pushBubble → 停几秒 → 收气泡 → 再走`，
  2 轮后回角落，保证气泡文字可读。
- **多动作命中**：每个动作有自己的 cat.webp + mask；换动作时 renderer 双缓冲换 mask，
  命中检测按 object-fit:contain 实际绘制矩形映射（`半夜看电脑` 保留背景，mask=整块矩形）。
- 默认整窗 `setIgnoreMouseEvents(true,{forward:true})` 穿透，渲染层用 mask 逐像素判断光标是否在猫身上。
- **环境变量调参**（自测）：`PET_{WATER,STANDUP,ROAM_EVERY,ROAM_DUR,IDLE_SWITCH,REMIND_WALK,REMIND_BUBBLE}_MS`。

## 已验证 / 未验证
- ✅ macOS 实测：透明渲染、始终置顶、右下待机、定时乱跑、拖拽（平台无关逻辑，等同 Windows）。
- ✅ 状态机：用短间隔环境变量让 IDLE 换动作 / ROAM 漫游 / 喝水+久坐提醒并发触发，
  20s 压力启动无崩溃、无 unhandled rejection；提醒走停气泡周期、回角落均正常。
- ✅ 资源管线：8 个源 GIF 经 cutout.py 生成 actions/<name>/{cat.webp,mask.png}，
  webp 多帧有效；`半夜看电脑` 保留背景（mask 整块）。
- ✅ 设置深合并往返：部分更新保留兄弟字段、落盘正常。
- ✅ 在 macOS 用 electron-builder 成功打出 Windows NSIS 安装包，asar 内素材齐全（旧验证）。
- ⚠️ 未做可视化点击测：设置窗 UI 实际打开/保存交互、气泡文字位置观感、各动作抠图毛边——
  建议真机跑一次 `npm start`，开托盘"设置…"点一遍。
- ⚠️ 仅 Windows 能最终确认：点击穿透、托盘交互、开机自启、未签名 SmartScreen 提示。
- ⚠️ 打包后需确认 `assets/actions/**` 与 `preload-settings.js` 进了 asar（已加入 build.files）。

## Delete Path（干净删除整个项目）
1. 删目录 `desktop-cat-pet/`（含代码、素材、scripts、dist 安装包）。
2. 已安装到 Windows 的：开始菜单/设置里卸载「月薪喵桌宠」；它只写 `%APPDATA%/月薪喵桌宠/`
   (settings.json) 和一个开机自启注册表项，卸载即清。
3. 无其它全局副作用（不写系统目录、不装服务）。
