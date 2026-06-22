#!/usr/bin/env python3
"""从月薪喵真实帧里抠出它自己的线稿，做 macOS 菜单栏模板图标(template image)。

不是手画/臆造的猫——直接取这只猫一帧里的深棕描边(+蓝泪)当线条，所以图标 100% 是
"这只猫的头"。模板图标=黑+alpha，macOS 自动随菜单栏明暗反色（浅栏黑、深栏白）。
因为猫身子是白的，彩色缩到菜单栏会糊掉/在浅色栏看不见，所以走线稿模板最稳。

用法：在项目根目录跑 `python3 scripts/make_tray_icon.py`
"""
from PIL import Image
import numpy as np
import os

SRC = "assets/frames_cut/c_010.png"  # 双爪捂嘴+双泪+对称，最能代表这只猫的脸
LUM_T = 130                          # 棕色描边判定：亮度低于此=线条
PAD = 6                              # 线稿四周留白(源像素)
BASE = 44                            # @2x 边长；@1x = 22
os.makedirs("assets", exist_ok=True)


def extract_lines(path):
    """取真实帧的描边线稿 -> 黑色 RGBA（透明背景）。"""
    assert os.path.exists(path), f"源帧不存在：{path!r}（先跑 cutout.py）"
    a = np.array(Image.open(path).convert("RGBA")).astype(int)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    op = al > 40
    dark = op & (lum < LUM_T)               # 棕色描边
    blue = op & (b > r + 25) & (b > g + 15)  # 招牌蓝泪
    line = dark | blue
    out = np.zeros(line.shape + (4,), np.uint8)
    out[line] = (0, 0, 0, 255)
    return Image.fromarray(out, "RGBA")


def square(im, size):
    """等比缩放居中贴到透明方形画布；高分辨率源下采样做抗锯齿。"""
    bbox = im.getbbox()
    if bbox is None:
        raise ValueError(f"抠出来的线稿是空的：检查 SRC={SRC!r} 与 LUM_T={LUM_T}")
    c = im.crop((max(0, bbox[0] - PAD), max(0, bbox[1] - PAD),
                 min(im.width, bbox[2] + PAD), min(im.height, bbox[3] + PAD)))
    cw, ch = c.size
    side = max(cw, ch)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(c, ((side - cw) // 2, (side - ch) // 2), c)
    return canvas.resize((size, size), Image.LANCZOS)


lines = extract_lines(SRC)
for name, size in (("trayTemplate.png", BASE // 2), ("trayTemplate@2x.png", BASE)):
    square(lines, size).save(f"assets/{name}")
print("done -> assets/trayTemplate.png (22px), assets/trayTemplate@2x.png (44px) "
      f"<- 真实帧 {SRC}")
