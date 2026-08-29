// 일일작업현황("도장작업계획 (YY. M월 D일) 요일") 엑셀 여러 개를 모아 블록 이력을 재구성.
//
// 서식(사용자 제공 사진 기준, 2026-08-29): 도장1공장/도장2공장 각각 "BLOCK" 헤더 아래로
// 셀그룹 라벨(예: "(B/S) 1-1", "1-3A(금양)", "(PAINT) #2-1(금양)")이 여러 행에 걸쳐
// 병합되어 있고, 그 아래(또는 같은 그룹 안)에 그 날 그 셀에 있는 블록들이
//   호선(블록번호) 회사 | m² | 착수 | 작업 | 검사 | 완료일
// 행으로 나열된다. #1 앞 / #2 앞 / 공장 앞 옥외장 / YARD 출고 BLOCK / 도장공장 앞
// 적치장은 공장 밖 야적 구역으로, data.js의 가상 야적 셀(yard-*)에 매핑한다.
//
// 단순화(사용자 확인, 2026-08-29):
//   - "작업" 열의 세부 단계(B/S&1ST/2ND/3RD/4TH준비/FINAL 등)는 구분하지 않고,
//     그 날짜에 그 셀에 있으면 "점유 중"으로만 취급한다.
//   - 블록 크기(w×l)는 이 파일에 L×B가 없어 m²(면적)에서 정사각형으로 역산한
//     근사치다(approxSquare: true로 표시). 실제 L×B가 있는 실적 엑셀(importXlsx.js)을
//     같은 블록에 나중에 가져오면 그쪽 값으로 덮어써야 더 정확하다.
//
// 여러 날짜 파일을 시간순으로 모아, 같은 블록(호선+블록번호)이 같은 셀에 연속으로
// 나타나는 구간을 하나의 공정(route leg)으로 묶는다. 이 파서는 실제 파일 없이
// 사진만으로 만든 1차 버전이라, 실제 파일로 가져오기 결과(제외/미매칭 라벨)를
// 확인하며 다듬어야 한다.

import { ALL_CELLS } from './data.js';

function pad2(n) { return String(n).padStart(2, '0'); }

// 라벨 텍스트 → cellId. 도장1공장은 숫자만으로 구분 가능하지만, 도장2공장은
// 블라스팅/도장이 각각 1부터 번호가 매겨지므로 (B/S)·PAINT 표시가 꼭 필요하다.
const LABEL_RULES = [
  { re: /1[\s-]?1\b/, cellId: 'f1-blast1' },
  { re: /1[\s-]?2\b/, cellId: 'f1-blast2' },
  { re: /1[\s-][3-6][ab]?/i, cellId: 'f1-paint3' },
  { re: /#?\s*1\s*앞/, cellId: 'yard-f1-front1' },
  { re: /#?\s*2\s*앞/, cellId: 'yard-f1-front2' },
  { re: /옥외장/, cellId: 'yard-f1-outdoor' },
  { re: /출고/, cellId: 'yard-shipped' },
  { re: /적치장/, cellId: 'yard-stockyard' },
];

function matchFactory2CellId(label) {
  const numMatch = label.match(/2[\s-](\d+)/);
  if (!numMatch) return null;
  const n = numMatch[1];
  if (/B\s*\/?\s*S|BLAST/i.test(label)) return `f2-blast${n}`;
  if (/PAINT/i.test(label)) return `f2-paint${n}`;
  return null; // 블라스팅/도장 표시가 없으면 어느 쪽인지 알 수 없어 미매칭 처리
}

function resolveCellId(label) {
  if (!label) return null;
  for (const rule of LABEL_RULES) {
    if (rule.re.test(label)) return rule.cellId;
  }
  return matchFactory2CellId(label);
}

// 제목 행에서 "26. 8월 21일" 같은 날짜를 찾는다.
function extractFileDate(rows) {
  for (const row of rows) {
    for (const cell of row) {
      const s = String(cell ?? '');
      const m = s.match(/(\d{2,4})\s*\.\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      if (m) {
        let year = Number(m[1]);
        if (year < 100) year += 2000;
        const month = Number(m[2]), day = Number(m[3]);
        return { year, month, day, iso: `${year}-${pad2(month)}-${pad2(day)}` };
      }
    }
  }
  return null;
}

// "M/D" 또는 "M/D(요일)" 텍스트(또는 실제 Date 셀)를 파일 날짜의 연도 기준 ISO로 변환.
// 파일 월과 6개월 이상 차이나면 해/연도 경계를 넘은 것으로 보고 보정한다.
function parseMD(val, fileYear, fileMonth) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getUTCFullYear()}-${pad2(val.getUTCMonth() + 1)}-${pad2(val.getUTCDate())}`;
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]), day = Number(m[2]);
  let year = fileYear;
  if (fileMonth - month > 6) year += 1;
  else if (month - fileMonth > 6) year -= 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// "BLOCK" 헤더 셀을 찾아 그 오른쪽의 하위 헤더(m²/착수/작업 or FINAL/검사/완료일)
// 열 위치를 파악한다. 헤더가 여러 구역(1공장/2공장/YARD 등)에 반복해서 나온다.
function findHeaderGroups(rows) {
  const groups = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] ?? '').trim() !== 'BLOCK') continue;
      const sub = {};
      for (let cc = c + 1; cc < row.length && cc < c + 8; cc++) {
        const v = String(row[cc] ?? '').trim();
        if (/^(m2|㎡|m²)$/i.test(v)) sub.area = cc;
        else if (v === '착수') sub.start = cc;
        else if (v === '작업' || v === 'FINAL') sub.stage = cc;
        else if (v === '검사') sub.inspect = cc;
        else if (v === '완료일') sub.end = cc;
      }
      groups.push({ headerRow: r, blockCol: c, labelCol: c - 1, sub });
    }
  }
  return groups;
}

// 워크북(첫 시트) 하나를 파싱해 그 날짜의 관측치 목록을 반환한다.
export function parseDailyStatusWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  const fileDate = extractFileDate(rows);
  if (!fileDate) {
    return { sheetName, date: null, observations: [], unmatchedLabels: [], error: '제목에서 날짜를 찾지 못했습니다 (예: "26. 8월 21일" 형식 기대).' };
  }

  const groups = findHeaderGroups(rows);
  const observations = [];
  const unmatchedLabels = new Set();

  // 여러 구역(1공장/2공장/YARD 등)의 "BLOCK" 헤더가 같은 행에 나란히 있을 수 있으므로,
  // 각 그룹의 끝은 "그 다음으로 더 아래 행에서 시작하는" 헤더까지로 잡는다(같은 행의
  // 옆 그룹은 끝 경계에서 제외).
  groups.forEach((g) => {
    const laterRows = groups.map(x => x.headerRow).filter(hr => hr > g.headerRow);
    const endRow = laterRows.length > 0 ? Math.min(...laterRows) : rows.length;
    let lastLabel = '';
    for (let r = g.headerRow + 1; r < endRow; r++) {
      const row = rows[r] || [];
      const labelParts = [row[g.labelCol - 1], row[g.labelCol]]
        .filter(v => v != null && String(v).trim() !== '')
        .map(v => String(v).trim());
      if (labelParts.length > 0) lastLabel = labelParts.join(' ');

      const blockRaw = String(row[g.blockCol] ?? '').trim();
      if (!blockRaw) continue;

      const m = blockRaw.match(/^(\S+)\s*\(([^)]+)\)\s*(.*)$/);
      const hull = m ? m[1] : '';
      const blockNo = m ? m[2] : blockRaw;
      const company = m ? m[3].trim() : '';

      const cellId = resolveCellId(lastLabel);
      if (!cellId) {
        unmatchedLabels.add(lastLabel || '(라벨 없음)');
        continue;
      }

      const areaRaw = g.sub.area != null ? row[g.sub.area] : '';
      const area = Number(String(areaRaw).replace(/,/g, '')) || null;
      const startISO = g.sub.start != null ? parseMD(row[g.sub.start], fileDate.year, fileDate.month) : null;
      const endISO = g.sub.end != null ? parseMD(row[g.sub.end], fileDate.year, fileDate.month) : null;

      observations.push({ cellId, hull, blockNo, company, area, startISO, endISO, label: lastLabel });
    }
  });

  return { sheetName, date: fileDate.iso, observations, unmatchedLabels: [...unmatchedLabels] };
}

// 여러 날짜의 관측치를 시간순으로 합쳐, 같은 블록이 같은 셀에 머문 연속 구간을
// 하나의 공정(route leg)으로 묶는다.
export function aggregateDailySnapshots(snapshots) {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const cellById = Object.fromEntries(ALL_CELLS.map(c => [c.id, c]));
  const byBlock = new Map();

  for (const snap of sorted) {
    for (const o of snap.observations) {
      const key = `${o.hull}|${o.blockNo}`;
      if (!byBlock.has(key)) byBlock.set(key, { hull: o.hull, blockNo: o.blockNo, company: o.company, area: o.area, obs: [] });
      const rec = byBlock.get(key);
      if (o.area) rec.area = o.area;
      if (o.company) rec.company = o.company;
      rec.obs.push({ date: snap.date, cellId: o.cellId, startISO: o.startISO, endISO: o.endISO });
    }
  }

  const blocks = [];
  for (const [key, rec] of byBlock) {
    const legs = [];
    let cur = null;
    for (const o of rec.obs) {
      if (!cur || cur.cellId !== o.cellId) {
        if (cur) legs.push(cur);
        cur = { cellId: o.cellId, stage: cellById[o.cellId]?.type || 'yard', start: o.startISO || o.date, end: o.endISO || o.date };
      } else {
        cur.end = o.endISO || o.date;
        if (o.startISO && o.startISO < cur.start) cur.start = o.startISO;
      }
    }
    if (cur) legs.push(cur);
    if (legs.length === 0) continue;

    const side = Math.round(Math.sqrt(Math.max(rec.area || 0, 1)) * 10) / 10;
    blocks.push({
      name: rec.blockNo || rec.hull || key,
      w: side, l: side,
      meta: { hull: rec.hull, block: rec.blockNo, company: rec.company, area: rec.area, approxSquare: true, source: '일일작업현황' },
      route: legs,
    });
  }
  return blocks;
}

// 사용자가 고른 여러 .xlsx 파일을 읽어 파싱 + 이력 재구성까지 한번에 수행.
export async function importDailyStatusFiles(files) {
  const perFile = [];
  for (const file of files) {
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsed = parseDailyStatusWorkbook(workbook);
      perFile.push({ fileName: file.name, ...parsed });
    } catch (err) {
      perFile.push({ fileName: file.name, date: null, observations: [], unmatchedLabels: [], error: err.message });
    }
  }

  const valid = perFile.filter(p => p.date && p.observations.length > 0);
  const blocks = aggregateDailySnapshots(valid.map(p => ({ date: p.date, observations: p.observations })));
  const unmatchedLabels = [...new Set(perFile.flatMap(p => p.unmatchedLabels || []))];

  return {
    blocks,
    perFile,
    unmatchedLabels,
    fileCount: files.length,
    usedFileCount: valid.length,
  };
}
