// 行为状态机（中枢）：协调待机换动作、随机漫游、提醒、拖拽，保证它们不打架。
// 优先级（高->低）：DRAG > REMIND > ROAM > IDLE。高优先级抢占低优先级。
// motion 算法在 wander.js，动作挑选在 actions.js，本文件只做调度与状态转移。
const { easeTo, dvdRoam } = require('./wander');
const { homePosition } = require('./petWindow');
const { currentBucket, pickAction, isTransient, pickPose } = require('./actions');
const { createReminders } = require('./reminders');
const { phraseFor } = require('./phrases');

const STATE = { IDLE: 'idle', ROAM: 'roam', REMIND: 'remind', DRAG: 'drag' };
const PRIORITY = { idle: 0, roam: 1, remind: 2, drag: 3 };
const HOME_DUR = 600; // 回角落缓动时长(ms)
const REMIND_ROUNDS = 2; // 提醒"走一段-停下弹气泡"的轮数
const SETTLE_POSE = 'kun'; // 过场动作播完退回的兜底姿势（最安静的动作；当前时段池里没有长驻类时用）

const envNum = (key, fallback) => {
  const v = Number(process.env[key]);
  return v > 0 ? v : fallback;
};

function createBehavior(win, settings, geom) {
  let cfg = settings.getAll();
  let state = STATE.IDLE;
  let cancelMotion = null; // 当前 motion 的取消函数；任意时刻至多一个
  let roamTimer = null;
  let idleTimer = null;
  let bubbleTimer = null;
  let gestureTimer = null; // 过场动作播完退回长驻姿势的定时器；只在 IDLE 期间存在
  let lastAction = null;
  const remindQueue = []; // 拖拽/提醒进行中时到点的提醒先排队

  const reminders = createReminders(() => cfg, onReminderFire);

  const stopMotion = () => { if (cancelMotion) { cancelMotion(); cancelMotion = null; } };
  const clearTimers = () => {
    clearTimeout(roamTimer); clearTimeout(idleTimer); clearTimeout(bubbleTimer); clearTimeout(gestureTimer);
    roamTimer = null; idleTimer = null; bubbleTimer = null; gestureTimer = null;
  };
  // 用 >= 是为了"同级也能重入"（如已在 ROAM 时托盘再点乱跑会重启 motion，enterRoam 先 stopMotion 不会叠加）。
  // 唯一例外是 REMIND：不能被另一个排队提醒重入打断，故 tryStartRemind 自己显式判 state，不走 canEnter。
  const canEnter = (target) => PRIORITY[target] >= PRIORITY[state];

  // 挑一个待机动作并显示。过场类（拍照/睡觉/电脑）按 holdSec 播几秒就退回长驻姿势，避免一直循环；
  // 长驻类（摆手/趴着/困）保持循环到下一次 switch。
  function playIdleAction() {
    clearTimeout(gestureTimer);
    gestureTimer = null;
    const bucket = currentBucket(new Date(), cfg.schedule);
    const name = pickAction(bucket, cfg.schedule, lastAction);
    lastAction = name;
    win.pushAction(name);
    if (!isTransient(name, cfg.idle.holdSec)) return; // 长驻类：保持循环
    const ms = cfg.idle.holdSec[name] * 1000;
    gestureTimer = setTimeout(() => {
      gestureTimer = null;
      if (state !== STATE.IDLE) return;
      // 退回时重新取时段：hold 的 10~12 秒内可能跨过时段边界，不能复用上面算好的 bucket
      const b = currentBucket(new Date(), cfg.schedule);
      const pose = pickPose(b, cfg.schedule, cfg.idle.holdSec, lastAction) || SETTLE_POSE;
      lastAction = pose;
      win.pushAction(pose);
    }, ms);
  }

  // ---------- IDLE：趴角落，按时间段定时换待机动作 ----------
  function enterIdle() {
    state = STATE.IDLE;
    playIdleAction();
    scheduleIdleSwitch();
    scheduleRoam();
    tryStartRemind(); // 处理拖拽/上一次提醒期间排队的提醒
  }

  function scheduleIdleSwitch() {
    clearTimeout(idleTimer);
    idleTimer = null;
    if (!cfg.idle.enabled) return;
    const ms = envNum('PET_IDLE_SWITCH_MS', cfg.idle.switchMin * 60 * 1000);
    idleTimer = setTimeout(() => {
      if (state !== STATE.IDLE) return;
      playIdleAction();
      scheduleIdleSwitch();
    }, ms);
  }

  // ---------- ROAM：DVD 屏保式随机漫游（独立开关） ----------
  function scheduleRoam() {
    clearTimeout(roamTimer);
    roamTimer = null;
    if (!cfg.roam.enabled) return;
    const ms = envNum('PET_ROAM_EVERY_MS', cfg.roam.everyMin * 60 * 1000);
    roamTimer = setTimeout(startRoam, ms);
  }

  function startRoam() {
    if (!cfg.roam.enabled || !canEnter(STATE.ROAM)) { scheduleRoam(); return; }
    enterRoam();
  }

  function enterRoam() {
    stopMotion();
    clearTimers();
    state = STATE.ROAM;
    win.pushAction(null); // 漫游用跳舞猫
    const dur = envNum('PET_ROAM_DUR_MS', cfg.roam.durationSec * 1000);
    cancelMotion = dvdRoam(win, { durationMs: dur, inset: geom.inset, onDone: returnHome });
  }

  // ---------- REMIND：到点跳出来"走一段-停下弹气泡-停几秒-收气泡-再走"，最后回角落 ----------
  // onFire 由 reminders 定时器调用；拖拽/正在提醒时排队，回 IDLE 再处理。
  function onReminderFire(kind) {
    remindQueue.push(kind);
    tryStartRemind();
  }

  function tryStartRemind() {
    if (remindQueue.length === 0) return;
    if (state === STATE.DRAG || state === STATE.REMIND) return; // 排队等待
    enterRemind(remindQueue.shift());
  }

  function enterRemind(kind) {
    stopMotion();
    clearTimers();
    state = STATE.REMIND;
    win.pushBubble(null); // 先确保气泡隐藏
    win.pushAction(null); // 提醒时用跳舞猫
    runRemindCycle(kind, 0);
  }

  function runRemindCycle(kind, round) {
    if (state !== STATE.REMIND) return;
    if (round >= REMIND_ROUNDS) { win.pushBubble(null); returnHome(); return; }
    // 1) 走一小段（恒速漫游），到点 onDone 再停下弹气泡——绝不边走边弹，保证文字可读
    const walkMs = envNum('PET_REMIND_WALK_MS', 2600);
    cancelMotion = dvdRoam(win, {
      durationMs: walkMs, speed: 1.8, inset: geom.inset,
      onDone: () => {
        // ⚠️ 此回调必须保持同步：从 cancelMotion=null 到 bubbleTimer 设好之间不能 await，
        // 否则会出现"气泡已显示但既无 cancelMotion 也无 bubbleTimer 可取消"的空窗。
        cancelMotion = null;
        if (state !== STATE.REMIND) return;
        win.pushBubble(phraseFor(kind)); // 2) 停下显示气泡
        const holdMs = envNum('PET_REMIND_BUBBLE_MS', 3200);
        bubbleTimer = setTimeout(() => { // 3) 停留几秒
          bubbleTimer = null;
          if (state !== STATE.REMIND) return;
          win.pushBubble(null);                // 4) 收气泡
          runRemindCycle(kind, round + 1);     // 5) 再走到另一处
        }, holdMs);
      },
    });
  }

  // ---------- 回角落 -> IDLE ----------
  function returnHome() {
    stopMotion();
    const [hx, hy] = homePosition();
    cancelMotion = easeTo(win, hx, hy, HOME_DUR, () => {
      cancelMotion = null;
      enterIdle();
    });
  }

  // ---------- DRAG：拖拽（最高优先级，抢占一切） ----------
  function onGrab() {
    stopMotion();
    clearTimers();
    if (state === STATE.REMIND) win.pushBubble(null); // 拖走时收掉气泡
    state = STATE.DRAG; // 保持当前动作，不强制换图
  }

  function onRelease() {
    if (state !== STATE.DRAG) return;
    returnHome(); // 缓动回角落后自动 enterIdle
  }

  // ---------- 托盘 / 设置入口 ----------
  function setRoamEnabled(on) {
    cfg = settings.merge({ roam: { enabled: !!on } });
    if (!on) { clearTimeout(roamTimer); roamTimer = null; }
    else if (state === STATE.IDLE) scheduleRoam();
  }
  const isRoamEnabled = () => cfg.roam.enabled;
  const roamNow = () => { if (canEnter(STATE.ROAM)) enterRoam(); };

  // 设置页保存后热生效。
  function applyConfig(partial) {
    cfg = partial ? settings.merge(partial) : settings.getAll();
    reminders.reschedule();
    if (state === STATE.IDLE) { scheduleIdleSwitch(); scheduleRoam(); }
  }

  function start() {
    reminders.start();
    enterIdle();
  }

  return {
    start,
    onGrab,
    onRelease,
    setRoamEnabled,
    isRoamEnabled,
    roamNow,
    applyConfig,
  };
}

module.exports = { createBehavior, STATE, PRIORITY };
