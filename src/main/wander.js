// Motion 库（纯移动算法，不含调度/状态）：缓动平移 + DVD 屏保式漫游。
// 由 behavior.js 调度。每个函数返回一个 cancel()，调用即停（切状态时用）。
const { screen } = require('electron');

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// 缓动平移到 (tx,ty)，dur 毫秒，到达后 done()。用于"回角落"。
function easeTo(win, tx, ty, dur, done) {
  const [sx, sy] = win.getPosition();
  const t0 = Date.now();
  let cancelled = false;
  (function step() {
    if (cancelled || win.isDestroyed()) return;
    const k = Math.min(1, (Date.now() - t0) / dur);
    const e = easeInOut(k);
    win.setPosition(Math.round(sx + (tx - sx) * e), Math.round(sy + (ty - sy) * e));
    if (k < 1) setTimeout(step, 16);
    else if (done && !win.isDestroyed()) done();
  })();
  return () => { cancelled = true; };
}

// DVD / 气泡屏保式漫游：恒速直线移动，碰到可视边界就反弹（速度分量取反 + 钳回边界）。
// inset = 窗口四周透明边距，使"可视猫"贴屏幕边反弹，而非更大的透明窗口框。
// durationMs 后停止并 onDone()。
function dvdRoam(win, { durationMs, speed = 1.6, inset = { left: 0, right: 0, top: 0, bottom: 0 }, onDone }) {
  const wa = screen.getPrimaryDisplay().workArea;
  const [w, h] = win.getSize();
  // 窗口左上角坐标的活动范围（按可视猫贴边换算）
  const minX = wa.x - inset.left;
  const maxX = wa.x + wa.width - w + inset.right;
  const minY = wa.y - inset.top;
  const maxY = wa.y + wa.height - h + inset.bottom;

  let [x, y] = win.getPosition();
  const ang = Math.random() * Math.PI * 2; // 随机初始方向
  let vx = Math.cos(ang) * speed;
  let vy = Math.sin(ang) * speed;
  const t0 = Date.now();
  let cancelled = false;

  (function step() {
    if (cancelled || win.isDestroyed()) return;
    x += vx;
    y += vy;
    if (x <= minX) { x = minX; vx = Math.abs(vx); }
    else if (x >= maxX) { x = maxX; vx = -Math.abs(vx); }
    if (y <= minY) { y = minY; vy = Math.abs(vy); }
    else if (y >= maxY) { y = maxY; vy = -Math.abs(vy); }
    win.setPosition(Math.round(x), Math.round(y));
    if (Date.now() - t0 < durationMs) setTimeout(step, 16);
    else if (onDone) onDone();
  })();

  return () => { cancelled = true; };
}

module.exports = { easeTo, dvdRoam };
