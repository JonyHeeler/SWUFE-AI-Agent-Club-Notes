"use strict";

const STORAGE_KEY = "jingjing-study-room-v1";
const $ = (selector) => document.querySelector(selector);
const board = $("#notes-board");
const XCPC_TEXT = "XCPC 加油啊！睡前 AC 一道题。";
const defaults = () => ({ notes: [], initialNotesAdded: false, timer: { mode: "focus", focus: 25, break: 5, remaining: 1500, endAt: null } });
let state = defaults();
let storageFailed = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function say(message) {
  const text = $("#jingjing-message");
  text.textContent = message;
  text.getAnimations().forEach(animation => animation.cancel());
  if (!reducedMotion.matches) text.animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
}
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    document.getAnimations().forEach(animation => animation.cancel());
    document.querySelectorAll(".xcpc-note").forEach(element => balloonRigs.get(element)?.settle());
  }
});
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved) {
    if (!Array.isArray(saved.notes) || !saved.timer) throw new Error("Invalid data");
    state.notes = saved.notes.filter(n => n && typeof n.id === "string" && typeof n.text === "string" && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isInteger(n.color) && n.color >= 0 && n.color < 5)
      .map(n => ({ ...n, text: n.id === "jingjing-default-xcpc" ? XCPC_TEXT : n.text, balloons: Number.isSafeInteger(n.balloons) && n.balloons > 0 ? Math.min(n.balloons, 1000) : 0, x: Math.max(0, Math.min(1, n.x)), y: Math.max(0, Math.min(20000, n.y)) }));
    state.initialNotesAdded = saved.initialNotesAdded === true;
    const t = saved.timer;
    if (["focus", "break"].includes(t.mode) && [t.focus, t.break].every(v => Number.isInteger(v) && v >= 1 && v <= 180) && Number.isFinite(t.remaining) && t.remaining >= 0 && t.remaining <= 10800 && (t.endAt === null || Number.isFinite(t.endAt))) state.timer = t;
  }
} catch {
  storageFailed = true;
  $("#save-status").textContent = "未能读取本地记录；本次仍可使用";
  $("#save-status").classList.add("save-error");
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageFailed = false;
    $("#save-status").textContent = "已自动保存在这台设备";
    $("#save-status").classList.remove("save-error");
  } catch {
    storageFailed = true;
    $("#save-status").textContent = "浏览器无法保存，请先保留便签内容再关闭页面";
    $("#save-status").classList.add("save-error");
  }
}

function noteHeight(note) {
  return 220;
}
function updateBoardHeight() {
  board.style.height = `${Math.max(520, ...state.notes.map(n => n.y + noteHeight(n) + 25))}px`;
}

const balloonRigs = new WeakMap();
function positionNote(element, note) {
  const left = note.x * Math.max(0, board.clientWidth - element.offsetWidth);
  const dx = left - (element.style.left ? parseFloat(element.style.left) : left);
  const dy = note.y - (element.style.top ? parseFloat(element.style.top) : note.y);
  element.style.left = `${left}px`;
  element.style.top = `${note.y}px`;
  balloonRigs.get(element)?.move(dx, dy);
  balloonRigs.get(element)?.syncAnchor();
}

let deletedNote = null;
let toastTimeout;
function createBalloonRig(element, note) {
  const rig = document.createElement("div");
  rig.className = "balloon-rig";
  rig.setAttribute("role", "group");
  rig.setAttribute("aria-label", "XCPC 气球，点击可以放飞");
  document.body.append(rig);
  const bodies = [];
  let frame = 0;
  let lastTime = 0;
  function targets() {
    bodies.forEach((b, i) => { b.tx = (i % 4 - (Math.min(bodies.length, 4) - 1) / 2) * 48; b.ty = -95 - Math.floor(i / 4) * 64 - i % 2 * 12; });
  }
  function syncAnchor() {
    const rect = element.getBoundingClientRect();
    const viewport = $(".notes-scroll").getBoundingClientRect();
    rig.style.left = `${rect.left + rect.width / 2}px`;
    rig.style.top = `${rect.top + 20}px`;
    rig.hidden = rect.bottom < viewport.top || rect.top > viewport.bottom;
  }
  function draw() {
    syncAnchor();
    bodies.forEach(b => {
      b.node.style.transform = `translate(${b.x}px, ${b.y}px) rotate(${-b.vx * .035}deg)`;
      b.rope.setAttribute("d", `M0 0 C${b.x * .2 - b.vx * .08} ${b.y * .45}, ${b.x + 12} ${b.y + 35}, ${b.x} ${b.y + 57}`);
    });
  }
  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    bodies.forEach(b => { b.x = b.tx; b.y = b.ty; b.vx = b.vy = 0; });
    draw();
  }
  function step(time) {
    frame = 0;
    if (!element.isConnected) { rig.remove(); return; }
    if (reducedMotion.matches || document.hidden) { settle(); return; }
    const dt = Math.min((time - lastTime) / 1000 || 1 / 60, 1 / 30);
    lastTime = time;
    for (let pass = 0; pass < 2; pass++) {
      const h = dt / 2;
      bodies.forEach(b => {
        b.vx += ((b.tx - b.x) * 30 - b.vx * 7) * h;
        b.vy += ((b.ty - b.y) * 30 - b.vy * 7) * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
      });
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= 44) continue;
        const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
        const push = (44 - distance) * .5;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (closing < 0) { a.vx += closing * nx * .6; a.vy += closing * ny * .6; b.vx -= closing * nx * .6; b.vy -= closing * ny * .6; }
      }
    }
    draw();
    if (bodies.some(b => Math.abs(b.x - b.tx) + Math.abs(b.y - b.ty) + Math.abs(b.vx) + Math.abs(b.vy) > .4)) frame = requestAnimationFrame(step);
    else settle();
  }
  function wake() {
    if (reducedMotion.matches) { settle(); return; }
    if (!frame) { lastTime = performance.now(); frame = requestAnimationFrame(step); }
  }
  function add(animate) {
    const index = bodies.length;
    const wrap = document.createElement("div");
    wrap.className = "tethered-balloon";
    const ropeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ropeSvg.setAttribute("aria-hidden", "true");
    ropeSvg.setAttribute("viewBox", "-160 -30 320 500");
    const rope = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ropeSvg.append(rope);
    wrap.append(ropeSvg);
    const node = document.createElement("button");
    node.type = "button";
    node.className = "balloon-body";
    node.setAttribute("aria-label", "放飞这个气球");
    node.title = "放飞气球";
    node.style.setProperty("--balloon-color", ["#e66752", "#5b94c9", "#e7b449", "#89b379", "#a480be"][index % 5]);
    node.innerHTML = '<span class="balloon-skin"></span>';
    wrap.append(node);
    rig.append(wrap);
    const b = { node, rope, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
    node.addEventListener("click", () => {
      const rect = node.getBoundingClientRect();
      bodies.splice(bodies.indexOf(b), 1);
      wrap.remove();
      note.balloons = bodies.length;
      targets();
      wake();
      save();
      say("放飞啦！带着这份好心情，继续下一题吧。");
      if (reducedMotion.matches) return;
      const flying = document.createElement("div");
      flying.className = "released-balloon";
      flying.style.left = `${rect.left}px`;
      flying.style.top = `${rect.top}px`;
      flying.style.setProperty("--balloon-color", node.style.getPropertyValue("--balloon-color"));
      flying.innerHTML = '<span class="balloon-skin"></span>';
      document.body.append(flying);
      const flight = flying.animate([{ transform: "translate(0, 0) rotate(0deg)", opacity: 1 }, { transform: `translate(35px, ${-rect.top - 85}px) rotate(12deg)`, opacity: 0 }], { duration: 1400, easing: "cubic-bezier(.35,0,.65,1)" });
      flight.finished.catch(() => {}).finally(() => flying.remove());
    });
    bodies.push(b);
    targets();
    b.x = b.tx; b.y = b.ty + (animate ? 65 : 0);
    if (animate) wake();
  }
  for (let i = 0; i < (note.balloons || 0); i++) add(false);
  settle();
  return { add: () => add(true), settle, syncAnchor, dispose: () => { cancelAnimationFrame(frame); rig.remove(); }, move(dx, dy) {
    if (!dx && !dy) return;
    bodies.forEach(b => { b.x -= Math.max(-100, Math.min(100, dx)) * .75; b.y -= Math.max(-100, Math.min(100, dy)) * .75; b.vx -= dx * 3; b.vy -= dy * 3; });
    wake();
  } };
}
function releaseBalloon(element, note) {
  note.balloons = (note.balloons || 0) + 1;
  balloonRigs.get(element).add();
  save();
  separateNarrowNotes();
  updateBoardHeight();
  say("AC！又系好一个气球啦，下一题也加油！");
}
function createNoteElement(note) {
  const element = $("#note-template").content.firstElementChild.cloneNode(true);
  element.dataset.id = note.id;
  element.dataset.color = note.color;
  const textarea = element.querySelector("textarea");
  textarea.value = note.text;
  if (note.id === "jingjing-default-xcpc") {
    element.classList.add("xcpc-note");
    const logos = document.createElement("div");
    logos.className = "contest-logos";
    logos.innerHTML = '<img src="icpc-logo.png" alt="ICPC"><span><img src="ccpc-logo.png" alt=""><b>CCPC</b></span>';
    logos.querySelector("span").setAttribute("aria-label", "CCPC");
    element.append(logos);
    const content = document.createElement("button");
    content.type = "button";
    content.className = "xcpc-content";
    content.textContent = XCPC_TEXT;
    content.setAttribute("aria-label", `${XCPC_TEXT} 点击增加一个气球`);
    textarea.replaceWith(content);
    content.addEventListener("click", () => releaseBalloon(element, note));
    element.querySelector(".note-color").hidden = true;
  } else textarea.addEventListener("input", () => { note.text = textarea.value; save(); });
  element.querySelector(".note-color").addEventListener("click", () => {
    note.color = (note.color + 1) % 5;
    element.dataset.color = note.color;
    save();
  });
  element.querySelector(".delete-note").addEventListener("click", () => {
    deletedNote = { note, index: state.notes.indexOf(note) };
    state.notes = state.notes.filter(n => n !== note);
    balloonRigs.get(element)?.dispose();
    element.remove();
    say("这张先收起来啦，想拿回来可以点撤销。");
    updateBoardHeight();
    save();
    $("#add-note").focus();
    $("#toast").hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { $("#toast").hidden = true; }, 8000);
  });
  const handle = element.querySelector(".drag-handle");
  let drag = null;
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const rect = board.getBoundingClientRect();
    drag = { x: event.clientX - rect.left - note.x * Math.max(0, board.clientWidth - element.offsetWidth), y: event.clientY - rect.top - note.y };
    handle.setPointerCapture(event.pointerId);
    element.getAnimations().forEach(animation => animation.cancel());
    element.classList.add("dragging");
  });
  handle.addEventListener("pointermove", event => {
    if (!drag) return;
    const rect = board.getBoundingClientRect();
    const available = Math.max(0, board.clientWidth - element.offsetWidth);
    const x = Math.max(0, Math.min(available, event.clientX - rect.left - drag.x));
    note.x = available ? x / available : 0;
    note.y = Math.max(0, Math.min(20000, event.clientY - rect.top - drag.y));
    positionNote(element, note);
    updateBoardHeight();
  });
  function finishDrag() {
    if (!drag) return;
    drag = null;
    element.classList.remove("dragging");
    balloonRigs.get(element)?.syncAnchor();
    save();
  }
  handle.addEventListener("pointerup", finishDrag);
  handle.addEventListener("pointercancel", finishDrag);
  handle.addEventListener("lostpointercapture", finishDrag);
  handle.addEventListener("keydown", event => {
    const moves = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (!moves[event.key]) return;
    event.preventDefault();
    const [dx, dy] = moves[event.key];
    const available = Math.max(0, board.clientWidth - element.offsetWidth);
    note.x = available ? Math.max(0, Math.min(1, note.x + dx / available)) : 0;
    note.y = Math.max(0, Math.min(20000, note.y + dy));
    positionNote(element, note);
    updateBoardHeight();
    save();
  });
  board.append(element);
  positionNote(element, note);
  if (note.id === "jingjing-default-xcpc") balloonRigs.set(element, createBalloonRig(element, note));
  return element.querySelector(".xcpc-content") || textarea;
}

function nextNotePosition() {
  const index = state.notes.length;
  const columns = Math.max(1, Math.floor(board.clientWidth / 244));
  const column = index % columns;
  let y = Math.floor(index / columns) * 244 + 12;
  let x = columns > 1 ? column / (columns - 1) : 0;
  // Keep a newly added note clear of existing notes, including notes moved by hand.
  while (state.notes.some(n => Math.abs(n.x - x) * Math.max(0, board.clientWidth - 220) < 225 && y < n.y + noteHeight(n) + 16 && y + 236 > n.y)) y += 244;
  return { x, y };
}
$("#add-note").addEventListener("click", () => {
  const note = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: "", ...nextNotePosition(), color: state.notes.length % 5 };
  state.notes.push(note);
  const textarea = createNoteElement(note);
  updateBoardHeight();
  save();
  textarea.focus();
  textarea.closest(".note").scrollIntoView({ block: "nearest", inline: "nearest" });
  if (!reducedMotion.matches) textarea.closest(".note").animate([
    { opacity: 0, transform: "translateY(-18px) rotate(-3deg) scale(1.05)", boxShadow: "8px 18px 22px #4f341e35" },
    { opacity: 1, transform: "translateY(2px) rotate(.5deg) scale(.995)", offset: .8 },
    { opacity: 1, transform: "none" }
  ], { duration: 380, easing: "cubic-bezier(.2,.7,.25,1)" });
  say("贴好啦。写下想做的事，咱们一件一件来。");
});

$("#undo-delete").addEventListener("click", () => {
  if (!deletedNote) return;
  state.notes.splice(deletedNote.index, 0, deletedNote.note);
  createNoteElement(deletedNote.note).focus();
  deletedNote = null;
  clearTimeout(toastTimeout);
  $("#toast").hidden = true;
  updateBoardHeight();
  save();
});

if (!state.initialNotesAdded) {
  const initialNotes = [
    { id: "jingjing-default-rice", text: "一粟堂打的白米饭今晚记得吃", color: 0 },
    { id: "jingjing-default-exam", text: "明天数学分析期中考试，做复习题", color: 1 },
    { id: "jingjing-default-xcpc", text: XCPC_TEXT, color: 2 }
  ];
  initialNotes.forEach(note => {
    if (!state.notes.some(existing => existing.id === note.id)) state.notes.push({ ...note, ...nextNotePosition() });
  });
  state.initialNotesAdded = true;
  if (!storageFailed) save();
}
state.notes.forEach(createNoteElement);
function separateNarrowNotes() {
  if (board.clientWidth >= 440) return;
  const placed = [];
  let changed = false;
  state.notes.forEach(note => {
    const element = Array.from(board.querySelectorAll(".note")).find(el => el.dataset.id === note.id);
    const left = note.x * Math.max(0, board.clientWidth - element.offsetWidth);
    let y = note.y;
    while (placed.some(rect => Math.abs(rect.left - left) < element.offsetWidth + 8 && y < rect.y + rect.height + 16 && y + noteHeight(note) + 16 > rect.y)) {
      y = Math.max(...placed.filter(rect => Math.abs(rect.left - left) < element.offsetWidth + 8 && y < rect.y + rect.height + 16 && y + noteHeight(note) + 16 > rect.y).map(rect => rect.y + rect.height + 24));
    }
    if (y !== note.y) changed = true;
    note.y = y;
    placed.push({ left, y, height: noteHeight(note) });
    positionNote(element, note);
  });
  if (changed) save();
}
separateNarrowNotes();
updateBoardHeight();
window.addEventListener("resize", () => {
  separateNarrowNotes();
  board.querySelectorAll(".note").forEach(element => {
    const note = state.notes.find(n => n.id === element.dataset.id);
    if (note) positionNote(element, note);
  });
  updateBoardHeight();
});
$(".notes-scroll").addEventListener("scroll", () => {
  document.querySelectorAll(".xcpc-note").forEach(element => balloonRigs.get(element)?.syncAnchor());
}, { passive: true });

const timer = state.timer;
const segmentPaths = [
  "M4 1H20L17 4H7Z", "M21 2V20L18 18V6Z", "M21 22V40L18 36V24Z",
  "M4 43H20L17 40H7Z", "M3 22V40L6 36V24Z", "M3 2V20L6 18V6Z",
  "M4 21L7 19H17L20 21L17 23H7Z"
];
const digitSegments = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
function renderDigits(formatted) {
  if ($("#lcd-digits").dataset.value === formatted) return;
  $("#lcd-digits").dataset.value = formatted;
  let x = 0;
  const shapes = [];
  for (const character of formatted) {
    if (character === ":") {
      shapes.push(`<g class="lcd-segment" transform="translate(${x} 0)"><circle cx="4" cy="15" r="1.5"/><circle cx="4" cy="29" r="1.5"/></g>`);
      x += 10;
    } else {
      const active = digitSegments[Number(character)];
      shapes.push(`<g transform="translate(${x} 0)">` + segmentPaths.map((d, i) => `<path d="${d}" class="lcd-segment${active.includes("abcdefg"[i]) ? "" : " off"}"/>`).join("") + "</g>");
      x += 25;
    }
  }
  $("#lcd-digits").setAttribute("viewBox", `0 0 ${x} 44`);
  $("#lcd-digits").innerHTML = shapes.join("");
}
let audio;
function prepareSound() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audio && Audio) audio = new Audio();
    if (audio?.state === "suspended") audio.resume().catch(() => {});
  } catch { /* The on-page completion message is always available. */ }
}
function chime() {
  if (!audio || audio.state !== "running") return;
  try {
    [0, .22, .44].forEach((delay, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.frequency.value = [523.25, 659.25, 783.99][i];
      const start = audio.currentTime + delay;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.09, start + .02);
      gain.gain.exponentialRampToValueAtTime(.001, start + .5);
      oscillator.start(start);
      oscillator.stop(start + .55);
    });
  } catch { /* Sound is optional. */ }
}
function renderTimer() {
  const seconds = Math.max(0, Math.ceil(timer.remaining));
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  $("#time-display").textContent = formatted;
  const active = timer.endAt !== null;
  const label = timer.mode === "focus" ? "专注" : "休息";
  $("#start-timer").textContent = active ? "暂停" : timer.remaining === 0 ? "再来一轮" : timer.remaining < timer[timer.mode] * 60 ? "继续" : `开始${label}`;
  $("#timer-state").textContent = active ? `${label}中` : timer.remaining === 0 ? "计时结束" : "未开始或已暂停";
  renderDigits(formatted);
  document.querySelectorAll("[data-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === timer.mode)));
  document.title = active ? `${formatted} · 鲸鲸自习室` : "鲸鲸自习室";
}
function tick() {
  if (timer.endAt !== null) {
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    if (timer.remaining === 0) {
      timer.endAt = null;
      const message = timer.mode === "focus" ? "专注完成" : "休息结束";
      $("#timer-message").textContent = message;
      say(timer.mode === "focus" ? "这一轮完成啦！伸个懒腰，喝口水吧。" : "休息好啦，要不要开始下一件事？");
      chime();
      save();
    }
  }
  renderTimer();
}
$("#start-timer").addEventListener("click", () => {
  prepareSound();
  tick();
  if (timer.endAt !== null) { timer.endAt = null; say("先停一会儿，准备好再继续。"); }
  else {
    if (timer.remaining === 0) timer.remaining = timer[timer.mode] * 60;
    timer.endAt = Date.now() + timer.remaining * 1000;
    say(timer.mode === "focus" ? "好，这段时间就留给眼前的事。我陪着你。" : "休息也是计划的一部分，放松一下吧。");
  }
  $("#timer-message").textContent = "";
  save();
  renderTimer();
});
function resetTimer() {
  timer.endAt = null;
  timer.remaining = timer[timer.mode] * 60;
  $("#timer-message").textContent = "";
  save();
  renderTimer();
}
$("#reset-timer").addEventListener("click", resetTimer);
document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
  if (timer.mode === button.dataset.mode) return;
  timer.mode = button.dataset.mode;
  $("#duration").value = timer[timer.mode];
  resetTimer();
}));
$("#duration-form").addEventListener("submit", event => {
  event.preventDefault();
  const minutes = Number($("#duration").value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    $("#timer-message").textContent = "请填写 1 到 180 的整数分钟。";
    return;
  }
  timer[timer.mode] = minutes;
  resetTimer();
  $("#timer-message").textContent = `已设为 ${minutes} 分钟`;
});
$("#duration").value = timer[timer.mode];
tick();
setInterval(tick, 250);
document.addEventListener("visibilitychange", tick);
window.addEventListener("pagehide", () => { tick(); if (!storageFailed) save(); });
const greetings = ["先写下来，就不用一直记在脑袋里啦。", "今天想做哪件事？挑一件小的开始也很好。", "肩膀放松一点，记得喝水哦。", "不着急，我在这里陪你。"];
let greetingIndex = 0;
function greet() {
  say(greetings[greetingIndex++ % greetings.length]);
  if (!reducedMotion.matches) $("#greet").animate([{ transform: "translateY(0)" }, { transform: "translateY(-5px)", offset: .4 }, { transform: "translateY(0)" }], { duration: 340, easing: "ease-out" });
}
$("#greet").addEventListener("click", greet);
$("#next-line").addEventListener("click", greet);

