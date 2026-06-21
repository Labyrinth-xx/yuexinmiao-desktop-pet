#!/usr/bin/env python3
"""把「月薪喵」GIF 抽出的帧抠成透明背景，输出动画 WebP + 透明 PNG 帧。

难点：猫身子是白色、原图背景也是白色 —— 不能按颜色全局抠（会把白身子也抠掉）。
做法：从四个角做 flood-fill，只删「和角连通的白色背景」；猫的深棕描边天然挡住，
身体内部的白不和外部连通，所以保留。原 GIF 底部有 2px 暗色水印条，裁剪时一并去掉。

用法：在项目根目录跑 `python3 scripts/cutout.py`
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import glob
import os

SRC = "assets/frames"        # 输入帧 f_%03d.png（ffmpeg 抽的）
OUTF = "assets/frames_cut"   # 透明帧输出
BAR = 3                      # 底部水印条行数（含安全余量）
PAD = 8                      # 主体四周留白
THRESH = 72                 # flood-fill 颜色容差（白底 vs 棕描边，按需调；调高=吃掉更多浅色毛边）

os.makedirs(OUTF, exist_ok=True)
files = sorted(glob.glob(f"{SRC}/f_*.png"))
assert files, "找不到帧，请先用 ffmpeg 抽帧到 assets/frames/"

imgs = [Image.open(f).convert("RGBA") for f in files]
w, h = imgs[0].size


def cat_bbox(im):
    """猫主体（非白）的包围盒，排除底部水印条。"""
    a = np.array(im)[: h - BAR, :, :3].astype(int)
    nonwhite = a.sum(2) < 735
    ys, xs = np.where(nonwhite)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


# 1) 所有帧的并集 bbox（猫在抖，逐帧略有差异，取并集保证不抖动/不裁到）
boxes = [b for b in (cat_bbox(im) for im in imgs) if b]
x0 = max(0, min(b[0] for b in boxes) - PAD)
y0 = max(0, min(b[1] for b in boxes) - PAD)
x1 = min(w - 1, max(b[2] for b in boxes) + PAD)
y1 = min(h - BAR - 1, max(b[3] for b in boxes) + PAD)
crop = (x0, y0, x1 + 1, y1 + 1)
print("union bbox:", (x0, y0, x1, y1), "-> canvas", (x1 + 1 - x0, y1 + 1 - y0))


# 2) 逐帧裁剪 + 四角 flood-fill 抠白底
def cut(im):
    c = im.crop(crop).copy()
    cw, ch = c.size
    for seed in [(0, 0), (cw - 1, 0), (0, ch - 1), (cw - 1, ch - 1)]:
        ImageDraw.floodfill(c, seed, (255, 255, 255, 0), thresh=THRESH)
    return c


cuts = [cut(im) for im in imgs]
for i, c in enumerate(cuts, 1):
    c.save(f"{OUTF}/c_{i:03d}.png")

# 2.5) 命中检测剪影 mask：所有帧不透明区域的并集，向外扩 1px 让"抓猫"更宽容
union = np.zeros(cuts[0].size[::-1], dtype=bool)
for c in cuts:
    union |= np.array(c)[:, :, 3] > 0
mask = Image.fromarray((union * 255).astype("uint8"), "L").filter(ImageFilter.MaxFilter(3))
mask.save("assets/mask.png")

# 3) 组装动画 WebP（无损、无限循环、10fps -> 100ms/帧）
cuts[0].save(
    "assets/cat.webp", save_all=True, append_images=cuts[1:],
    duration=100, loop=0, lossless=True, disposal=2, method=6,
)
# APNG 备份（个别环境对 WebP 支持差时可用）
cuts[0].save(
    "assets/cat.apng", save_all=True, append_images=cuts[1:],
    duration=100, loop=0, disposal=2, format="PNG",
)

# 4) 透明度自检：第 1 帧分别合到品红底 + 深灰底（深色底最能暴露白色毛边）
mid = len(cuts) // 2
for tag, frame in (("magenta", cuts[0]), ("dark", cuts[mid])):
    color = (255, 0, 255, 255) if tag == "magenta" else (40, 42, 48, 255)
    bg = Image.new("RGBA", frame.size, color)
    Image.alpha_composite(bg, frame).convert("RGB").save(f"assets/_verify_{tag}.png")

a0 = np.array(cuts[0])
opaque = int((a0[:, :, 3] > 0).sum())
total = cuts[0].size[0] * cuts[0].size[1]
print(f"canvas {cuts[0].size}  不透明像素 {opaque}/{total} ({100*opaque//total}%)  帧数 {len(cuts)}")
print("done -> assets/cat.webp, assets/cat.apng, assets/_verify_magenta.png")
