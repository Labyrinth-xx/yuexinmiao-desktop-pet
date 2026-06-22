// 纯函数：按当前时间挑"时间段"，并从该时段动作池随机挑一个待机动作。
// 无副作用、不读磁盘、不依赖 electron —— 方便单测。
// 动作名 = assets/actions/<name>/ 目录名；池子与时间段在 settings.schedule 里配置。

// 支持跨午夜区间（如 night 23->6）。
function inRange(hour, from, to) {
  if (from === to) return true;
  if (from < to) return hour >= from && hour < to;
  return hour >= from || hour < to; // 跨午夜
}

// 返回 'day' | 'dusk' | 'night'。无匹配兜底 'day'。
function currentBucket(date, schedule) {
  const hour = date.getHours();
  for (const key of ['day', 'dusk', 'night']) {
    const b = schedule[key];
    if (b && inRange(hour, b.from, b.to)) return key;
  }
  return 'day';
}

// 从当前时段动作池随机挑一个，尽量不与 lastName 连续重复。池空返回 null。
function pickAction(bucket, schedule, lastName) {
  const pool = (schedule[bucket] && schedule[bucket].actions) || [];
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const candidates = pool.filter((n) => n !== lastName);
  const list = candidates.length ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { inRange, currentBucket, pickAction };
