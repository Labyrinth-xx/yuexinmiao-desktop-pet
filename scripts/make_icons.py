#!/usr/bin/env python3
"""生成 Windows app 图标(.ico) 和托盘图标(tray.png)，用月薪喵捂嘴款当头像。

用法：在项目根目录跑 `python3 scripts/make_icons.py`（需先跑过 cutout.py 生成透明帧）
"""
from PIL import Image
import os

SRC = "assets/frames_cut/c_001.png"
os.makedirs("assets/build-icons", exist_ok=True)
cat = Image.open(SRC).convert("RGBA")


def square_icon(size, fill_ratio=0.86):
    """把猫等比缩放、居中贴到透明方形画布上。"""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cw, ch = cat.size
    scale = (size * fill_ratio) / max(cw, ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    c = cat.resize((nw, nh), Image.LANCZOS)
    canvas.paste(c, ((size - nw) // 2, (size - nh) // 2), c)
    return canvas


master = square_icon(256)
master.save(
    "assets/build-icons/icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
square_icon(64).save("assets/tray.png")
square_icon(1024).save("assets/build-icons/icon.png")  # mac .icns 由 electron-builder 从此 png 生成，需 >=512
print("icons done -> assets/build-icons/icon.ico, assets/tray.png, assets/build-icons/icon.png")
