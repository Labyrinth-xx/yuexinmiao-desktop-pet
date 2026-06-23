// 提醒模块（活动感知版）：不再是"到点必响"的闹钟，而是按"在电脑前连续坐了多久"来提醒。
// - 用 powerMonitor.getSystemIdleTime() 读"距上次键鼠操作的秒数"，判断人在不在、坐了多久。
// - 离开 ≥ BREAK_SEC（默认 5 分钟）视作真的起身休息了 → 重置计时，回来重新数。
// - 只有"人确实在座"（idle < PRESENT_SEC）时才弹提醒，绝不对着空座位喊。
// 只管"该不该提醒"，怎么表现（漫游+气泡）交给 behavior。阈值可被环境变量覆盖（自测用）。
const { powerMonitor } = require('electron');

const ENV = { water: 'PET_WATER_MS', standup: 'PET_STANDUP_MS' };
const KINDS = ['water', 'standup'];
const TICK_MS = 5000; // 轮询节奏：每 5 秒看一眼活动状态（getSystemIdleTime 极轻量）
const PRESENT_SEC = 60; // 当前空闲 < 60 秒 才算"人在电脑前"，才会真的弹提醒
const DEFAULT_BREAK_SEC = 300; // 离开 ≥ 这么久 = 真休息了 → 重置"连续在座"计时

const envNum = (key, fallback) => {
  const v = Number(process.env[key]);
  return v > 0 ? v : fallback;
};
const breakSec = () => envNum('PET_BREAK_SEC', DEFAULT_BREAK_SEC);

// getCfg() 返回完整配置（含 reminders.{water,standup}）；onFire(kind) 该提醒时回调。
function createReminders(getCfg, onFire) {
  const sittingSince = { water: null, standup: null }; // 每种提醒"连续在座起点"(ms)，null=未在计时
  let ticker = null;

  // 提醒阈值(ms)：默认按设置页的 intervalMin；自测时可用 PET_*_MS 覆盖成很短。
  const thresholdMs = (kind, cfg) => envNum(ENV[kind], cfg.intervalMin * 60 * 1000);

  function tick() {
    const idle = powerMonitor.getSystemIdleTime(); // 距上次键鼠操作的秒数
    const now = Date.now();
    const away = idle >= breakSec();
    const reminders = getCfg().reminders; // 一拍只取一次配置，避免重复读取
    for (const kind of KINDS) {
      const cfg = reminders[kind];
      if (!cfg.enabled) { sittingSince[kind] = null; continue; } // 关了就不计时
      if (away) { sittingSince[kind] = null; continue; }          // 离开够久=已休息→清零，回来重数
      if (sittingSince[kind] === null) sittingSince[kind] = now;  // 人在座的第一拍：开始数
      // 坐够时长 且 人确实在座 → 提醒；提醒后重新计时
      if (now - sittingSince[kind] >= thresholdMs(kind, cfg) && idle < PRESENT_SEC) {
        onFire(kind);
        sittingSince[kind] = now;
      }
      // 否则：没坐够 / 人短暂离开(PRESENT~BREAK 之间) → 不弹，挂着等人回来再说
    }
  }

  function startTicker() {
    if (ticker) return; // 已在跑就不重置，避免改设置时把累计在座时长清零
    const now = Date.now();
    const reminders = getCfg().reminders;
    for (const kind of KINDS) {
      if (reminders[kind].enabled) sittingSince[kind] = now;
    }
    ticker = setInterval(tick, TICK_MS);
  }

  return {
    start: startTicker,
    reschedule: startTicker, // 间隔/开关改动由下一轮 tick 实时读 cfg 生效，只需保证 ticker 在跑
    stop: () => { clearInterval(ticker); ticker = null; for (const k of KINDS) sittingSince[k] = null; },
  };
}

module.exports = { createReminders };
