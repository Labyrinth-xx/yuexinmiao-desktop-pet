// 设置页：加载当前配置填表 -> 改 -> 保存（主进程热生效）。
const api = window.settingsApi;
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
let current = null; // 最近一次从主进程读到的完整配置，作为非法输入的回退值

function fill(cfg) {
  $('water-enabled').checked = cfg.reminders.water.enabled;
  $('water-interval').value = cfg.reminders.water.intervalMin;
  $('standup-enabled').checked = cfg.reminders.standup.enabled;
  $('standup-interval').value = cfg.reminders.standup.intervalMin;
  $('roam-enabled').checked = cfg.roam.enabled;
  $('roam-every').value = cfg.roam.everyMin;
  $('roam-duration').value = cfg.roam.durationSec;
  $('idle-enabled').checked = cfg.idle.enabled;
  $('idle-switch').value = cfg.idle.switchMin;
}

// 读数字，限定在 [min,max]，非法回退到 fallback
function numVal(id, fallback) {
  const el = $(id);
  const n = Math.round(Number(el.value));
  const min = Number(el.min) || 1;
  const max = Number(el.max) || 9999;
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

function collect() {
  const c = current;
  return {
    reminders: {
      water: { enabled: $('water-enabled').checked, intervalMin: numVal('water-interval', c.reminders.water.intervalMin) },
      standup: { enabled: $('standup-enabled').checked, intervalMin: numVal('standup-interval', c.reminders.standup.intervalMin) },
    },
    roam: {
      enabled: $('roam-enabled').checked,
      everyMin: numVal('roam-every', c.roam.everyMin),
      durationSec: numVal('roam-duration', c.roam.durationSec),
    },
    idle: { enabled: $('idle-enabled').checked, switchMin: numVal('idle-switch', c.idle.switchMin) },
  };
}

let statusTimer = null;
function flash(msg) {
  statusEl.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 2000);
}

(async () => {
  current = await api.get();
  fill(current);
})();

$('save').addEventListener('click', async () => {
  if (!current) return; // 配置还没加载完，忽略
  current = await api.save(collect());
  fill(current); // 用回写值刷新（被钳过的数字也同步回来）
  flash('已保存 ✓');
});
