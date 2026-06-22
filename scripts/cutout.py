#!/usr/bin/env python3
"""把「月薪喵」源 GIF 处理成桌宠用的动画 WebP + 透明 PNG 帧 + 命中剪影 mask。

当前源 `assets/source/cat-source.gif` 自带透明背景（GIF 二值 alpha，背景已透明），
所以不再需要旧白底源那套四角 flood-fill 抠图——直接读 GIF 各帧的 alpha 即可。
PIL 会按 GIF 的 disposal 信息正确合成每一帧，无需 ffmpeg 预先抽帧。

用法：在项目根目录跑 `python3 scripts/cutout.py`
"""
from PIL import Image, ImageSequence, ImageFilter
import numpy as np
import os

SRC = "assets/source/cat-source.gif"  # 透明背景源 GIF
OUTF = "assets/frames_cut"            # 逐帧透明 PNG（make_icons.py 取 c_001.png 当头像）
PAD = 8                                # 主体四周留白(px)
ALPHA_MIN = 8                          # 判定"不透明"的 alpha 下限（滤掉 GIF 边缘噪点）

os.makedirs(OUTF, exist_ok=True)

# 1) 直接读 GIF 各帧 -> RGBA（PIL 自动按 disposal 合成）
src = Image.open(SRC)
# 必须在迭代中当场转换+读时长：ImageSequence.Iterator 每次复用同一对象 seek 到不同帧，
# 先 list() 再统一转换会让所有帧都变成最后一帧（动画塌成一张图）。
frames, durations = [], []
for f in ImageSequence.Iterator(src):
    durations.append(f.info.get("duration", 40))
    frames.append(f.convert("RGBA"))
assert frames, f"读不到帧：{SRC}"
frame_ms = durations[0] if durations else 40
w, h = frames[0].size


def opaque_bbox(im):
    """单帧不透明区域的包围盒。"""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > ALPHA_MIN)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


# 2) 所有帧的并集 bbox（猫在抖，逐帧略有差异，取并集保证不裁到、不抖动）
boxes = [b for b in (opaque_bbox(im) for im in frames) if b]
x0 = max(0, min(b[0] for b in boxes) - PAD)
y0 = max(0, min(b[1] for b in boxes) - PAD)
x1 = min(w - 1, max(b[2] for b in boxes) + PAD)
y1 = min(h - 1, max(b[3] for b in boxes) + PAD)
crop = (x0, y0, x1 + 1, y1 + 1)
cuts = [f.crop(crop) for f in frames]
print("union bbox:", (x0, y0, x1, y1), "-> canvas", cuts[0].size)

for i, c in enumerate(cuts, 1):
    c.save(f"{OUTF}/c_{i:03d}.png")

# 3) 命中检测剪影 mask：所有帧不透明区域的并集，向外扩 1px 让"抓猫"更宽容
union = np.zeros(cuts[0].size[::-1], dtype=bool)
for c in cuts:
    union |= np.array(c)[:, :, 3] > ALPHA_MIN
mask = Image.fromarray((union * 255).astype("uint8"), "L").filter(ImageFilter.MaxFilter(3))
mask.save("assets/mask.png")

# 4) 组装动画 WebP（无损、无限循环，帧速跟随源原生节奏）
cuts[0].save(
    "assets/cat.webp", save_all=True, append_images=cuts[1:],
    duration=frame_ms, loop=0, lossless=True, disposal=2, method=6,
)
# APNG 备份（个别环境对 WebP 支持差时可用）
cuts[0].save(
    "assets/cat.apng", save_all=True, append_images=cuts[1:],
    duration=frame_ms, loop=0, disposal=2, format="PNG",
)

# 5) 透明度自检：第 1 帧合到品红底 + 中间帧合到深灰底（深色底最能暴露白色毛边）
mid = len(cuts) // 2
for tag, frame in (("magenta", cuts[0]), ("dark", cuts[mid])):
    color = (255, 0, 255, 255) if tag == "magenta" else (40, 42, 48, 255)
    bg = Image.new("RGBA", frame.size, color)
    Image.alpha_composite(bg, frame).convert("RGB").save(f"assets/_verify_{tag}.png")

a0 = np.array(cuts[0])
opaque = int((a0[:, :, 3] > ALPHA_MIN).sum())
total = cuts[0].size[0] * cuts[0].size[1]
print(f"canvas {cuts[0].size}  不透明像素 {opaque}/{total} ({100*opaque//total}%)  "
      f"帧数 {len(cuts)}  帧时长 {frame_ms}ms")
print("done -> assets/cat.webp, assets/cat.apng, assets/mask.png")
