// 실적 엑셀(.xlsx) 가져오기
// 기대 서식 (2행 헤더, 데이터는 3행부터):
//   A:호선 B:블록 | C~F: SIZE(소지면적㎡, L, B, H) | G~H: 계획(착수,완료) | I~J: 실적(착수,완료) | K: 비고
// 규칙: 블라스팅 2일(1일차 입고, 2일차 작업) 후 도장샵으로 이동.
//       도장 착수/완료는 실적이 있으면 실적을, 없으면 계획을 사용.
import { ALL_CELLS, usablePlacementSize } from './data.js';
import { addDays } from './store.js';

const COL = { hull: 0, block: 1, area: 2, L: 3, B: 4, H: 5, planStart: 6, planEnd: 7, actStart: 8, actEnd: 9, note: 10 };

function pad2(n) { return String(n).padStart(2, '0'); }

function toISODate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return `${val.getUTCFullYear()}-${pad2(val.getUTCMonth() + 1)}-${pad2(val.getUTCDate())}`;
  }
  if (typeof val === 'number') {
    // 엑셀 날짜 일련번호 (cellDates 옵션이 못 잡은 경우 대비)
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  const s = String(val).trim().replace(/\./g, '-').replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  return null;
}

function toNumber(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// 워크북(첫 시트)을 읽어 블록 초안 배열로 변환 (아직 셀 미배정)
export function parseWorkbookRows(workbook) {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
  const dataRows = rows.slice(2); // 상단 2행은 헤더

  const drafts = [];
  const skipped = [];

  for (const r of dataRows) {
    const hull = r[COL.hull] != null ? String(r[COL.hull]).trim() : '';
    const blockName = r[COL.block] != null ? String(r[COL.block]).trim() : '';
    if (!hull && !blockName) continue; // 완전 빈 행

    const planStart = toISODate(r[COL.planStart]);
    const planEnd = toISODate(r[COL.planEnd]);
    const actStart = toISODate(r[COL.actStart]);
    const actEnd = toISODate(r[COL.actEnd]);

    const paintStart = actStart || planStart;
    let paintEnd = actEnd || planEnd || paintStart;
    if (!paintStart) {
      skipped.push({ hull, blockName, reason: '착수일 없음' });
      continue;
    }
    if (paintEnd < paintStart) paintEnd = paintStart;

    const blastEnd = addDays(paintStart, -1);   // 2일차: 작업일 (도장 착수 전날)
    const blastStart = addDays(paintStart, -2); // 1일차: 입고일

    drafts.push({
      name: hull && blockName ? `${hull}-${blockName}` : (blockName || hull || '이름없음'),
      w: toNumber(r[COL.L], 10),
      l: toNumber(r[COL.B], 10),
      meta: {
        hull, block: blockName,
        area: r[COL.area] ?? null, h: r[COL.H] ?? null,
        planStart, planEnd, actStart, actEnd,
        note: r[COL.note] != null ? String(r[COL.note]).trim() : '',
        usedActual: !!(actStart && actEnd),
      },
      legsDraft: [
        { stage: 'blast', start: blastStart, end: blastEnd },
        { stage: 'paint', start: paintStart, end: paintEnd },
      ],
    });
  }

  return { drafts, skipped, sheetName };
}

// 블록이 셀의 실제 배치 가능 크기(장비 여유 제외)에 회전 없이/90도 회전해서 들어가는지 확인
function fitsCell(cell, w, l) {
  const u = usablePlacementSize(cell);
  return (w <= u.w && l <= u.l) || (l <= u.w && w <= u.l);
}

// 그리디 적치 배정: 같은 유형(블라스팅/도장) 셀 중 블록 크기가 실제로 들어가는 셀을
// 우선 후보로 삼고(안 맞으면 전체로 폴백), 그 중 정원 초과가 없는 셀 → 있다면 최소
// 초과 셀을 선택한다. 동률이면 작은 셀부터 채워 큰 홀(예: 도장1공장 #3)로만 몰리는
// 것을 방지한다.
export function assignCells(drafts) {
  const occ = {}; // cellId -> date -> count
  const cellsByType = {
    blast: ALL_CELLS.filter(c => c.type === 'blast'),
    paint: ALL_CELLS.filter(c => c.type === 'paint'),
  };

  const legsFlat = [];
  drafts.forEach((d, di) => d.legsDraft.forEach((leg, li) => legsFlat.push({ ...leg, di, li })));
  legsFlat.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const datesInRange = (start, end) => {
    const out = [];
    let cur = start;
    let guard = 0;
    while (cur <= end && guard++ < 400) { out.push(cur); cur = addDays(cur, 1); }
    return out;
  };

  let overflowCount = 0;

  for (const leg of legsFlat) {
    const draft = drafts[leg.di];
    const allOfType = cellsByType[leg.stage];
    const fitting = allOfType.filter(c => fitsCell(c, draft.w, draft.l));
    const candidates = fitting.length > 0 ? fitting : allOfType; // 맞는 셀이 없으면 전체 후보로 폴백

    const days = datesInRange(leg.start, leg.end);
    let best = null;
    for (const cell of candidates) {
      const cellOcc = occ[cell.id] || {};
      const maxIfAssigned = Math.max(...days.map(d => (cellOcc[d] || 0) + 1));
      const overrun = Math.max(0, maxIfAssigned - cell.capacity);
      // 1) 정원 초과가 적은 셀 우선  2) 초과가 같다면(대개 0) 더 작은 셀부터 채워
      //    큰 홀(예: 도장1공장 #3, 정원 24)로만 몰리는 것을 방지
      if (!best || overrun < best.overrun || (overrun === best.overrun && cell.capacity < best.cell.capacity)) {
        best = { cell, overrun };
      }
    }
    occ[best.cell.id] = occ[best.cell.id] || {};
    for (const d of days) occ[best.cell.id][d] = (occ[best.cell.id][d] || 0) + 1;
    if (best.overrun > 0) overflowCount++;

    drafts[leg.di].legsDraft[leg.li].cellId = best.cell.id;
  }

  const blocks = drafts.map(d => ({
    name: d.name, w: d.w, l: d.l, meta: d.meta,
    route: d.legsDraft.map(({ stage, cellId, start, end }) => ({ stage, cellId, start, end })),
  }));

  return { blocks, overflowLegCount: overflowCount };
}

export async function importXlsxFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
  const { drafts, skipped, sheetName } = parseWorkbookRows(workbook);
  const { blocks, overflowLegCount } = assignCells(drafts);
  return { blocks, skipped, sheetName, overflowLegCount, total: drafts.length };
}
