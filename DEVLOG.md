# DEVLOG · 月薪喵桌宠

## 2026-06-22 — 三大新功能：定时提醒 + 时间段动作 + DVD 漫游 + 设置页

### 完成内容
- **行为状态机 `behavior.js`（中枢）**：协调 IDLE/ROAM/REMIND/DRAG 四态，优先级
  `DRAG > REMIND > ROAM > IDLE` 抢占，任意时刻至多一个 motion，退出非 IDLE 都 easeTo 回角落。
  把旧 `wander.js` 瘦身为纯 motion 库（`easeTo` 缓动 + `dvdRoam` 碰边反弹漫游）。
- **功能1 定时提醒**（`reminders.js` + `phrases.js`）：喝水/久坐两个独立定时器，到点猫跳出来
  **走一段→停下弹气泡→停几秒→收气泡→再走**（2 轮，不边走边弹，保证文字可读）→ 回角落。
  文案各 5 条随机抽。拖拽中触发的提醒排队，回 IDLE 再补。
- **功能2 时间段待机动作**（`actions.js` + 扩展 `cutout.py`）：桌面 8 个 GIF 归集到
  `assets/source/actions/`，批处理生成 `assets/actions/<name>/{cat.webp,mask.png}`。
  白天(6-18)活泼 / 傍晚(18-23)通用 / 深夜(23-6)沉迷或睡，每隔几分钟在当前时段池随机换。
  `半夜看电脑` 按用户决定保留背景（mask=整块矩形），其余 alpha 抠图 + 去首尾空白帧。
- **功能3 DVD 漫游**：`dvdRoam` 恒速直线 + 碰可视边界反弹（按透明边距 inset 让可视猫贴屏幕边反弹），
  替代旧"瞬移到点"。独立开关，复用托盘"暂停乱跑"。
- **功能4 设置页**（`settingsWindow.js` + `preload-settings.js` + `src/renderer/settings.*`）：
  普通带边框单例窗，四组开关+间隔（喝水/久坐/乱跑/换动作），保存即 `behavior.applyConfig` 热生效。
- **窗口扩容** 108→220×160（底部居中放 108 猫，上方留白给气泡）；命中检测改为按 object-fit:contain
  实际绘制矩形映射；换动作时 renderer 双缓冲换 mask。`settings.js` 加 DEFAULTS 深合并。
  `package.json` build.files 加 `assets/actions/**` 与 `preload-settings.js`。

### 关键决策
- 气泡用**同窗口 DOM**（窗口扩大、透明区穿透）而非独立窗口：天然跟随猫、零同步成本。
- 新建 `behavior.js` 而非把状态塞进 `wander.js`：避免单文件超标、职责混乱；motion/选动作/提醒拆成小模块。
- 提醒**走停交替**而非边走边弹：用户明确指出移动中文字看不清。

### 遗留问题 / 下次继续
- 设置窗 UI、气泡观感、各动作抠图毛边未做可视化点击测，建议真机 `npm start` 跑一遍。
- `tray` 的"暂停乱跑"勾选态在设置页改 roam 后不会自动刷新（次要，下次开菜单才更新）。
- mfuns 那批 62 个 GIF 还能再挑几个加进 `assets/source/actions/` + 在 `settings.schedule` 登记即可扩展。

## 2026-06-22 — 换成自带透明背景的新源 GIF，砍掉抠图步骤

### 完成内容
- 用户给的新 `cat-source.gif`（120×120 / 28帧 / 40ms≈25fps）**自带透明背景**，
  不再是旧高清源那种白猫白底，所以整套四角 flood-fill 抠图彻底用不上了。
- `cutout.py` 重写：PIL 直接读 GIF 各帧 alpha（按 disposal 正确合成），并集 bbox 裁剪 +
  生成 `cat.webp`/`cat.apng`/`mask.png`。删掉 ffmpeg 抽帧步骤（PIL 直接读 GIF）。
  新画布 103×95，帧速 40ms 跟随源原生节奏。
- `package.json` 的 `assets` 脚本去掉 ffmpeg 那段；`petWindow.js` 画布尺寸注释同步更新。
- 旧高清白底源留底 `assets/source/cat-source-highres-whitebg.gif`。
- 深底自检无白毛边，托盘/icon 重生成，`npm start` 启动无报错。
- 桌宠屏显尺寸 150→108（用户要更小）。
- 新增菜单栏图标 `scripts/make_tray_icon.py`：**直接从真实帧 `c_010.png` 抠出这只猫
  自己的描边线稿**（深棕描边按亮度阈值取、+招牌蓝泪），不是手画/臆造的猫。LANCZOS
  下采样抗锯齿，出黑色 template image `trayTemplate.png`(22)/`@2x`(44)。
  macOS 当模板图用（随菜单栏明暗自动反色）；Windows 仍用彩色 `tray.png`。
  截图确认真机菜单栏里就是这只猫的线稿、右下角小猫渲染正常。

### 关键决策
- 砍 flood-fill 而非保留兼容：新源透明，旧白底流程是为已弃用素材服务的死逻辑，留着只增复杂度。
- 菜单栏图标用"真实帧描边线稿"而非彩色缩图，也不用手画：① 猫身子白，彩色缩到浅色菜单栏几乎看不见；
  ② 用户明确要"和这只猫一样"，所以图标直接取它自己的线条，模板图再自动适配明暗，最忠实也最清晰。
- 不要 ffmpeg：PIL 读 GIF 自带 disposal 合成，比 ffmpeg 抽帧→再抠更短更稳，少一个外部依赖。

### 遗留问题 / 下次继续
- 新源 120×120 比上一版 392px 低清，屏显 150px 会略放大；用户偏好这版动画/透明效果，按其要求采用。
- 改动未 commit，等用户确认效果后再走保存流水线（可顺带重打 Mac/Win 包）。

## 2026-06-21 — 换高清月薪喵素材（清晰度 + 帧率双升）

### 完成内容
- 旧素材（Tenor 220×220 / 34帧 / 强压 10fps）太糊太卡。换成博主 B站 1080p 原片裁出的高清同款：
  新 `cat.webp` 392×393 / 44帧 / 原生 30ms(≈33fps)。旧源留底 `assets/source/cat-source-tenor-old.gif`。
- 抠图脚本 `cutout.py`：`BAR` 3→0（新源无水印）、新增 `FRAME_MS=30` 跟随原生帧速。
- 窗口尺寸 `petWindow.js` `CAT_W/H` 147×138 → 150×150（跟随新画布近 1:1，屏显尺寸基本不变）。
- 深底自检无白毛边；重新打 Mac 包、装到 /Applications、截屏确认右下角高清渲染、透明叠加正常。

### 关键决策
- 走"网上找高清同款"而非"从微信缓存抠"：微信 4.0 把图片/表情全 AES 加密存 `.dat`，缓存无明文、解密需库密钥，又脆又重。
- 屏显尺寸保持 ~150px 不放大：用户只要清晰+顺，不要更大；高清大图缩小显示在视网膜屏上即锐利。

### 遗留问题 / 下次继续
- **⚠️ 猫的动作选错了（待修）**：当前这只是月薪喵「捂嘴 / 双爪贴脸」款，看起来像**擦脸/擦毛巾**；
  用户实际想要的是**「摆手」动作**的月薪喵。下次要找 月薪喵【摆手】款的高清动图替换，
  流程同本次（找高清源 → `assets/source/cat-source.gif` 换源 → `npm run assets` → 重打包）。
- 帧速 30ms 是按源 GIF 元数据定的统一值；若换款后觉得节奏不对，调 `cutout.py` 的 `FRAME_MS`。

## 2026-06-21 — 加 Mac 版（.dmg）+ 首次纳入 git

### 完成内容
- 新增 macOS 打包：`package.json` 加 `build.mac`（target dmg / category entertainment）+
  `dist:mac` 脚本（`electron-builder --mac --universal`，arm64+x64 通用包）。
- 图标：`make_icons.py` 把 `icon.png` 提到 1024px（electron-builder 生成 .icns 需 >=512），
  Windows 的 .ico 仍 256px 不变。
- 打出 `dist/YuexinCatPet-1.0.0.dmg`（~207MB，universal），用本机 Apple Development 证书签了名
  （**未公证**，分发到别的 Mac 会被 Gatekeeper 拦，右键→打开可绕过）。
- 验证：app.asar 内 cat.webp/mask.png/tray.png/main.js/src 齐全（无白屏风险）。
- 独立 code-reviewer 复审：0 CRITICAL/HIGH，APPROVE。
- 项目首次 `git init` 并提交源码（node_modules/ 与 dist/ 已 gitignore，构建产物留在本地待测）。

### 关键决策
- Mac target 选 universal（一个包同时支持 Apple Silicon + Intel），省得用户分不清自己机器架构。
- 不配 hardenedRuntime/公证：个人/自测用，不上架不外发；要外发再补 Apple 开发者账号公证。
- dist/ 不进 git：构建产物大（百 MB 级），git 只存源码；安装包留在 dist/ 本地随时可装可测。

### 遗留问题 / 下次继续
- **Mac 真机自测**：装 .dmg 后看透明/置顶/点击穿透/菜单栏托盘/拖拽是否都正常（开发预览已通过，安装版待测）。
- 若要把 .dmg 发给别人：需 Apple 开发者账号做 hardenedRuntime + notarization，否则对方被 Gatekeeper 拦。
- 托盘左键在 Mac 是显示/隐藏窗口（菜单需右键），与 Windows 习惯略不同，按自测反馈再定要不要调。

## 2026-06-21 — 从一张表情包截图到 Windows 安装包，一次做完

### 完成内容
- 反向图搜（百度识图逐像素命中）确认表情包身份：**月薪喵**「捂嘴流蓝泪 + 发抖」款。
- 素材管线：Tenor 原动图(220×220,34帧) → ffmpeg 抽帧 → 裁掉底部 2px 水印条 →
  四角 flood-fill 抠白底（白猫白底难点：靠棕描边挡住，身体白不被抠）→
  透明动画 `cat.webp`(147×138) + 命中剪影 `mask.png` + `icon.ico`/`tray.png`。
- Electron app：透明/置顶/点击穿透窗口 + 乱跑引擎 + 托盘（显示/暂停/开机自启/退出）+
  剪影命中检测 + 手动拖拽。模块化拆分（petWindow/wander/tray/settings/renderer）。
- macOS 实测通过：透明渲染、置顶、右下待机、定时乱跑（日志确认 3 次随机平移）。
- electron-builder 在 macOS 直接打出 Windows NSIS 安装包：
  `dist/YuexinCatPet-Setup-1.0.0.exe`（~102MB，oneClick 免管理员），asar 内素材齐全。
- 独立 code-reviewer 复审（新上下文）抓出 3 个 Windows 专属 HIGH 并已修复 + 重新打包：
  ① `focusable:false` 窗口在 Windows 收不到 mousedown 导致拖不动 → 交互时临时 `setFocusable(true)`；
  ② asar 内 `../../assets` 相对路径可能加载不到（猫白屏）→ 改主进程算好 file URL 经 IPC 下发；
  ③ 拖拽保底（blur 死代码 + 主进程 12s 自动恢复乱跑）。离屏 capturePage 复验渲染正常。

### 关键决策
- 选 Electron 而非 Tauri/Python：唯一能在 Mac 本地直接出 Windows 安装包、透明窗+点击穿透
  一行 API 搞定的方案；体积大但对装机无影响。
- 不用现成桌宠框架（Shimeji/VPet）：它们为多姿势角色设计，单一循环表情包猫塞进去别扭。
- 抠图用 Pillow 四角 flood-fill 而非全局颜色键：白猫白底下全局键会把身体也抠掉。
- 二进制下载走 npmmirror 镜像：兼顾国内网络可靠性。

### 遗留问题 / 下次继续
- **Windows 真机验证**：点击穿透 / 拖拽 / 托盘 / 开机自启 / SmartScreen 这些只能在
  Windows 上最终确认（开发机是 Mac）。等女友机或 Windows VM 实测，按反馈微调。
- 可选增强：多显示器支持、桌宠尺寸调节、更高清透明原版（微信表情商店「月薪喵」整套）。
