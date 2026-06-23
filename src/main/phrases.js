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
  '颈椎在求救啦，扭扭脖子~',
  '屁股要长根咯，快起来！',
  '抬头看看远方，眼睛也歇歇',
  '来做个深呼吸，吸——呼——',
  '转转肩膀，咔咔响那种~',
  '喵：批准你摸鱼五分钟去走走',
  '腿麻了没？踮踮脚尖叭',
  '站起来接杯水，顺便看看我~',
  '别卷啦，陪本喵伸个懒腰',
  '扭一扭腰，把僵硬甩出去~',
  '起身走两圈，回来更有精神！',
]);

const POOLS = Object.freeze({ water: WATER, standup: STANDUP });

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const phraseFor = (kind) => pick(POOLS[kind] || ['喵~']);

module.exports = { WATER, STANDUP, pick, phraseFor };
