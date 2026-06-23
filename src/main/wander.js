// Motion 库（纯移动算法，不含调度/状态）：缓动平移 + DVD 屏保式漫游。
// 由 behavior.js 调度。每个函数返回一个 cancel()，调用即停（切状态时用）。
const { screen } = require('electron');

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

// 坐标边界兜底：屏幕/窗口 API 极少数情况下会给出非有限值（多屏热插拔、display 切换、
// 窗口过渡态），直接喂给 setPosition 会让 Electron 抛 "conversion failure" 崩主进程。
// 统一拦在这层：非法坐标跳过该帧并留痕，绝不让 NaN 进入系统接口。
const fin = (v) => Number.isFinite(v);
function setPos(win, x, y) {
  if (!fin(x) || !fin(y)) {
    console.warn('[pet] 跳过非法坐标 setPosition:', x, y); // 留痕以便复发时定位根因
    return;
  }
  win.setPosition(Math.round(x), Math.round(y));
}
// 读窗口坐标；读到非有限值时回退到 fallback（一对 [x,y]），保证后续运算不被 NaN 污染。
function readPos(win, fallback) {
  const [x, y] = win.getPosition();
  return fin(x) && fin(y) ? [x, y] : fallback;
}

// 缓动平移到 (tx,ty)，dur 毫秒，到达后 done()。用于"回角落"。
function easeTo(win, tx, ty, dur, done) {
  const [sx, sy] = readPos(win, [tx, ty]); // 读不到起点就当作已在终点起步
  const t0 = Date.now();
  let cancelled = false;
  (function step() {
    if (cancelled || win.isDestroyed()) return;
    const k = Math.min(1, (Date.now() - t0) / dur);
    const e = easeInOut(k);
    setPos(win, sx + (tx - sx) * e, sy + (ty - sy) * e);
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

  let [x, y] = readPos(win, [minX, minY]); // 读不到当前位就从左上角起步，绝不让 NaN 进入循环
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
    setPos(win, x, y);
    if (Date.now() - t0 < durationMs) setTimeout(step, 16);
    else if (onDone) onDone();
  })();

  return () => { cancelled = true; };
}

module.exports = { easeTo, dvdRoam };
