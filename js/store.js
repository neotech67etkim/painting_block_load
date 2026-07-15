// 블록 데이터 저장소: 블록 CRUD, 일정(route) 조회, localStorage 영속화
import { getCell } from './data.js';

const STORAGE_KEY = 'block-load-sim/blocks/v1';

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
  '#0d9488', '#c026d3', '#ca8a04', '#059669', '#e11d48',
];

function colorFor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function uid(prefix = 'blk') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedBlocks() {
  // route: [{ id, stage: 'blast'|'paint', cellId, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }]
  const mk = (name, w, l, route) => ({
    id: uid(), name, size: { w, l }, color: colorFor(name),
    route: route.map(r => ({ id: uid('leg'), ...r })),
  });

  return [
    mk('1A', 18, 12, [
      { stage: 'blast', cellId: 'f2-blast1', start: '2026-07-08', end: '2026-07-11' },
      { stage: 'paint', cellId: 'f2-paint1', start: '2026-07-12', end: '2026-07-19' },
    ]),
    mk('1B', 18, 12, [
      { stage: 'blast', cellId: 'f2-blast1', start: '2026-07-09', end: '2026-07-12' },
      { stage: 'paint', cellId: 'f2-paint1', start: '2026-07-13', end: '2026-07-20' },
    ]),
    mk('2A', 20, 14, [
      { stage: 'blast', cellId: 'f2-blast2', start: '2026-07-13', end: '2026-07-16' },
      { stage: 'paint', cellId: 'f2-paint2', start: '2026-07-17', end: '2026-07-25' },
    ]),
    mk('2B', 20, 14, [
      { stage: 'blast', cellId: 'f2-blast2', start: '2026-07-14', end: '2026-07-17' },
      { stage: 'paint', cellId: 'f2-paint2', start: '2026-07-18', end: '2026-07-26' },
    ]),
    mk('3A', 30, 40, [
      { stage: 'paint', cellId: 'f1-paint3', start: '2026-07-01', end: '2026-07-20' },
    ]),
    mk('3B', 30, 40, [
      { stage: 'paint', cellId: 'f1-paint3', start: '2026-07-05', end: '2026-07-25' },
    ]),
    mk('5A', 30, 40, [
      { stage: 'blast', cellId: 'f1-blast1', start: '2026-07-10', end: '2026-07-14' },
      { stage: 'paint', cellId: 'f2-paint5', start: '2026-07-15', end: '2026-07-24' },
    ]),
    mk('5B', 30, 40, [
      { stage: 'blast', cellId: 'f1-blast1', start: '2026-07-11', end: '2026-07-15' },
    ]),
    mk('6A', 22, 18, [
      { stage: 'blast', cellId: 'f1-blast2', start: '2026-07-14', end: '2026-07-18' },
    ]),
    mk('6B', 22, 18, [
      { stage: 'blast', cellId: 'f1-blast2', start: '2026-07-14', end: '2026-07-18' },
    ]),
    mk('7A', 22, 18, [
      { stage: 'blast', cellId: 'f1-blast2', start: '2026-07-13', end: '2026-07-17' },
    ]),
    mk('8A', 24, 16, [
      { stage: 'paint', cellId: 'f2-paint6', start: '2026-07-05', end: '2026-07-13' },
    ]),
    mk('9A', 24, 16, [
      { stage: 'paint', cellId: 'f2-paint7', start: '2026-07-20', end: '2026-07-28' },
    ]),
    // 용량 초과(오버플로우) 데모: f2-paint4 (capacity 2)에 동시 3건 배치
    mk('10A', 20, 14, [
      { stage: 'paint', cellId: 'f2-paint4', start: '2026-07-10', end: '2026-07-20' },
    ]),
    mk('10B', 20, 14, [
      { stage: 'paint', cellId: 'f2-paint4', start: '2026-07-12', end: '2026-07-22' },
    ]),
    mk('10C', 20, 14, [
      { stage: 'paint', cellId: 'f2-paint4', start: '2026-07-13', end: '2026-07-18' },
    ]),
  ];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('블록 데이터를 불러오지 못했습니다. 초기 데이터로 재설정합니다.', e);
  }
  const seeded = seedBlocks();
  save(seeded);
  return seeded;
}

function save(blocks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

let blocks = load();
const listeners = new Set();

function notify() {
  save(blocks);
  listeners.forEach(fn => fn());
}

export const Store = {
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  getBlocks() { return blocks; },

  getBlock(id) { return blocks.find(b => b.id === id) || null; },

  addBlock({ name, w, l, route, meta }) {
    const block = {
      id: uid(), name, size: { w: Number(w), l: Number(l) }, color: colorFor(name + uid()),
      route: route.map(r => ({ id: uid('leg'), ...r })),
      ...(meta ? { meta } : {}),
    };
    blocks.push(block);
    notify();
    return block;
  },

  // 엑셀 등 외부 데이터에서 파싱한 블록 목록을 일괄 반영 (id/color 자동 생성)
  loadBlocksBulk(list, { replace = true } = {}) {
    const built = list.map(b => ({
      id: uid(), name: b.name, size: { w: Number(b.w), l: Number(b.l) }, color: colorFor(b.name + uid()),
      route: b.route.map(r => ({ id: uid('leg'), stage: r.stage, cellId: r.cellId, start: r.start, end: r.end })),
      ...(b.meta ? { meta: b.meta } : {}),
    }));
    blocks = replace ? built : [...blocks, ...built];
    notify();
    return built;
  },

  updateBlock(id, { name, w, l, route }) {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    b.name = name;
    b.size = { w: Number(w), l: Number(l) };
    b.route = route.map(r => ({ id: r.id || uid('leg'), stage: r.stage, cellId: r.cellId, start: r.start, end: r.end }));
    notify();
  },

  deleteBlock(id) {
    blocks = blocks.filter(b => b.id !== id);
    notify();
  },

  resetSeed() {
    blocks = seedBlocks();
    notify();
  },

  importJSON(json) {
    blocks = json;
    notify();
  },

  exportJSON() {
    return JSON.stringify(blocks, null, 2);
  },
};

// ---- 조회 헬퍼 ----

// date: 'YYYY-MM-DD' — 해당 블록이 그 날짜에 어느 stage/cell에 있는지
export function activeLegOnDate(block, date) {
  return block.route.find(leg => leg.start <= date && date <= leg.end) || null;
}

export function blockStatusOnDate(block, date) {
  const leg = activeLegOnDate(block, date);
  if (leg) return { status: 'active', leg };
  const first = block.route[0];
  const last = block.route[block.route.length - 1];
  if (first && date < first.start) return { status: 'waiting', leg: null };
  if (last && date > last.end) return { status: 'done', leg: null };
  return { status: 'gap', leg: null }; // 두 공정 사이 이동/대기 중
}

// 특정 셀, 특정 날짜에 점유 중인 블록 목록
export function cellOccupancy(cellId, date) {
  const out = [];
  for (const b of blocks) {
    const leg = activeLegOnDate(b, date);
    if (leg && leg.cellId === cellId) out.push({ block: b, leg });
  }
  return out;
}

export function cellUtilization(cellId, date) {
  const cell = getCell(cellId);
  if (!cell) return { occupied: 0, capacity: 0, ratio: 0 };
  const occupied = cellOccupancy(cellId, date).length;
  return { occupied, capacity: cell.capacity, ratio: cell.capacity ? occupied / cell.capacity : 0 };
}

export function dateRange(startDate, days) {
  const out = [];
  const d = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < days; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    out.push(dd.toISOString().slice(0, 10));
  }
  return out;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
