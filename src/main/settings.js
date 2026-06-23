// 极简持久化设置：存到 userData/settings.json，无第三方依赖。
// 读取时与 DEFAULTS 深合并，保证老 settings.json 平滑升级、新字段自动补默认。
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// 所有功能配置的默认值（时间单位用分钟，对设置页友好，内部再转 ms）。
const DEFAULTS = Object.freeze({
  initialized: false,
  autoLaunch: false,
  reminders: {
    water: { enabled: true, intervalMin: 45 },
    standup: { enabled: true, intervalMin: 50 },
  },
  roam: { enabled: true, everyMin: 6, durationSec: 12 },
  // 动作分三档：① 长驻（摆手/趴着/困）——不在 holdSec 里，循环到下次 switch；
  // ② 偶尔（睡觉/电脑）——播 holdSec 秒就退回长驻姿势；③ 极短（拍照）——播很短就退回。
  // 改某动作的播放时长只改 holdSec（单位：秒），不改代码。
  idle: { enabled: true, switchMin: 3, holdSec: { paizhao: 3, pawo: 10, shuijiao: 12, kandiannao: 12 } },
  // 时间段 -> 动作名池。动作名 = assets/actions/<name>/ 目录名。
  // 改时间段或加动作只改这里，不改代码。
  // 每个时段池至少留一个"长驻"动作（不在 holdSec 里），供过场动作播完后退回。
  schedule: {
    day: { from: 6, to: 18, actions: ['paizhao', 'pawo', 'kun'] },
    dusk: { from: 18, to: 23, actions: ['pawo', 'baishou', 'kun'] },
    night: { from: 23, to: 6, actions: ['kandiannao', 'shuijiao', 'kun'] },
  },
});

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// 深合并：over 覆盖 base；数组整体替换（用户可自定义动作列表）。
function deepMerge(base, over) {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out = { ...base };
  for (const key of Object.keys(over)) out[key] = deepMerge(base[key], over[key]);
  return out;
}

class Settings {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = {};
    }
  }

  // 原始单键读写（保留给 firstRunDefaults 等老调用点）
  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data = { ...this.data, [key]: value };
    this.flush();
  }

  // 与默认值深合并后的完整配置（功能模块都用这个读）。
  // 深拷贝返回：保证调用方拿到的永远是独立副本，绝不会引用到 DEFAULTS 子对象。
  getAll() {
    return JSON.parse(JSON.stringify(deepMerge(DEFAULTS, this.data)));
  }

  // 合并写入部分配置（设置页保存用），返回合并后的完整配置
  merge(partial) {
    this.data = deepMerge(this.data, partial);
    this.flush();
    return this.getAll();
  }

  flush() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch {
      /* 写失败不致命，忽略 */
    }
  }
}

module.exports = Settings;
module.exports.DEFAULTS = DEFAULTS;
