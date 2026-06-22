// 提醒文案库：每种提醒一个小池子，触发时随机抽一条。冻结，不可变。
const WATER = Object.freeze([
  '该喝水啦~',
  '咕噜咕噜，喝口水吧',
  '干了这杯水水！',
  '主人，补充水分时间到~',
  '喝水喝水，别等渴了才想起我',
]);

const STANDUP = Object.freeze([
  '坐太久啦，起来动动~',
  '喵呜，站起来伸个懒腰吧',
  '走两步走两步，腰会谢谢你',
  '久坐伤身，活动一下叭~',
  '起来溜达溜达，我陪你',
]);

const POOLS = Object.freeze({ water: WATER, standup: STANDUP });

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const phraseFor = (kind) => pick(POOLS[kind] || ['喵~']);

module.exports = { WATER, STANDUP, pick, phraseFor };
