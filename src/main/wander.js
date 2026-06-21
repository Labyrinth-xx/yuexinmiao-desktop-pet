// 乱跑引擎：平时待机，每隔随机几分钟缓动平移到屏幕内随机位置（"偶尔捣乱"）。
const { screen } = require('electron');

// 可用环境变量覆盖待机时长（便于调参/自测，正常运行不需要设）
const envNum = (key, fallback) => {
  const v = Number(process.env[key]);
  return v > 0 ? v : fallback;
};

function createWander(win, opts = {}) {
  const MIN = opts.minIdleMs ?? envNum('PET_MIN_IDLE_MS', 3 * 60 * 1000); // 最短待机 3 分钟
  const MAX = opts.maxIdleMs ?? envNum('PET_MAX_IDLE_MS', 8 * 60 * 1000); // 最长待机 8 分钟
  const DUR = opts.moveMs ?? envNum('PET_MOVE_MS', 1500); // 一次平移时长

  let timer = null;
  let paused = false;
  let dragging = false;

  const rint = (a, b) => Math.floor(a + Math.random() * Math.max(1, b - a));
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  function schedule() {
    clearTimeout(timer);
    if (paused || dragging) return;
    timer = setTimeout(trip, rint(MIN, MAX));
  }

  function trip() {
    if (paused || dragging || win.isDestroyed()) return;
    const wa = screen.getPrimaryDisplay().workArea;
    const [w, h] = win.getSize();
    const tx = rint(wa.x, wa.x + Math.max(1, wa.width - w));
    const ty = rint(wa.y, wa.y + Math.max(1, wa.height - h));
    moveTo(tx, ty, DUR, schedule);
  }

  function moveTo(tx, ty, dur, done) {
    const [sx, sy] = win.getPosition();
    const t0 = Date.now();
    (function step() {
      if (dragging || win.isDestroyed()) return; // 被抓走就停
      const k = Math.min(1, (Date.now() - t0) / dur);
      const e = easeInOut(k);
      win.setPosition(Math.round(sx + (tx - sx) * e), Math.round(sy + (ty - sy) * e));
      if (k < 1) setTimeout(step, 16);
      else if (done) done();
    })();
  }

  return {
    start: schedule,
    wanderNow: () => { if (!dragging && !paused) trip(); },
    setPaused: (p) => { paused = p; if (p) clearTimeout(timer); else schedule(); },
    isPaused: () => paused,
    pauseForDrag: () => { dragging = true; clearTimeout(timer); },
    resumeFromDrag: () => { dragging = false; schedule(); },
  };
}

module.exports = { createWander };
