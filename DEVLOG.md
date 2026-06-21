# DEVLOG · 月薪喵桌宠

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
