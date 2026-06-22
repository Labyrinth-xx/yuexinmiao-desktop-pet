#!/usr/bin/env python3
"""把「月薪喵」源 GIF 处理成桌宠用的动画 WebP + 命中剪影 mask。

两类素材：
1) 主漫游素材 `assets/source/cat-source.gif`（跳舞猫，自带透明背景）
   -> assets/cat.webp + assets/mask.png + assets/cat.apng + 逐帧 PNG（make_icons 取头像用）
2) 待机动作 `assets/source/actions/<name>.gif`（每个一种状态）
   -> assets/actions/<name>/{cat.webp,mask.png}

透明判定：首帧透明像素占比 < 5% 视为"不透明场景图"（如「半夜看电脑」带电脑背景），
按用户要求保留背景不抠（mask = 全白矩形）；其余走 alpha 抠图路径。

用法：在项目根目录跑 `python3 scripts/cutout.py`
"""
from PIL import Image, ImageSequence, ImageFilter
import numpy as np
import glob
import os

MAIN_SRC = "assets/source/cat-source.gif"  # 主漫游素材（透明背景）
FRAMES_OUT = "assets/frames_cut"           # 逐帧透明 PNG（make_icons.py 取 c_001.png 当头像）
ACTIONS_SRC = "assets/source/actions"      # 待机动作源 GIF 目录
ACTIONS_OUT = "assets/actions"             # 待机动作输出目录
PAD = 8                                     # 主体四周留白(px)
ALPHA_MIN = 8                               # 判定"不透明"的 alpha 下限（滤掉 GIF 边缘噪点）
OPAQUE_RATIO = 0.05                          # 透明像素占比低于此 -> 视为保留背景的场景图


def load_frames(src):
    """读 GIF 各帧 -> RGBA（PIL 自动按 disposal 合成），返回 (frames, frame_ms)。

    必须在迭代中当场转换：ImageSequence.Iterator 复用同一对象 seek 到不同帧，
    先 list() 再统一转换会让所有帧塌成最后一帧。
    """
    im = Image.open(src)
    frames, durations = [], []
    for f in ImageSequence.Iterator(im):
        durations.append(f.info.get("duration", 40))
        frames.append(f.convert("RGBA"))
    assert frames, f"读不到帧：{src}"
    return frames, (durations[0] if durations else 40)


def trim_blank_edges(frames):
    """去掉首尾整帧全透明的帧（有些源 GIF 有空白引导帧，会导致循环时闪一下空）。"""
    def blank(im):
        return int((np.array(im)[:, :, 3] > ALPHA_MIN).sum()) == 0
    start, end = 0, len(frames)
    while start < end - 1 and blank(frames[start]):
        start += 1
    while end - 1 > start and blank(frames[end - 1]):
        end -= 1
    return frames[start:end]


def opaque_bbox(im):
    """单帧不透明区域的包围盒。"""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > ALPHA_MIN)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def union_crop(frames):
    """所有帧不透明区的并集包围盒（猫在抖，取并集保证不裁到、不抖动）。"""
    w, h = frames[0].size
    boxes = [b for b in (opaque_bbox(im) for im in frames) if b]
    if not boxes:  # 整段全透明：不裁，返回整帧，避免 min() 空序列崩溃
        return (0, 0, w, h)
    x0 = max(0, min(b[0] for b in boxes) - PAD)
    y0 = max(0, min(b[1] for b in boxes) - PAD)
    x1 = min(w - 1, max(b[2] for b in boxes) + PAD)
    y1 = min(h - 1, max(b[3] for b in boxes) + PAD)
    return (x0, y0, x1 + 1, y1 + 1)


def alpha_mask(cuts):
    """命中剪影 mask：所有帧不透明区并集，向外扩 1px 让"抓猫"更宽容。"""
    union = np.zeros(cuts[0].size[::-1], dtype=bool)
    for c in cuts:
        union |= np.array(c)[:, :, 3] > ALPHA_MIN
    return Image.fromarray((union * 255).astype("uint8"), "L").filter(ImageFilter.MaxFilter(3))


def save_webp(cuts, path, frame_ms):
    """无损、无限循环动画 WebP，帧速跟随源原生节奏。"""
    cuts[0].save(
        path, save_all=True, append_images=cuts[1:],
        duration=frame_ms, loop=0, lossless=True, disposal=2, method=6,
    )


def is_opaque_scene(frames):
    """首帧透明像素占比低于阈值 -> 不透明场景图（保留背景）。"""
    a = np.array(frames[0])[:, :, 3]
    return (a <= ALPHA_MIN).mean() < OPAQUE_RATIO


def report(tag, name, cuts, frame_ms):
    a0 = np.array(cuts[0])
    opaque = int((a0[:, :, 3] > ALPHA_MIN).sum())
    total = cuts[0].size[0] * cuts[0].size[1]
    print(f"  [{tag}] {name}: canvas {cuts[0].size}  帧 {len(cuts)}  "
          f"帧时长 {frame_ms}ms  不透明 {100 * opaque // total}%")


def process_action(src, out_dir):
    """处理一个待机动作 GIF -> out_dir/{cat.webp,mask.png}。"""
    frames, frame_ms = load_frames(src)
    os.makedirs(out_dir, exist_ok=True)
    name = os.path.basename(out_dir)
    if is_opaque_scene(frames):
        # 保留背景：整帧不抠，mask = 全白矩形（整块可命中/拖拽）
        cuts = frames
        Image.new("L", cuts[0].size, 255).save(os.path.join(out_dir, "mask.png"))
        tag = "keep-bg"
    else:
        frames = trim_blank_edges(frames)
        crop = union_crop(frames)
        cuts = [f.crop(crop) for f in frames]
        alpha_mask(cuts).save(os.path.join(out_dir, "mask.png"))
        tag = "alpha"
    save_webp(cuts, os.path.join(out_dir, "cat.webp"), frame_ms)
    report(tag, name, cuts, frame_ms)


def process_main():
    """主漫游素材：cat.webp + mask.png + cat.apng + 逐帧 PNG + 透明自检图。"""
    os.makedirs(FRAMES_OUT, exist_ok=True)
    frames, frame_ms = load_frames(MAIN_SRC)
    crop = union_crop(frames)
    cuts = [f.crop(crop) for f in frames]
    print("主漫游素材 union crop ->", cuts[0].size)

    for i, c in enumerate(cuts, 1):
        c.save(f"{FRAMES_OUT}/c_{i:03d}.png")

    alpha_mask(cuts).save("assets/mask.png")
    save_webp(cuts, "assets/cat.webp", frame_ms)
    # APNG 备份（个别环境对 WebP 支持差时可用）
    cuts[0].save(
        "assets/cat.apng", save_all=True, append_images=cuts[1:],
        duration=frame_ms, loop=0, disposal=2, format="PNG",
    )
    # 透明度自检：第 1 帧合到品红底 + 中间帧合到深灰底（深色底最能暴露白色毛边）
    mid = len(cuts) // 2
    for tag, frame in (("magenta", cuts[0]), ("dark", cuts[mid])):
        color = (255, 0, 255, 255) if tag == "magenta" else (40, 42, 48, 255)
        bg = Image.new("RGBA", frame.size, color)
        Image.alpha_composite(bg, frame).convert("RGB").save(f"assets/_verify_{tag}.png")
    report("main", "cat", cuts, frame_ms)


def process_actions():
    srcs = sorted(glob.glob(os.path.join(ACTIONS_SRC, "*.gif")))
    if not srcs:
        print(f"（无待机动作源：{ACTIONS_SRC}/*.gif，跳过）")
        return
    print(f"待机动作（{len(srcs)} 个）-> {ACTIONS_OUT}/<name>/")
    for src in srcs:
        name = os.path.splitext(os.path.basename(src))[0]
        process_action(src, os.path.join(ACTIONS_OUT, name))


if __name__ == "__main__":
    process_main()
    process_actions()
    print("done -> assets/cat.webp, assets/mask.png, assets/actions/<name>/")
