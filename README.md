# 月薪喵桌宠（Windows Desktop Pet）

一只「月薪喵」捂嘴发抖款小猫的 Windows 桌面宠物：透明、始终置顶、不挡操作（点击穿透），
平时乖巧待在右下角循环卖萌，每隔几分钟随机在屏幕上跑两下「打扰」一下。Electron 实现，
在 macOS 上用 electron-builder 直接打出 Windows 安装包。

## 给最终用户
直接发 `dist/YuexinCatPet-Setup-1.0.0.exe` + `dist/安装说明.txt`，双击安装即可。

## 开发 / 重新构建（在 macOS）

```bash
npm install                 # 装 electron + electron-builder
npm run assets              # 重做素材：从 GIF 抠图 -> cat.webp / mask.png / 图标（需 ffmpeg + python3+Pillow）
npm start                   # 本机预览（mac 上能看外观/待机/乱跑）
npm run dist                # 打 Windows NSIS 安装包 -> dist/*.exe
```

构建若在国内网络，给二进制下载加镜像：

```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

可选环境变量（调乱跑节奏，正常不用设）：
`PET_MIN_IDLE_MS` / `PET_MAX_IDLE_MS`（待机时长，默认 3–8 分钟）、`PET_MOVE_MS`（单次平移时长）。

## 素材管线
`assets/source/cat-source.gif`（月薪喵原动图）
→ `scripts/cutout.py`：ffmpeg 抽 34 帧 → 裁掉底部水印条 → 四角 flood-fill 抠白底（猫的棕描边天然挡住白身子）
→ `assets/cat.webp`（透明动画）+ `assets/mask.png`（命中检测剪影）
→ `scripts/make_icons.py`：`assets/build-icons/icon.ico` + `assets/tray.png`

## 结构
见 `docs/ARCHITECTURE.md`。
