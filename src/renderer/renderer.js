// 渲染层：用剪影 mask 做逐像素命中检测 + 拖拽；接收主进程推送换动作 / 控制气泡。
// 透明区域 -> 通知主进程鼠标穿透；猫身子 -> 可交互、可一把抓起拖走。
const api = window.pet;

let maskData = null;
let MW = 0;
let MH = 0;
let interactive = false;
let drag = null;

const catEl = document.getElementById('cat');
const bubbleEl = document.getElementById('bubble');
const bubbleTextEl = document.getElementById('bubble-text');

function setCat(url) {
  if (url) catEl.src = url;
}

// 双缓冲加载 mask：新图 onload 完成后再整体替换 maskData，避免换动作瞬间命中错位。
function loadMask(url) {
  const mask = new Image();
  mask.onload = () => {
    const cv = document.createElement('canvas');
    const w = (cv.width = mask.naturalWidth);
    const h = (cv.height = mask.naturalHeight);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(mask, 0, 0);
    maskData = ctx.getImageData(0, 0, w, h).data;
    MW = w;
    MH = h;
  };
  mask.src = url;
}

// object-fit:contain 下，mask/猫在 img 元素内的实际绘制矩形（居中、可能有留白）。
function drawnRect() {
  if (!MW || !MH) return null;
  const r = catEl.getBoundingClientRect();
  const scale = Math.min(r.width / MW, r.height / MH);
  const dw = MW * scale;
  const dh = MH * scale;
  return { ox: r.left + (r.width - dw) / 2, oy: r.top + (r.height - dh) / 2, dw, dh };
}

function overCat(x, y) {
  if (!maskData) return false;
  const rect = drawnRect();
  if (!rect) return false;
  const mx = Math.floor(((x - rect.ox) / rect.dw) * MW);
  const my = Math.floor(((y - rect.oy) / rect.dh) * MH);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return false;
  return maskData[(my * MW + mx) * 4] > 40; // L 画到 canvas 后取 R 通道：白=猫
}

function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  api.setInteractive(on);
}

// 初始资源（主进程算好真实路径，避免 asar 内相对路径问题）
(async () => {
  const { catURL, maskURL } = await api.getAssets();
  setCat(catURL);
  loadMask(maskURL);
})();

// 换动作过渡：先淡出旧图，淡出完再换图+mask 淡入，避免硬切突兀。
// FADE_MS 必须与 style.css 里 #cat 的 transition 时长一致。
const FADE_MS = 150;
let fadeTimer = null;

// 主进程推送换动作（cat 图 + mask 同换）
api.onSetAction(({ catURL, maskURL }) => {
  clearTimeout(fadeTimer); // 连续换动作时丢弃上一次未完成的过渡，避免叠加
  catEl.style.opacity = '0';
  fadeTimer = setTimeout(() => {
    maskData = null; // 先清旧 mask：新 mask 加载完前命中检测一律返回 false，避免按旧剪影误判
    setCat(catURL);
    loadMask(maskURL);
    catEl.style.opacity = '1';
  }, FADE_MS);
});

// 主进程控制提醒气泡显示/隐藏
api.onBubble(({ text }) => {
  if (text) {
    bubbleTextEl.textContent = text;
    bubbleEl.classList.remove('hidden');
  } else {
    bubbleEl.classList.add('hidden');
  }
});

window.addEventListener('mousemove', (e) => {
  if (drag) {
    api.dragMove(e.screenX - drag.sx, e.screenY - drag.sy);
    return;
  }
  setInteractive(overCat(e.clientX, e.clientY));
});

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!overCat(e.clientX, e.clientY)) return;
  drag = { sx: e.screenX, sy: e.screenY };
  api.dragStart();
});

window.addEventListener('mouseup', () => {
  if (!drag) return;
  drag = null;
  api.dragEnd();
});

// 拖拽中若失焦，复位避免卡死（交互时窗口可获焦，blur 才会触发）
window.addEventListener('blur', () => {
  if (drag) {
    drag = null;
    api.dragEnd();
  }
});
