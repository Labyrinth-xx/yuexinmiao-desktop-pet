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

// 动作是否为"过场类"（播一会儿就退回长驻姿势）：在 holdSec 里配了播放秒数的就是。
// 长驻类（摆手/趴着/困）不在 holdSec 里，会循环到下次 switch。
const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);
const isTransient = (name, holdSec) => !!name && has(holdSec, name);

// 过场动作播完后退回的"长驻"动作：从当前时段池里挑一个不在 holdSec 里的动作，尽量不与 lastName 重复。
// 池里没有长驻类则返回 null（交给上层兜底）。
function pickPose(bucket, schedule, holdSec, lastName) {
  const pool = (schedule[bucket] && schedule[bucket].actions) || [];
  const poses = pool.filter((n) => !has(holdSec, n));
  if (poses.length === 0) return null;
  if (poses.length === 1) return poses[0];
  const candidates = poses.filter((n) => n !== lastName);
  const list = candidates.length ? candidates : poses;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { inRange, currentBucket, pickAction, isTransient, pickPose };
