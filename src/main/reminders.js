// 提醒定时器：喝水 / 久坐 两个独立计时器，到点回调 onFire(kind)。
// 只管"到点通知"，怎么表现（漫游+气泡）交给 behavior。可被环境变量覆盖间隔（自测用）。
const ENV = { water: 'PET_WATER_MS', standup: 'PET_STANDUP_MS' };

const envNum = (key, fallback) => {
  const v = Number(process.env[key]);
  return v > 0 ? v : fallback;
};

// getCfg() 返回完整配置（含 reminders.{water,standup}）；onFire(kind) 到点回调。
function createReminders(getCfg, onFire) {
  const timers = { water: null, standup: null };

  const intervalMs = (kind) =>
    envNum(ENV[kind], getCfg().reminders[kind].intervalMin * 60 * 1000);

  function arm(kind) {
    clearTimeout(timers[kind]);
    timers[kind] = null;
    if (!getCfg().reminders[kind].enabled) return;
    timers[kind] = setTimeout(() => {
      onFire(kind);
      arm(kind); // 触发后按最新间隔重新计时
    }, intervalMs(kind));
  }

  const armAll = () => { arm('water'); arm('standup'); };

  return {
    start: armAll,
    reschedule: armAll, // 设置页改间隔/开关后重排
    stop: () => { clearTimeout(timers.water); clearTimeout(timers.standup); },
  };
}

module.exports = { createReminders };
