'use strict';

/* ============================================================
   Property Tycoon — a rent tracker that happens to be a game
   ============================================================ */

const STORAGE_KEY = 'property-tycoon-save-v1';
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LEVEL_STEP = 250;
const LEVEL_TITLES = ['Rookie Landlord', 'Key Collector', 'Rent Wrangler', 'Door Whisperer', 'Coin Magnet', 'Building Boss', 'Neighborhood Legend', 'Tycoon Supreme'];
const AVATARS = ['👩', '🧔', '🧕', '👨', '👩‍🦰', '🧑‍💻', '👫', '🧑‍🎨', '👱‍♀️', '👨‍🍳', '👵', '🧑‍🌾', '👩‍🚀', '🦸', '🧑‍🎤', '🐱'];
const THEMES = {
  coral:  { label: 'Coral',  main: '#f9776f', dark: '#d34f48', light: '#ffe1dc', soft: '#ffb3a8', sky: '#d9f2ff', sky2: '#fff0e8', grass: '#b9df8d' },
  teal:   { label: 'Teal',   main: '#48b8a9', dark: '#2f8f84', light: '#dff8f4', soft: '#9fe4da', sky: '#d7f1ff', sky2: '#e8fbf6', grass: '#b4e2a0' },
  violet: { label: 'Violet', main: '#9b7bea', dark: '#7357c4', light: '#eee7ff', soft: '#cbb9ff', sky: '#e2e5ff', sky2: '#fff0fb', grass: '#c2dfa1' },
  gold:   { label: 'Gold',   main: '#f2b544', dark: '#c98d1f', light: '#fff3d6', soft: '#ffdb8a', sky: '#d9f2ff', sky2: '#fff7df', grass: '#bde195' },
  blue:   { label: 'Blue',   main: '#5aa9e6', dark: '#367fbb', light: '#e2f3ff', soft: '#a9d8f8', sky: '#d9efff', sky2: '#edf9ff', grass: '#b6e0a4' },
  mint:   { label: 'Mint',   main: '#6fce8f', dark: '#459e63', light: '#e4fbeb', soft: '#b2eac4', sky: '#d8f5ff', sky2: '#eefbe8', grass: '#b7e0a0' },
};
const THEME_KEYS = Object.keys(THEMES);
const ROOF_EMOJI = ['🏡', '🏢', '🌇', '🌺', '🌿', '🏙️'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const roundMoney = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const uid = (p = 'id') => `${p}_${(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).replace(/-/g, '').slice(0, 12)}`;

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
function money(n) {
  const v = Math.abs(n) < 0.005 ? 0 : n;
  return moneyFmt.format(v);
}
function money0(n) { return money(Math.round(n)); }
function pct(n, d) { return d > 0 ? clamp((n / d) * 100, 0, 100) : 0; }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function plural(n, one, many = `${one}s`) { return `${n} ${n === 1 ? one : many}`; }

/* ---------------- dates ---------------- */
function addMonths(m, n) {
  const d = new Date(m.y, m.m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}
function todayMonth() { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; }
function monthLabel(m) { return `${MONTH_NAMES[m.m]} ${m.y}`; }
function monthShort(m) { return `${MONTH_NAMES[m.m].slice(0, 3)} ${m.y}`; }
function monthKey(m) { return `${m.y}-${String(m.m + 1).padStart(2, '0')}`; }
function monthSeed(m, day = 1, bump = 0) { return Date.UTC(m.y, m.m, day, 12, 0, 0) + bump * 60000; }
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ---------------- buildings / units ---------------- */
function unitsOf(building) {
  const out = [];
  for (let floor = building.floors; floor >= 1; floor--) {
    for (let i = 0; i < building.unitsPerFloor; i++) {
      out.push({ label: `${floor}${String.fromCharCode(65 + i)}`, floor, letter: String.fromCharCode(65 + i) });
    }
  }
  return out;
}
function floorsOf(building) {
  const out = [];
  for (let floor = building.floors; floor >= 1; floor--) {
    const units = [];
    for (let i = 0; i < building.unitsPerFloor; i++) {
      units.push({ label: `${floor}${String.fromCharCode(65 + i)}`, floor, letter: String.fromCharCode(65 + i) });
    }
    out.push({ floor, units });
  }
  return out;
}
function themeVars(building) {
  const t = THEMES[building.color] || THEMES.coral;
  return `--b:${t.main};--b-dark:${t.dark};--b-light:${t.light};--b-soft:${t.soft};--b-sky:${t.sky};--b-sky2:${t.sky2};--b-grass:${t.grass}`;
}
function statusOf(t) {
  if (!t) return 'vacant';
  if (t.due <= 0.004) return 'clear';
  return t.paidThisMonth > 0.004 ? 'partial' : 'overdue';
}
function statusText(t) {
  const s = statusOf(t);
  return s === 'clear' ? 'All clear' : s === 'partial' ? 'Part paid' : 'Overdue';
}
function moodOf(t) {
  const s = statusOf(t);
  return s === 'clear' ? '😄' : s === 'partial' ? '😬' : '😟';
}
function balanceLabel(t) {
  if (!t) return '';
  if (t.due < -0.004) return `${money(-t.due)} credit`;
  if (t.due <= 0.004) return 'All clear';
  return `${money(t.due)} due`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ---------------- selectors ---------------- */
function getBuilding(id) { return state.buildings.find((b) => b.id === id) || null; }
function tenantsOf(buildingId) { return state.tenants.filter((t) => t.buildingId === buildingId); }
function tenantAt(buildingId, unit) { return state.tenants.find((t) => t.buildingId === buildingId && t.unit === unit) || null; }
function getTenant(id) { return state.tenants.find((t) => t.id === id) || null; }
function totals(buildingId = null) {
  const list = buildingId ? tenantsOf(buildingId) : state.tenants;
  return list.reduce((a, t) => {
    a.collected = roundMoney(a.collected + t.paidThisMonth);
    if (t.due > 0.004) a.due = roundMoney(a.due + t.due);
    if (t.due < -0.004) a.credit = roundMoney(a.credit + Math.abs(t.due));
    a.rent = roundMoney(a.rent + t.rent);
    a.count += 1;
    return a;
  }, { collected: 0, due: 0, credit: 0, rent: 0, count: 0 });
}
function buildingOccupancy(b) {
  const tenants = tenantsOf(b.id);
  return { tenants: tenants.length, units: b.floors * b.unitsPerFloor, occupied: new Set(tenants.map((t) => t.unit)).size };
}
function dueHouseholds() {
  return state.tenants.filter((t) => t.due > 0.004);
}
function levelInfo(xp = state.xp) {
  const level = Math.floor(Math.max(0, xp) / LEVEL_STEP) + 1;
  const progress = Math.max(0, xp) % LEVEL_STEP;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return { level, progress, next: LEVEL_STEP, title, pct: (progress / LEVEL_STEP) * 100 };
}
function xpFor(amount) { return Math.max(2, Math.round(amount / 50)); }
function paymentsTotal() {
  return state.ledger.filter((e) => e.type === 'payment').reduce((s, e) => s + num(e.amount), 0);
}
function nextBuildingName() {
  for (let i = 0; i < 26; i++) {
    const name = `Building ${String.fromCharCode(65 + i)}`;
    if (!state.buildings.some((b) => b.name.toLowerCase() === name.toLowerCase())) return name;
  }
  return 'New Building';
}

/* ---------------- persistence ---------------- */
function blankSettings() { return { sound: true, demoDismissed: false }; }
function createEmptyState() {
  return {
    version: 1, month: todayMonth(), xp: 0, buildings: [], tenants: [], ledger: [],
    settings: blankSettings(), updatedAt: Date.now(), demo: false,
  };
}

function buildDemoState() {
  const start = addMonths(todayMonth(), -2);
  const st = {
    version: 1, month: todayMonth(), xp: 0, buildings: [], tenants: [], ledger: [],
    settings: { sound: true, demoDismissed: false }, updatedAt: Date.now(), demo: true,
  };
  const defs = [
    { name: 'Building A', color: 'coral', floors: 3, unitsPerFloor: 2, emoji: '🌺' },
    { name: 'Building B', color: 'teal', floors: 2, unitsPerFloor: 2, emoji: '🌿' },
    { name: 'Building C', color: 'violet', floors: 3, unitsPerFloor: 2, emoji: '🌇' },
  ];
  const colors = ['coral', 'teal', 'violet'];
  st.buildings = defs.map((d, i) => ({ id: `bld_${colors[i]}`, ...d }));
  const people = [
    { name: 'Maya Chen', emoji: '👩', b: 0, unit: '1A', rent: 1450, pays: [1450, 1450, 1450] },
    { name: 'Jordan Blake', emoji: '🧔', b: 0, unit: '1B', rent: 1320, pays: [1320, 900, 700] },
    { name: 'Priya Patel', emoji: '🧕', b: 0, unit: '2A', rent: 1600, pays: [1600, 0, 0] },
    { name: 'Sam Ortiz', emoji: '👨', b: 0, unit: '2B', rent: 1250, pays: [1250, 1250, 1250] },
    { name: 'Elena Rossi', emoji: '👩‍🦰', b: 1, unit: '1A', rent: 1180, pays: [1180, 1180, 1200] },
    { name: 'Marcus Lee', emoji: '🧑‍💻', b: 1, unit: '1B', rent: 1400, pays: [1400, 0, 0] },
    { name: 'Nina & Theo', emoji: '👫', b: 1, unit: '2A', rent: 1320, pays: [1320, 1320, 1320] },
    { name: 'Aisha Khan', emoji: '🧑‍🎨', b: 2, unit: '1A', rent: 1100, pays: [1100, 1100, 500] },
    { name: 'Ben Carter', emoji: '🧔‍♂️', b: 2, unit: '1B', rent: 1050, pays: [1050, 500, 0] },
    { name: 'Lena Park', emoji: '👱‍♀️', b: 2, unit: '2A', rent: 1250, pays: [1250, 1250, 1250] },
  ];
  st.tenants = people.map((p) => ({
    id: uid('ten'), name: p.name, emoji: p.emoji, buildingId: st.buildings[p.b].id,
    unit: p.unit, rent: p.rent, paidThisMonth: 0, prevDue: 0, due: 0,
    createdAt: monthSeed(start, 2),
  }));

  let m = start;
  for (let i = 0; i < 3; i++) {
    const isFirst = i === 0;
    st.tenants.forEach((t, idx) => {
      const carried = t.due;
      t.prevDue = carried;
      t.due = roundMoney(carried + t.rent);
      t.paidThisMonth = 0;
      const b = getBuildingIn(st, t.buildingId);
      st.ledger.push({
        id: uid('led'), ts: monthSeed(m, 1, idx), monthKey: monthKey(m), monthLabel: monthLabel(m),
        buildingId: t.buildingId, buildingName: b?.name || '', tenantId: t.id, tenantName: t.name, unit: t.unit,
        type: isFirst ? 'charge' : 'rollover', rent: t.rent, prevDue: carried, amount: 0, dueAfter: t.due,
        note: isFirst
          ? `Opening charge · rent ${money(t.rent)}`
          : `New month · rent ${money(t.rent)} + carried ${money(carried)} = ${money(t.due)}`,
      });
    });
    people.forEach((p, idx) => {
      const amount = p.pays[i];
      if (!amount) return;
      const t = st.tenants[idx];
      const b = getBuildingIn(st, t.buildingId);
      const before = t.due;
      t.paidThisMonth = roundMoney(t.paidThisMonth + amount);
      t.due = roundMoney(t.due - amount);
      st.xp += xpFor(amount) + (t.due <= 0.004 ? 5 : 0);
      const type = amount >= before - 0.004 ? 'payment' : 'partial';
      st.ledger.push({
        id: uid('led'), ts: monthSeed(m, 5 + (idx % 7), idx), monthKey: monthKey(m), monthLabel: monthLabel(m),
        buildingId: t.buildingId, buildingName: b?.name || '', tenantId: t.id, tenantName: t.name, unit: t.unit,
        type, rent: t.rent, prevDue: t.prevDue, amount, dueAfter: t.due,
        note: t.due < -0.004
          ? `Overpaid ${money(-t.due)} · credit rolls forward`
          : t.due <= 0.004
            ? `Paid in full · balance ${money(0)}`
            : `Partial payment · ${money(t.due)} left due`,
      });
    });
    if (i < 2) m = addMonths(m, 1);
  }
  st.month = addMonths(start, 2);
  st.ledger.sort((a, b) => a.ts - b.ts);
  return st;
}
function getBuildingIn(st, id) { return st.buildings.find((b) => b.id === id) || null; }

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.buildings) || !Array.isArray(raw.tenants)) throw new Error('bad save');
  raw.version = 1;
  raw.settings = { ...blankSettings(), ...(raw.settings || {}) };
  raw.xp = Math.max(0, num(raw.xp));
  raw.ledger = Array.isArray(raw.ledger) ? raw.ledger : [];
  if (!raw.month || typeof raw.month.y !== 'number') raw.month = todayMonth();
  raw.buildings = raw.buildings.map((b) => ({
    id: b.id || uid('bld'), name: String(b.name || 'Building'), color: THEMES[b.color] ? b.color : 'coral',
    floors: clamp(Math.round(num(b.floors, 3)), 1, 8), unitsPerFloor: clamp(Math.round(num(b.unitsPerFloor, 2)), 1, 5),
    emoji: b.emoji || '🏠',
  }));
  raw.tenants = raw.tenants.map((t) => ({
    id: t.id || uid('ten'), name: String(t.name || 'Tenant'), emoji: t.emoji || '👤',
    buildingId: t.buildingId, unit: String(t.unit || ''), rent: roundMoney(num(t.rent)),
    paidThisMonth: roundMoney(num(t.paidThisMonth)), prevDue: roundMoney(num(t.prevDue)), due: roundMoney(num(t.due)),
    createdAt: t.createdAt || Date.now(),
  })).filter((t) => raw.buildings.some((b) => b.id === t.buildingId));
  raw.ledger = raw.ledger.map((e) => ({
    ...e, rent: num(e.rent), prevDue: num(e.prevDue), amount: num(e.amount), dueAfter: num(e.dueAfter),
  }));
  raw.updatedAt = raw.updatedAt || Date.now();
  return raw;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { state: normalizeState(JSON.parse(raw)), loaded: true };
  } catch (err) {
    console.warn('Could not load save', err);
  }
  return { state: buildDemoState(), loaded: false };
}

let state;
let ui = { view: 'map', buildingId: null, ledgerBuildingId: 'all', ledgerMonthKey: 'all', collecting: false };
let confirmAction = null;
let modalOpen = false;

function persist() {
  state.updatedAt = Date.now();
  const el = $('#save-state');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (el) { el.textContent = `Saved locally · ${formatTime(state.updatedAt)}`; el.className = 'saved'; }
  } catch (err) {
    if (el) { el.textContent = 'Could not save — check browser storage'; el.className = 'saving'; }
    console.error(err);
  }
}
function commit({ render: shouldRender = true, save = true } = {}) {
  if (shouldRender) render();
  if (save) persist();
}
/* ============================================================
   Sound, effects, toasts
   ============================================================ */
const AudioKit = (() => {
  let ctx = null;
  function ensure() {
    if (!state.settings.sound) return null;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!ctx) ctx = new C();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, at, dur, type = 'sine', vol = 0.06, slideTo = null) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + at + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.02);
  }
  function noise(dur = 0.16, vol = 0.04, freq = 2200) {
    const c = ensure(); if (!c) return;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource(); src.buffer = buffer;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = .8;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(filter).connect(g).connect(c.destination); src.start();
  }
  return {
    click() { tone(420, 0, .04, 'triangle', .018); },
    coin() { tone(1180, 0, .07, 'sine', .05); tone(1560, .055, .14, 'sine', .042); },
    register() { noise(.18, .05, 2600); [880, 1320, 1760, 2093].forEach((f, i) => tone(f, i * .05, .2, 'triangle', .045)); },
    level() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .085, .3, 'triangle', .055)); },
    advance() { [392, 523, 659].forEach((f, i) => tone(f, i * .07, .22, 'sine', .04)); },
    error() { tone(200, 0, .14, 'sawtooth', .025, 160); },
  };
})();

function fxCoins(x, y, count = 9) {
  const root = $('#fx'); if (!root) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'fx-coin'; el.textContent = Math.random() > .25 ? '🪙' : '💰';
    el.style.left = `${x + (Math.random() * 26 - 13)}px`;
    el.style.top = `${y + (Math.random() * 14 - 7)}px`;
    el.style.setProperty('--dx', `${(Math.random() - .5) * 260}px`);
    el.style.setProperty('--dy', `${-60 - Math.random() * 160}px`);
    el.style.fontSize = `${16 + Math.random() * 14}px`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}
function fxPlus(x, y, text) {
  const root = $('#fx'); if (!root) return;
  const el = document.createElement('span');
  el.className = 'fx-plus'; el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y - 18}px`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
function fxConfetti(count = 40) {
  const root = $('#fx'); if (!root) return;
  const colors = ['#ffd45e', '#ff8f8a', '#8a6bf2', '#4ad687', '#5aa9e6', '#f2b544'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = colors[i % colors.length];
    el.style.setProperty('--dur', `${1.8 + Math.random() * 1.6}s`);
    el.style.setProperty('--drift', `${(Math.random() - .5) * 240}px`);
    el.style.animationDelay = `${Math.random() * .35}s`;
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }
}
function fxMonth(emoji = '📅') {
  const root = $('#fx'); if (!root) return;
  const el = document.createElement('span');
  el.className = 'month-pop-fx'; el.textContent = emoji;
  root.appendChild(el); setTimeout(() => el.remove(), 1500);
}

function toast(message, { icon = '✨', tone = '', duration = 3600 } = {}) {
  const root = $('#toasts'); if (!root) return;
  while (root.children.length >= 4) root.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, duration);
}

/* ============================================================
   Modals
   ============================================================ */
function openModal(html, { wide = false } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.classList.add('modal-open');
  modalOpen = true;
  setTimeout(() => {
    const focusable = root.querySelector('input:not([type="hidden"]):not([type="radio"]), select, textarea, .modal button.btn-primary');
    focusable?.focus({ preventScroll: true });
  }, 40);
}
function closeModal() {
  const root = $('#modal-root');
  if (!root) return;
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
  modalOpen = false;
  confirmAction = null;
}
function modalHead(icon, title, sub) {
  return `<div class="modal-head">
    <div class="modal-icon">${icon}</div>
    <div><div class="modal-title">${title}</div>${sub ? `<div class="modal-sub">${sub}</div>` : ''}</div>
    <button class="modal-close" data-action="close-modal" aria-label="Close dialog">✕</button>
  </div>`;
}
function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, icon = '⚠️', onConfirm }) {
  confirmAction = onConfirm;
  openModal(`${modalHead(icon, title, '')}
    <div class="modal-body"><p style="font-size:13px;line-height:1.55;color:var(--ink-soft);font-weight:600">${message}</p></div>
    <div class="modal-foot">
      <div class="spacer"></div>
      <button class="btn btn-soft" data-action="close-modal">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-dialog">${confirmLabel}</button>
    </div>`);
}

/* ============================================================
   Header + banners
   ============================================================ */
function renderHeader() {
  const all = totals();
  const occupied = state.buildings.reduce((sum, b) => sum + buildingOccupancy(b).occupied, 0);
  const units = state.buildings.reduce((sum, b) => sum + b.floors * b.unitsPerFloor, 0);
  $('#dashboard').innerHTML = `
    <div class="dash-stat collected">
      <span class="dash-icon">💰</span>
      <span class="dash-copy"><span class="dash-label">Collected · ${monthShort(state.month)}</span><strong>${money(all.collected)}</strong></span>
    </div>
    <div class="dash-stat due">
      <span class="dash-icon">⏳</span>
      <span class="dash-copy"><span class="dash-label">Pending due · all buildings</span><strong>${money(all.due)}</strong></span>
    </div>
    <div class="dash-stat occupied">
      <span class="dash-icon">🔑</span>
      <span class="dash-copy"><span class="dash-label">Occupied homes</span><strong>${occupied}<small style="font-size:11px;font-weight:800;color:var(--ink-soft)"> / ${units}</small></strong></span>
    </div>`;

  const soundBtn = $('#sound-btn');
  soundBtn.textContent = state.settings.sound ? '🔊' : '🔇';
  soundBtn.classList.toggle('muted', !state.settings.sound);
  soundBtn.setAttribute('aria-pressed', state.settings.sound ? 'true' : 'false');

  $('#month-chip').innerHTML = `<span>📅</span><span>${monthLabel(state.month)}<small>MONTH ${state.month.y * 12 + state.month.m + 1}</small></span>`;

  const lv = levelInfo();
  $('#xp-wrap').innerHTML = `
    <span class="xp-badge">⭐ LV ${lv.level}</span>
    <span class="xp-body">
      <span class="xp-top"><b>${lv.title}</b><span>${lv.progress} / ${lv.next} XP</span></span>
      <span class="xp-track"><span class="xp-fill" style="width:${lv.pct}%"></span></span>
    </span>`;

  const collectBtn = $('#collect-btn');
  collectBtn.classList.toggle('active', ui.collecting);
  const dueCount = dueHouseholds().length;
  collectBtn.innerHTML = ui.collecting
    ? `🪙 <span>Collecting… ${dueCount} left</span>`
    : `🪙 <span>Rent Collection Day</span>`;
  $('#advance-btn').innerHTML = `📅 <span>Advance Month</span>`;

  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.nav === ui.view || (ui.view === 'building' && tab.dataset.nav === 'map')));
}

function renderBanners() {
  const slot = $('#banner-slot');
  const parts = [];
  if (ui.collecting) {
    const allTenants = state.tenants;
    const clear = allTenants.filter((t) => t.due <= 0.004).length;
    const due = dueHouseholds();
    const owed = due.reduce((s, t) => s + t.due, 0);
    parts.push(`<div class="collection-banner">
      <span class="banner-emoji">🪙</span>
      <span class="banner-copy"><strong>Rent Collection Day is live!</strong>
        Click a bouncing coin over a tenant to log their full payment. ${due.length ? `${plural(due.length, 'household')} still owe ${money(owed)}.` : 'Everyone is paid up — nice work!'}</span>
      <span class="banner-progress">
        <span class="mini-track"><span style="width:${pct(clear, Math.max(1, allTenants.length))}%"></span></span>
        <b style="font-size:11px;font-weight:900">${clear}/${allTenants.length} clear</b>
        <button class="btn btn-sm btn-soft" data-action="stop-collection">Finish</button>
      </span>
    </div>`);
  }
  if (state.demo && !state.settings.demoDismissed) {
    parts.push(`<div class="notice">
      <span class="notice-icon">🎭</span>
      <span><b>Sample neighborhood loaded.</b> Three buildings with 10 tenants are here so you can play right away. Edit them, or start fresh with your real buildings.</span>
      <span class="notice-actions">
        <button class="btn btn-sm btn-soft" data-action="clear-demo">Clear sample data</button>
        <button class="notice-close" data-action="dismiss-demo" aria-label="Dismiss sample data notice">✕</button>
      </span>
    </div>`);
  }
  slot.innerHTML = parts.join('');
}

function render() {
  renderHeader();
  renderBanners();
  renderView();
}

/* ============================================================
   Map view
   ============================================================ */
function mapView() {
  const all = totals();
  const due = dueHouseholds();
  const cards = state.buildings.map((b) => buildingCard(b)).join('');
  const addCard = `<button class="add-card" data-action="add-building">
      <span class="plus-circle">＋</span>
      <span>Add a building</span>
      <small>Only takes a minute</small>
    </button>`;
  return `
    <section class="map-hero">
      <div>
        <p class="page-kicker">Your neighborhood · ${plural(state.buildings.length, 'building')}</p>
        <h2 class="page-title">${greeting()}, landlord. <span aria-hidden="true">👋</span></h2>
        <p class="page-sub">Three little buildings, one tidy set of books. Click a building to walk the halls, or start rent collection and chase those bouncing coins.</p>
      </div>
      <div class="hero-actions">
        <div class="hero-card"><span style="font-size:22px">🧾</span><div><div class="hero-num">${money0(all.rent)}</div><div class="hero-sub">Monthly rent roll</div></div></div>
        <div class="hero-card"><span style="font-size:22px">🏠</span><div><div class="hero-num">${due.length}</div><div class="hero-sub">${due.length === 1 ? 'home still owes' : 'homes still owe'}</div></div></div>
        <button class="btn btn-soft" data-action="nav-ledger">📒 Open ledger</button>
      </div>
    </section>

    <section class="neighborhood" aria-label="Neighborhood map">
      <span class="sun" aria-hidden="true">☀️</span>
      <span class="cloud c1" aria-hidden="true">☁️</span>
      <span class="cloud c2" aria-hidden="true">☁️</span>
      <span class="map-deco tree1" aria-hidden="true">🌳</span>
      <span class="map-deco tree2" aria-hidden="true">🌷</span>
      <div class="map-road" aria-hidden="true"></div>
      <div class="buildings-grid">
        ${state.buildings.length ? cards : `<div class="empty-hero">
          <span class="empty-emoji">🏘️</span>
          <h3>Your neighborhood is waiting</h3>
          <p>Add your first apartment building, then fill it with real tenants and rents. The books will do the math for you.</p>
          <button class="btn btn-primary" data-action="add-building">＋ Add my first building</button>
        </div>`}
        ${state.buildings.length ? addCard : ''}
      </div>
    </section>`;
}

function buildingCard(b) {
  const t = totals(b.id);
  const occ = buildingOccupancy(b);
  const floors = floorsOf(b);
  const theme = THEMES[b.color] || THEMES.coral;
  const windows = floors.map((floor) => floor.units.map((u) => {
    const tenant = tenantAt(b.id, u.label);
    if (!tenant) return `<span class="win vacant" title="${u.label} · vacant">🪟</span>`;
    const status = statusOf(tenant);
    const coin = ui.collecting && tenant.due > 0.004
      ? `<button class="coin-mini" data-action="collect-coin" data-id="${tenant.id}" title="Collect ${money(tenant.due)} from ${esc(tenant.name)}" aria-label="Collect ${money(tenant.due)} from ${esc(tenant.name)}">🪙</button>`
      : '';
    return `<span class="win ${status}" title="${u.label} · ${esc(tenant.name)} · ${balanceLabel(tenant)}">
      <span class="win-person">${tenant.emoji}</span>${coin}
    </span>`;
  }).join('')).join('');
  const creditBadge = t.credit > 0 ? `<span class="sum-badge credit">↩ ${money(t.credit)} <small>credit</small></span>` : '';
  const dueTenants = tenantsOf(b.id).filter((x) => x.due > 0.004).length;
  return `<article class="bcard" style="${themeVars(b)}" data-action="open-building" data-id="${b.id}" role="button" tabindex="0" aria-label="Open ${esc(b.name)}">
    <div class="bcard-sky">
      <div class="bcard-actions">
        <button class="icon-btn" data-action="rename-building" data-id="${b.id}" title="Rename building" aria-label="Rename ${esc(b.name)}">✏️</button>
        <button class="icon-btn" data-action="delete-building" data-id="${b.id}" title="Remove building" aria-label="Remove ${esc(b.name)}">🗑️</button>
      </div>
      <span class="bcard-emoji-badge">${b.emoji} ${floors.length} floors</span>
      <div class="tower">
        <span class="tower-flag" aria-hidden="true">${b.emoji}</span>
        <div class="tower-roof"></div>
        <div class="tower-body">${windows}</div>
        <div class="tower-entry"></div>
      </div>
    </div>
    <div class="bcard-body">
      <div class="bcard-title-row">
        <h3 class="bcard-title">${esc(b.name)}</h3>
        <span class="bcard-arrow" aria-hidden="true">→</span>
      </div>
      <p class="bcard-sub">${plural(occ.tenants, 'tenant')} · ${occ.occupied}/${occ.units} homes occupied · ${theme.label} row</p>
      <div class="bcard-badges">
        <span class="sum-badge collected">💰 ${money(t.collected)} <small>collected</small></span>
        <span class="sum-badge due">⏳ ${money(t.due)} <small>due</small></span>
        ${creditBadge}
      </div>
      ${ui.collecting && dueTenants ? `<div class="collect-quick"><button class="btn btn-sm btn-collect" data-action="collect-building" data-id="${b.id}">🪙 Collect all ${dueTenants} here</button></div>` : ''}
    </div>
  </article>`;
}

/* ============================================================
   Building view
   ============================================================ */
function buildingView() {
  const b = getBuilding(ui.buildingId);
  if (!b) { ui.view = 'map'; return mapView(); }
  const t = totals(b.id);
  const occ = buildingOccupancy(b);
  const theme = THEMES[b.color] || THEMES.coral;
  const floors = floorsOf(b);
  const roster = tenantsOf(b.id).slice().sort((a, z) => a.unit.localeCompare(z.unit, undefined, { numeric: true }));
  const floorRows = floors.map((floor) => `<div class="floor-row">
      <div class="floor-tag">FL ${floor.floor}</div>
      <div class="floor-units" style="--units:${b.unitsPerFloor}">
        ${floor.units.map((u) => unitHtml(b, u)).join('')}
      </div>
    </div>`).join('');
  const clearCount = roster.filter((x) => x.due <= 0.004).length;

  return `
    <section class="building-head" style="${themeVars(b)}">
      <div class="building-title-group">
        <button class="back-btn" data-action="nav-map">← Back to the neighborhood</button>
        <div class="building-name-row">
          <span class="building-badge-icon">${b.emoji}</span>
          <h2 class="building-name">${esc(b.name)}</h2>
          <button class="icon-btn" data-action="rename-building" data-id="${b.id}" title="Rename building" aria-label="Rename building">✏️</button>
        </div>
        <div class="building-meta">
          <span>${plural(b.floors, 'floor')} · ${plural(b.floors * b.unitsPerFloor, 'apartment')}</span>
          <span>•</span>
          <span>${occ.occupied}/${occ.units} occupied</span>
          <span>•</span>
          <span>${clearCount}/${roster.length} all clear</span>
        </div>
      </div>
      <div class="building-actions">
        <button class="btn btn-soft" data-action="add-tenant" data-building="${b.id}">＋ <span>Add tenant</span></button>
        <button class="btn btn-collect ${ui.collecting ? 'active' : ''}" data-action="start-collection">🪙 <span>${ui.collecting ? 'Collecting…' : 'Collect rent'}</span></button>
      </div>
    </section>

    <section class="b-summary">
      <div class="b-stat green"><div class="b-stat-label">💰 Collected this month</div><strong>${money(t.collected)}</strong><div class="b-stat-note">of ${money(t.rent)} rent roll</div></div>
      <div class="b-stat amber"><div class="b-stat-label">⏳ Pending due</div><strong>${money(t.due)}</strong><div class="b-stat-note">${plural(roster.filter((x) => x.due > .004).length, 'household')} owing</div></div>
      <div class="b-stat violet"><div class="b-stat-label">↩ Credit carried</div><strong>${money(t.credit)}</strong><div class="b-stat-note">rolls into next month</div></div>
      <div class="b-stat"><div class="b-stat-label">🏠 Occupancy</div><strong>${occ.occupied}/${occ.units}</strong><div class="b-stat-note">${money(b.floors * b.unitsPerFloor - occ.occupied === 0 ? t.rent : t.rent)} monthly potential</div></div>
    </section>

    <div class="building-layout">
      <section class="cutaway" aria-label="Building cross-section" style="${themeVars(b)}">
        <div class="cutaway-roof"></div>
        <div class="cutaway-sign">${esc(b.name)} · ${theme.label} rowhouse</div>
        <div class="floors">${floorRows}</div>
        <div class="cutaway-ground">
          <span class="ground-deco">🌳</span><span class="ground-deco">🚲</span><span class="ground-deco">🌷</span><span class="ground-deco">🪴</span><span class="ground-deco">🐈</span><span class="ground-deco">🌼</span>
        </div>
        <div class="cutaway-footer">
          <div class="legend">
            <span><i class="g"></i> Green door = all clear</span>
            <span><i class="y"></i> Yellow door = part paid</span>
            <span><i class="r"></i> Red door = overdue</span>
            <span style="margin-left:auto">Tap any apartment to log money or edit the tenant.</span>
          </div>
        </div>
      </section>

      <aside class="roster">
        <div class="roster-head">
          <h3>Tenant roster</h3>
          <span class="count-pill">${roster.length}</span>
          <button class="icon-btn" data-action="add-tenant" data-building="${b.id}" title="Add tenant" aria-label="Add tenant" style="width:30px;height:30px;font-size:13px;border-radius:9px;box-shadow:0 2px 0 #e2d5c2">＋</button>
        </div>
        <div class="roster-list">
          ${roster.length ? roster.map((x) => {
            const s = statusOf(x);
            return `<button class="roster-row" data-action="open-tenant" data-id="${x.id}">
              <span class="avatar ${s}">${x.emoji}</span>
              <span class="roster-copy"><span class="roster-name">${esc(x.name)}</span><span class="roster-sub">Apt ${x.unit} · ${money(x.rent)}/mo · ${statusText(x)}</span></span>
              <span class="roster-balance ${s}"><b>${x.due < -0.004 ? '+' + money(-x.due) : money(Math.max(0, x.due))}</b><span>${x.due < -0.004 ? 'credit' : x.due <= .004 ? 'clear' : 'due'}</span></span>
            </button>`;
          }).join('') : `<div class="empty-roster">No tenants yet. Add the first one and this hallway gets a lot more lively.</div>`}
        </div>
        <div class="roster-footer">
          <button class="btn btn-soft btn-sm" data-action="add-tenant" data-building="${b.id}">＋ Add a tenant</button>
        </div>
      </aside>
    </div>`;
}

function unitHtml(b, unit) {
  const t = tenantAt(b.id, unit.label);
  if (!t) {
    return `<button class="unit vacant" data-action="add-tenant" data-building="${b.id}" data-unit="${unit.label}">
      <span class="vacant-plus">＋</span>
      <span class="v-label">Apt ${unit.label}</span>
      <span class="v-sub">Vacant · add tenant</span>
    </button>`;
  }
  const s = statusOf(t);
  const coin = ui.collecting && t.due > 0.004
    ? `<button class="coin-btn" data-action="collect-coin" data-id="${t.id}" aria-label="Collect ${money(t.due)} from ${esc(t.name)}">🪙<span>${money0(t.due)}</span></button>`
    : '';
  const balance = t.due < -0.004 ? `+${money(-t.due)} credit` : t.due <= 0.004 ? 'All clear' : `${money(t.due)} due`;
  return `<div class="unit ${s}" data-action="open-tenant" data-id="${t.id}" role="button" tabindex="0" aria-label="Apt ${unit.label}, ${esc(t.name)}, ${balance}">
    <div class="unit-window">
      <span class="t-emoji">${t.emoji}</span>
      <span class="mood" title="${statusText(t)}">${moodOf(t)}</span>
      ${coin}
    </div>
    <div class="door-row">
      <div class="door ${s}" title="${statusText(t)} door"></div>
      <div style="min-width:0">
        <div class="unit-label">APT ${unit.label}</div>
        <div class="unit-name">${esc(t.name)}</div>
      </div>
    </div>
    <div class="unit-balance ${s}">${balance}</div>
    <div class="unit-rent">${money(t.rent)}/mo</div>
  </div>`;
}

/* ============================================================
   Ledger and forms
   ============================================================ */
function renderView() {
  const root = $('#view');
  if (ui.view === 'ledger') root.innerHTML = ledgerView();
  else if (ui.view === 'building') root.innerHTML = buildingView();
  else root.innerHTML = mapView();
}

function ledgerView() {
  const propertyEntries = state.ledger.filter((e) => ui.ledgerBuildingId === 'all' || e.buildingId === ui.ledgerBuildingId);
  const months = [...new Set(propertyEntries.map((e) => e.monthKey).filter(Boolean))].sort().reverse();
  if (ui.ledgerMonthKey !== 'all' && !months.includes(ui.ledgerMonthKey)) ui.ledgerMonthKey = 'all';
  const filtered = propertyEntries.filter((e) => ui.ledgerMonthKey === 'all' || e.monthKey === ui.ledgerMonthKey)
    .slice().sort((a, b) => b.ts - a.ts);
  const rows = filtered.map((e) => {
    const kind = e.type === 'payment' || e.type === 'partial' ? 'Payment' : e.type === 'charge' ? 'Rent charge' : e.type === 'rollover' ? 'Month rollover' : 'Adjustment';
    const cls = e.type === 'payment' ? 'paid' : e.type === 'partial' ? 'partial' : e.type === 'adjustment' ? 'adjustment' : 'charge';
    const amount = e.type === 'payment' || e.type === 'partial' ? `− ${money(e.amount)}` : e.type === 'charge' ? money(e.rent) : e.type === 'adjustment' && e.amount ? money(e.amount) : '—';
    const balance = e.dueAfter < -.004 ? `${money(-e.dueAfter)} credit` : money(Math.max(0, e.dueAfter));
    return `<tr><td data-label="Month / date"><b>${esc(e.monthLabel || e.monthKey || '')}</b><small>${formatDate(e.ts)} · ${formatTime(e.ts)}</small></td>
      <td data-label="Tenant"><span class="ledger-tenant">${esc(e.tenantName || 'Former tenant')}<small>${esc(e.unit ? `Apt ${e.unit}` : '')}</small></span></td>
      <td data-label="Building">${esc(e.buildingName || getBuilding(e.buildingId)?.name || 'Removed building')}</td>
      <td data-label="Activity"><span class="ledger-kind ${cls}">${kind}</span><small>${esc(e.note || '')}</small></td>
      <td data-label="Amount" class="money-cell ${e.type === 'payment' || e.type === 'partial' ? 'positive' : ''}">${amount}</td>
      <td data-label="Balance after" class="money-cell"><b>${balance}</b></td></tr>`;
  }).join('');
  const monthOptions = months.map((key) => {
    const label = propertyEntries.find((e) => e.monthKey === key)?.monthLabel || key;
    return `<option value="${esc(key)}" ${ui.ledgerMonthKey === key ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `<section class="ledger-page">
    <div class="ledger-hero"><div><p class="page-kicker">The books · ${filtered.length} entries</p><h2 class="page-title">Ledger & history 📒</h2><p class="page-sub">Every rent charge, rollover, and payment in one place. Balances are shown after each entry.</p></div>
      <button class="btn btn-soft" data-action="export-csv">⬇ Export CSV</button></div>
    <div class="ledger-tools"><label>Property <select id="ledger-building-filter"><option value="all">All buildings</option>${state.buildings.map((b) => `<option value="${esc(b.id)}" ${ui.ledgerBuildingId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
      <label>Month <select id="ledger-month-filter"><option value="all">All months</option>${monthOptions}</select></label>
      <span class="ledger-total">${money(filtered.filter((e) => e.type === 'payment' || e.type === 'partial').reduce((s, e) => s + e.amount, 0))} payments recorded</span></div>
    <div class="ledger-table-wrap"><table class="ledger-table"><thead><tr><th>Month / date</th><th>Tenant</th><th>Building</th><th>Activity</th><th>Amount</th><th>Balance after</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="ledger-empty-cell"><div class="ledger-empty"><span>🧾</span><b>No ledger entries yet</b><small>Rent charges and payments will appear here as you manage your buildings.</small></div></td></tr>`}</tbody></table></div>
    <p class="ledger-footnote">Balances on each row are the tenant’s running balance immediately after that activity. A negative balance is a carried credit.</p>
  </section>`;
}

function availableUnits(buildingId, currentTenantId = null) {
  const b = getBuilding(buildingId);
  if (!b) return [];
  return unitsOf(b).filter((u) => !state.tenants.some((t) => t.id !== currentTenantId && t.buildingId === buildingId && t.unit === u.label));
}
function tenantForm(tenant = null, defaults = {}) {
  const buildingId = tenant?.buildingId || defaults.buildingId || state.buildings[0]?.id || '';
  const units = availableUnits(buildingId, tenant?.id);
  const selectedUnit = tenant?.unit || defaults.unit || units[0]?.label || '';
  const emoji = tenant?.emoji || AVATARS[Math.floor(Math.random() * AVATARS.length)];
  openModal(`${modalHead(tenant ? '🧑‍🎨' : '🔑', tenant ? 'Edit tenant' : 'Add a tenant', 'Keep the rent book accurate — you can change these details later.')}
    <form id="tenant-form" class="form-body">
      <input type="hidden" name="id" value="${tenant?.id || ''}">
      <label class="field">Tenant name<input name="name" required maxlength="60" value="${esc(tenant?.name || '')}" placeholder="e.g. Alex Rivera"></label>
      <div class="field-row"><label class="field">Building<select name="buildingId" required>${state.buildings.map((b) => `<option value="${b.id}" ${b.id === buildingId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
        <label class="field">Apartment<select name="unit" required>${units.length ? units.map((u) => `<option value="${u.label}" ${u.label === selectedUnit ? 'selected' : ''}>Apt ${u.label}</option>`).join('') : '<option value="">No available apartments</option>'}</select></label></div>
      <div class="field-row"><label class="field">Exact monthly rent<input name="rent" type="number" min="0.01" step="0.01" required value="${tenant?.rent ?? ''}" placeholder="1500.00"></label>
        <label class="field">Tenant avatar<select name="emoji">${AVATARS.map((a) => `<option ${a === emoji ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
      ${tenant ? `<div class="form-hint">Current balance: <b>${balanceLabel(tenant)}</b>. Changing the rent adjusts this month’s charge by the difference.</div>` : `<div class="form-hint">A new tenant starts with this month’s rent due. Their balance will roll forward when you advance the month.</div>`}
      <div class="modal-foot"><div class="spacer"></div>${tenant ? `<button type="button" class="btn btn-danger btn-soft" data-action="delete-tenant" data-id="${tenant.id}">Delete tenant</button>` : ''}<button type="button" class="btn btn-soft" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${tenant ? 'Save changes' : 'Add tenant'}</button></div>
    </form>`, { wide: true });
}
function buildingForm(building = null) {
  const b = building || { name: nextBuildingName(), color: THEME_KEYS[state.buildings.length % THEME_KEYS.length], floors: 3, unitsPerFloor: 2, emoji: ROOF_EMOJI[state.buildings.length % ROOF_EMOJI.length] };
  openModal(`${modalHead(building ? '🏢' : '🏘️', building ? 'Building details' : 'Add a building', 'Create the apartments in your neighborhood.')}
    <form id="building-form" class="form-body"><input type="hidden" name="id" value="${building?.id || ''}">
      <label class="field">Building name<input name="name" required maxlength="50" value="${esc(b.name)}" placeholder="Building A"></label>
      <div class="field-row"><label class="field">Floors<select name="floors">${Array.from({ length: 8 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === Number(b.floors) ? 'selected' : ''}>${n} ${n === 1 ? 'floor' : 'floors'}</option>`).join('')}</select></label>
      <label class="field">Apartments per floor<select name="unitsPerFloor">${Array.from({ length: 5 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === Number(b.unitsPerFloor) ? 'selected' : ''}>${n} ${n === 1 ? 'apartment' : 'apartments'}</option>`).join('')}</select></label></div>
      <div class="field-row"><label class="field">Building color<select name="color">${THEME_KEYS.map((k) => `<option value="${k}" ${k === b.color ? 'selected' : ''}>${THEMES[k].label}</option>`).join('')}</select></label>
      <label class="field">Building icon<select name="emoji">${ROOF_EMOJI.map((e) => `<option ${e === b.emoji ? 'selected' : ''}>${e}</option>`).join('')}</select></label></div>
      ${building ? '<div class="form-hint">Apartments with tenants cannot be removed by shrinking the building. Move or remove those tenants first.</div>' : ''}
      <div class="modal-foot"><div class="spacer"></div><button type="button" class="btn btn-soft" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${building ? 'Save building' : 'Add building'}</button></div>
    </form>`);
}

function paymentForm(tenant) {
  const owed = Math.max(0, tenant.due);
  openModal(`${modalHead('🪙', 'Log a rent payment', `${esc(tenant.name)} · ${esc(getBuilding(tenant.buildingId)?.name || '')} · Apt ${esc(tenant.unit)}`)}
    <form id="payment-form" class="form-body"><input type="hidden" name="id" value="${tenant.id}">
      <div class="payment-summary"><span>Current balance due</span><strong>${money(owed)}</strong><small>Monthly rent ${money(tenant.rent)} · paid this month ${money(tenant.paidThisMonth)}</small></div>
      <label class="field">Payment amount<input name="amount" type="number" min="0.01" step="0.01" max="100000000" required value="${owed > 0 ? owed.toFixed(2) : ''}" placeholder="0.00"><small>Partial payments leave the remainder due; overpayments become a credit for next month.</small></label>
      <label class="field">Note (optional)<input name="note" maxlength="120" placeholder="e.g. bank transfer"></label>
      <div class="modal-foot"><div class="spacer"></div><button type="button" class="btn btn-soft" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">💰 Log payment</button></div>
    </form>`);
}

function tenantActions(tenant) {
  const t = getTenant(tenant.id); if (!t) return;
  const dueText = t.due < -.004 ? `${money(-t.due)} credit` : `${money(Math.max(0, t.due))} due`;
  openModal(`${modalHead(t.emoji, esc(t.name), `${esc(getBuilding(t.buildingId)?.name || 'Building')} · Apartment ${esc(t.unit)}`)}
    <div class="modal-body"><div class="tenant-detail-stats"><div><small>Monthly rent</small><b>${money(t.rent)}</b></div><div><small>Paid this month</small><b>${money(t.paidThisMonth)}</b></div><div><small>Previous balance</small><b>${money(t.prevDue)}</b></div><div><small>Current balance</small><b>${dueText}</b></div></div>
      <p class="form-hint">${statusText(t)} · ${t.due < -.004 ? 'Credit will reduce next month’s rent.' : t.due > .004 ? 'Any amount entered is applied to this running balance.' : 'This tenant has no outstanding balance.'}</p></div>
    <div class="modal-foot"><button class="btn btn-soft" data-action="edit-tenant" data-id="${t.id}">✏️ Edit details</button><div class="spacer"></div><button class="btn btn-soft" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="pay-tenant" data-id="${t.id}">🪙 Log payment</button></div>`);
}
function settingsModal() {
  openModal(`${modalHead('🧰', 'Settings & backup', 'Your data is saved in this browser on this device.')}
    <div class="modal-body settings-body"><div class="settings-card"><b>💾 Local save</b><p>Changes save automatically to this browser. Export a backup before clearing browser data or switching devices.</p><span class="settings-save">${esc($('#save-state')?.textContent || 'Saved locally')}</span></div>
      <div class="backup-actions"><button class="btn btn-soft" data-action="export-json">⬇ Download backup</button><button class="btn btn-soft" data-action="import-json">⬆ Restore backup</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>
      <div class="settings-card"><b>🧹 Start fresh</b><p>Clear all buildings, tenants, balances, and history from this browser. This cannot be undone.</p><button class="btn btn-danger btn-soft" data-action="reset-data">Clear all data</button></div>
    </div><div class="modal-foot"><div class="spacer"></div><button class="btn btn-primary" data-action="close-modal">Done</button></div>`);
}
function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCSV() {
  const headers = ['Month', 'Date', 'Building', 'Tenant', 'Apartment', 'Activity', 'Rent', 'Previous due', 'Amount', 'Balance after', 'Note'];
  const rows = state.ledger.slice().sort((a, b) => a.ts - b.ts).map((e) => [e.monthLabel || e.monthKey, new Date(e.ts).toISOString(), e.buildingName, e.tenantName, e.unit, e.type, e.rent, e.prevDue, e.amount, e.dueAfter, e.note]);
  downloadFile('property-tycoon-ledger.csv', [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  toast('Ledger downloaded as CSV.', { icon: '📒' });
}
function exportJSON() {
  downloadFile(`property-tycoon-backup-${monthKey(state.month)}.json`, JSON.stringify(state, null, 2), 'application/json');
  toast('Backup downloaded.', { icon: '💾' });
}
async function importBackup(file) {
  try {
    if (!file || file.size > 20 * 1024 * 1024) throw new Error('Choose a JSON backup smaller than 20 MB.');
    const backup = JSON.parse(await file.text());
    if (!backup || typeof backup !== 'object' || !Array.isArray(backup.buildings) || !Array.isArray(backup.tenants) || !Array.isArray(backup.ledger)) {
      throw new Error('This file is not a Property Tycoon backup.');
    }
    if (!backup.month || !Number.isInteger(backup.month.y) || backup.month.y < 1900 || backup.month.y > 9999 || !Number.isInteger(backup.month.m) || backup.month.m < 0 || backup.month.m > 11) {
      throw new Error('The backup has an invalid current month.');
    }
    if (backup.buildings.length > 500 || backup.tenants.length > 5000 || backup.ledger.length > 100000) throw new Error('The backup contains too many records.');
    const uniqueIds = (items) => items.every((item) => item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim()) && new Set(items.map((item) => item.id)).size === items.length;
    if (!uniqueIds(backup.buildings) || !uniqueIds(backup.tenants) || !uniqueIds(backup.ledger)) throw new Error('The backup contains missing or duplicate record IDs.');
    const buildingIds = new Set(backup.buildings.map((b) => b.id));
    const validUnits = new Set();
    for (const b of backup.buildings) {
      if (!Number.isInteger(b.floors) || b.floors < 1 || b.floors > 8 || !Number.isInteger(b.unitsPerFloor) || b.unitsPerFloor < 1 || b.unitsPerFloor > 5) throw new Error('A building has invalid floor or apartment settings.');
      for (let floor = 1; floor <= b.floors; floor++) for (let i = 0; i < b.unitsPerFloor; i++) validUnits.add(`${b.id}:${floor}${String.fromCharCode(65 + i)}`);
    }
    const occupied = new Set();
    for (const t of backup.tenants) {
      if (!buildingIds.has(t.buildingId) || typeof t.unit !== 'string' || !validUnits.has(`${t.buildingId}:${t.unit}`)) throw new Error('A tenant refers to a missing building or apartment.');
      const address = `${t.buildingId}:${t.unit}`;
      if (occupied.has(address)) throw new Error('Two tenants are assigned to the same apartment.');
      occupied.add(address);
      for (const key of ['rent', 'paidThisMonth', 'prevDue', 'due']) if (!Number.isFinite(t[key])) throw new Error('A tenant record contains an invalid balance.');
      if (t.rent <= 0) throw new Error('A tenant must have rent greater than $0.');
    }
    for (const e of backup.ledger) {
      if (!Number.isFinite(e.ts) || ['rent', 'prevDue', 'amount', 'dueAfter'].some((key) => !Number.isFinite(e[key]))) throw new Error('A ledger record contains invalid amounts or a date.');
    }
    const imported = normalizeState(backup);
    confirmDialog({
      title: 'Restore this backup?', icon: '💾', confirmLabel: 'Restore backup',
      message: `Replace the data in this browser with <b>${imported.buildings.length} buildings</b>, <b>${imported.tenants.length} tenants</b>, and <b>${imported.ledger.length} ledger entries</b>? Current data will be overwritten.`,
      onConfirm: () => {
        state = imported;
        ui = { view: 'map', buildingId: null, ledgerBuildingId: 'all', ledgerMonthKey: 'all', collecting: false };
        closeModal(); commit(); toast('Backup restored successfully.', { icon: '💾', tone: 'success' });
      },
    });
  } catch (error) {
    console.error('Could not restore backup', error);
    toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message || 'Could not restore this backup.', { icon: '⚠️', tone: 'error', duration: 5000 });
  }
}
function addLedgerEntry(t, type, amount, note = '') {
  const b = getBuilding(t.buildingId);
  state.ledger.push({ id: uid('led'), ts: Date.now(), monthKey: monthKey(state.month), monthLabel: monthLabel(state.month),
    buildingId: t.buildingId, buildingName: b?.name || '', tenantId: t.id, tenantName: t.name, unit: t.unit,
    type, rent: t.rent, prevDue: t.prevDue, amount: roundMoney(amount), dueAfter: t.due, note });
}
function logPayment(tenantId, amount, note = '') {
  const t = getTenant(tenantId); if (!t || !Number.isFinite(amount) || amount <= 0) return false;
  const before = t.due;
  t.paidThisMonth = roundMoney(t.paidThisMonth + amount);
  t.due = roundMoney(t.due - amount);
  const full = t.due <= .004;
  const type = full ? 'payment' : 'partial';
  addLedgerEntry(t, type, amount, note || (t.due < -.004 ? `Overpayment · ${money(-t.due)} credit carried` : full ? 'Paid in full' : `${money(t.due)} remains due`));
  const earned = xpFor(amount) + (before > .004 && full ? 5 : 0);
  const beforeLevel = levelInfo().level;
  state.xp += earned;
  AudioKit.coin();
  if (before > .004 && full) { AudioKit.register(); fxConfetti(18); }
  if (levelInfo().level > beforeLevel) { AudioKit.level(); toast(`Level ${levelInfo().level}! ${levelInfo().title}`, { icon: '⭐' }); }
  return true;
}
function advanceMonth() {
  const from = monthLabel(state.month);
  state.month = addMonths(state.month, 1);
  state.tenants.forEach((t, i) => {
    const carried = t.due;
    t.prevDue = carried;
    t.due = roundMoney(t.rent + carried);
    t.paidThisMonth = 0;
    addLedgerEntry(t, 'rollover', 0, `New month · rent ${money(t.rent)} + carried ${money(carried)} = ${money(t.due)}`);
  });
  ui.collecting = false;
  AudioKit.advance(); fxMonth();
  toast(`Welcome to ${monthLabel(state.month)}! Rent and balances rolled forward.`, { icon: '📅', duration: 4800 });
  commit();
}
function setView(view) {
  ui.view = view;
  if (view === 'building' && !getBuilding(ui.buildingId)) ui.view = 'map';
  render();
}
function confirmDeleteTenant(id) {
  const t = getTenant(id); if (!t) return;
  confirmDialog({ title: 'Remove this tenant?', message: `This removes <b>${esc(t.name)}</b> from the active tenant list. Existing ledger history is kept. Current balance ${esc(balanceLabel(t))} will remain visible in past entries.`, confirmLabel: 'Remove tenant', danger: true, icon: '🗑️', onConfirm: () => {
    state.tenants = state.tenants.filter((x) => x.id !== id);
    closeModal(); commit(); toast('Tenant removed. Ledger history was kept.', { icon: '🧹' });
  } });
}
function confirmDeleteBuilding(id) {
  const b = getBuilding(id); if (!b) return;
  const count = tenantsOf(id).length;
  confirmDialog({ title: 'Remove this building?', message: `Remove <b>${esc(b.name)}</b>${count ? ` and its ${plural(count, 'active tenant')}` : ''}? Existing ledger entries will stay in history. This cannot be undone.`, confirmLabel: 'Remove building', danger: true, icon: '🏚️', onConfirm: () => {
    state.buildings = state.buildings.filter((x) => x.id !== id);
    state.tenants = state.tenants.filter((x) => x.buildingId !== id);
    if (ui.buildingId === id) { ui.buildingId = null; ui.view = 'map'; }
    if (ui.ledgerBuildingId === id) ui.ledgerBuildingId = 'all';
    closeModal(); commit(); toast('Building removed; historical ledger entries remain.', { icon: '🧹' });
  } });
}

/* ============================================================
   Actions and event handling
   ============================================================ */
function doCollection(id = null) {
  const list = state.tenants.filter((t) => (!id || t.buildingId === id) && t.due > .004);
  if (!list.length) { toast('Everyone is paid up — no balances to collect!', { icon: '🎉' }); return; }
  let collected = 0;
  list.forEach((t) => { const amount = t.due; if (logPayment(t.id, amount, 'Rent Collection Day · paid in full')) collected += amount; });
  ui.collecting = state.tenants.some((t) => t.due > .004);
  fxConfetti(25);
  toast(`${money(collected)} collected from ${plural(list.length, 'household')}.`, { icon: '🪙', tone: 'success' });
  commit();
}
function onAction(action, el) {
  const id = el.dataset.id;
  switch (action) {
    case 'nav-map': ui.buildingId = null; setView('map'); break;
    case 'nav-ledger': setView('ledger'); break;
    case 'open-building': ui.buildingId = id; setView('building'); break;
    case 'add-building': buildingForm(); break;
    case 'rename-building': { const b = getBuilding(id); if (b) buildingForm(b); break; }
    case 'delete-building': confirmDeleteBuilding(id); break;
    case 'add-tenant': if (!state.buildings.length) buildingForm(); else tenantForm(null, { buildingId: el.dataset.building || ui.buildingId, unit: el.dataset.unit }); break;
    case 'open-tenant': { const t = getTenant(id); if (t) tenantActions(t); break; }
    case 'edit-tenant': { const t = getTenant(id); if (t) tenantForm(t); break; }
    case 'delete-tenant': confirmDeleteTenant(id); break;
    case 'pay-tenant': { const t = getTenant(id); if (t) paymentForm(t); break; }
    case 'collect-coin': {
      const t = getTenant(id); if (t && t.due > .004) {
        const rect = el.getBoundingClientRect(); fxCoins(rect.left + rect.width / 2, rect.top + rect.height / 2);
        logPayment(id, t.due, 'Rent Collection Day · paid in full');
        ui.collecting = state.tenants.some((x) => x.due > .004);
        if (t.due <= .004) toast(`${esc(t.name)} is paid up!`, { icon: '🎉', tone: 'success' });
        commit();
      }
      break;
    }
    case 'collect-building': doCollection(id); break;
    case 'start-collection':
      ui.collecting = true;
      if (!dueHouseholds().length) toast('Everyone is paid up — great work!', { icon: '🎉' });
      render();
      if (ui.view === 'map') document.querySelector('.collection-banner')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;
    case 'stop-collection': ui.collecting = false; render(); break;
    case 'advance-month': confirmDialog({ title: `Advance to ${monthLabel(addMonths(state.month, 1))}?`, icon: '📅', confirmLabel: 'Advance month', message: `This closes <b>${esc(monthLabel(state.month))}</b> and starts the next month for every building. Unpaid balances carry forward, credits reduce next month’s rent, and monthly payments reset.`, onConfirm: () => { closeModal(); advanceMonth(); } }); break;
    case 'toggle-sound': state.settings.sound = !state.settings.sound; commit(); toast(state.settings.sound ? 'Sound effects on.' : 'Sound effects off.', { icon: state.settings.sound ? '🔊' : '🔇' }); break;
    case 'open-settings': settingsModal(); break;
    case 'close-modal': if (el.classList.contains('modal-backdrop') && el !== el.parentElement) closeModal(); else if (el.closest('.modal') || el.classList.contains('modal-backdrop')) closeModal(); break;
    case 'confirm-dialog': { const fn = confirmAction; confirmAction = null; if (fn) fn(); break; }
    case 'dismiss-demo': state.settings.demoDismissed = true; commit(); break;
    case 'clear-demo': confirmDialog({ title: 'Start with a clean slate?', icon: '🧹', confirmLabel: 'Clear sample data', danger: true, message: 'Remove the sample buildings, tenants, balances, and sample history? You can then enter your real properties.', onConfirm: () => { const settings = { ...state.settings, demoDismissed: true }; state = createEmptyState(); state.settings = settings; ui.buildingId = null; ui.view = 'map'; closeModal(); commit(); toast('Sample neighborhood cleared. Add your real buildings when ready.', { icon: '🏡' }); } }); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': $('#import-file')?.click(); break;
    case 'reset-data': confirmDialog({ title: 'Clear all local data?', icon: '⚠️', confirmLabel: 'Clear everything', danger: true, message: 'This permanently deletes every building, tenant, balance, and ledger entry in this browser. Download a backup first if you may need this data.', onConfirm: () => { state = createEmptyState(); ui = { view: 'map', buildingId: null, ledgerBuildingId: 'all', ledgerMonthKey: 'all', collecting: false }; closeModal(); commit(); toast('All local data cleared.', { icon: '🧹' }); } }); break;
  }
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'open-building' && event.target.closest('button[data-action]')) return;
  event.preventDefault();
  AudioKit.click();
  onAction(action, el);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalOpen) { closeModal(); return; }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"][data-action]')) {
    event.preventDefault(); event.target.click();
  }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'ledger-building-filter') {
    ui.ledgerBuildingId = event.target.value;
    ui.ledgerMonthKey = 'all';
    renderView(); return;
  }
  if (event.target.id === 'ledger-month-filter') {
    ui.ledgerMonthKey = event.target.value;
    renderView(); return;
  }
  if (event.target.name === 'buildingId' && event.target.closest('#tenant-form')) {
    const form = event.target.form;
    const currentId = form.elements.id.value || null;
    const units = availableUnits(event.target.value, currentId);
    const select = form.elements.unit;
    select.innerHTML = units.length ? units.map((u) => `<option value="${u.label}">Apt ${u.label}</option>`).join('') : '<option value="">No available apartments</option>';
  }
  if (event.target.id === 'import-file' && event.target.files?.[0]) importBackup(event.target.files[0]);
});
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form.getAttribute('id') === 'tenant-form') {
    event.preventDefault();
    const data = new FormData(form); const id = String(data.get('id') || '');
    const buildingId = String(data.get('buildingId') || ''); const unit = String(data.get('unit') || '');
    const b = getBuilding(buildingId); const rent = roundMoney(num(data.get('rent'), NaN));
    const name = String(data.get('name') || '').trim();
    if (!b || !name || !unit || !Number.isFinite(rent) || rent <= 0) { toast('Please enter a name, available apartment, and rent above $0.', { icon: '⚠️', tone: 'error' }); return; }
    const occupant = tenantAt(buildingId, unit);
    if (occupant && occupant.id !== id) { toast('That apartment is already occupied. Choose another unit.', { icon: '⚠️', tone: 'error' }); return; }
    let t = id ? getTenant(id) : null;
    if (t) {
      const oldRent = t.rent; const moved = t.buildingId !== buildingId || t.unit !== unit;
      t.name = name; t.emoji = String(data.get('emoji') || '👤'); t.buildingId = buildingId; t.unit = unit;
      t.due = roundMoney(t.due + rent - oldRent); t.rent = rent;
      if (moved) addLedgerEntry(t, 'adjustment', 0, `Tenant assignment updated · ${b.name}, Apt ${unit}`);
      if (Math.abs(rent - oldRent) > .004) addLedgerEntry(t, 'adjustment', rent - oldRent, `Monthly rent changed from ${money(oldRent)} to ${money(rent)}`);
      toast(`${esc(name)}’s details updated.`, { icon: '✅' });
    } else {
      t = { id: uid('ten'), name, emoji: String(data.get('emoji') || '👤'), buildingId, unit, rent, paidThisMonth: 0, prevDue: 0, due: rent, createdAt: Date.now() };
      state.tenants.push(t); addLedgerEntry(t, 'charge', rent, `Opening charge · rent ${money(rent)}`);
      toast(`${esc(name)} added to ${esc(b.name)}.`, { icon: '🔑' });
    }
    closeModal(); commit(); return;
  }
  if (form.getAttribute('id') === 'building-form') {
    event.preventDefault(); const data = new FormData(form); const id = String(data.get('id') || '');
    const name = String(data.get('name') || '').trim();
    if (!name) { toast('Building name can’t be blank.', { icon: '⚠️', tone: 'error' }); return; }
    if (state.buildings.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== id)) { toast('A building already has that name.', { icon: '⚠️', tone: 'error' }); return; }
    const floors = Number(data.get('floors')); const unitsPerFloor = Number(data.get('unitsPerFloor'));
    const existing = id ? getBuilding(id) : null;
    if (existing) {
      const capacity = floors * unitsPerFloor;
      const occupied = tenantsOf(id);
      const valid = new Set();
      for (let f = floors; f >= 1; f--) for (let i = 0; i < unitsPerFloor; i++) valid.add(`${f}${String.fromCharCode(65 + i)}`);
      const conflict = occupied.find((t) => !valid.has(t.unit));
      if (conflict) { toast(`Apt ${conflict.unit} has a tenant. Move them before shrinking the building to ${capacity} homes.`, { icon: '⚠️', tone: 'error', duration: 5000 }); return; }
      existing.name = name; existing.floors = floors; existing.unitsPerFloor = unitsPerFloor; existing.color = String(data.get('color')); existing.emoji = String(data.get('emoji'));
      toast(`${esc(name)} updated.`, { icon: '🏢' });
    } else {
      const b = { id: uid('bld'), name, floors, unitsPerFloor, color: String(data.get('color')), emoji: String(data.get('emoji')) };
      state.buildings.push(b); ui.buildingId = b.id; ui.view = 'building';
      toast(`${esc(name)} added to your neighborhood.`, { icon: '🏘️' });
    }
    closeModal(); commit(); return;
  }
  if (form.getAttribute('id') === 'payment-form') {
    event.preventDefault(); const data = new FormData(form); const amount = roundMoney(num(data.get('amount'), NaN));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { toast('Enter a payment amount greater than $0.', { icon: '⚠️', tone: 'error' }); return; }
    const t = getTenant(String(data.get('id'))); if (!t) { closeModal(); toast('Tenant no longer exists.', { icon: '⚠️' }); return; }
    logPayment(t.id, amount, String(data.get('note') || '').trim()); closeModal(); commit();
    toast(`${money(amount)} payment recorded for ${esc(t.name)}.`, { icon: '💰', tone: 'success' }); return;
  }
});

const initialSave = loadState();
state = initialSave.state;
render();
if (!initialSave.loaded) persist();
