// 渲染层：用剪影 mask 做逐像素命中检测 + 拖拽。
// 透明区域 -> 通知主进程鼠标穿透；猫身子 -> 可交互、可一把抓起拖走。
const api = window.pet;

let maskData = null;
let MW = 0;
let MH = 0;
let interactive = false;
let drag = null;

// 资源真实路径由主进程给（避免 asar 内相对路径问题），拿到后再设图与 mask
(async () => {
  const { catURL, maskURL } = await api.getAssets();
  document.getElementById('cat').src = catURL;

  const mask = new Image();
  mask.onload = () => {
    const cv = document.createElement('canvas');
    MW = cv.width = mask.naturalWidth;
    MH = cv.height = mask.naturalHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(mask, 0, 0);
    maskData = ctx.getImageData(0, 0, MW, MH).data;
  };
  mask.src = maskURL;
})();

function overCat(x, y) {
  if (!maskData) return false;
  const mx = Math.floor((x * MW) / window.innerWidth);
  const my = Math.floor((y * MH) / window.innerHeight);
  if (mx < 0 || my < 0 || mx >= MW || my >= MH) return false;
  return maskData[(my * MW + mx) * 4] > 40; // L 画到 canvas 后取 R 通道：白=猫
}

function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  api.setInteractive(on);
}

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
