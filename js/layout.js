// 배치도 탭: 야드 SVG 맵 (실척, viewBox 단위 = m) + 셀별 점유 현황 + 상세 패널
import { YARD, ALL_CELLS, YARD_BOUNDS, getCell } from './data.js';
import { cellOccupancy, cellUtilization } from './store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.appendChild(c);
  return e;
}

function utilClass(ratio) {
  if (ratio >= 1) return 'util-full';
  if (ratio >= 0.7) return 'util-high';
  if (ratio > 0) return 'util-mid';
  return 'util-empty';
}

let selectedCellId = null;
let onSelectCell = () => {};

export function setOnSelectCell(fn) { onSelectCell = fn; }
export function getSelectedCellId() { return selectedCellId; }

export function renderLayout(container, date) {
  container.innerHTML = '';

  const b = YARD_BOUNDS;
  const svg = el('svg', {
    viewBox: `${b.minX} ${b.minY} ${b.maxX - b.minX} ${b.maxY - b.minY}`,
    class: 'yard-svg',
    'font-family': 'inherit',
  });

  // 랜드마크 (참고용)
  for (const lm of YARD.landmarks) {
    const g = el('g', { class: 'landmark' });
    g.appendChild(el('rect', { x: lm.x, y: lm.y, width: lm.w, height: lm.h, rx: 1.5 }));
    const lines = lm.name.split('\n');
    lines.forEach((line, i) => {
      g.appendChild(el('text', {
        x: lm.x + lm.w / 2, y: lm.y + lm.h / 2 + (i - (lines.length - 1) / 2) * 4.2,
        'text-anchor': 'middle', class: 'landmark-label',
      }, [document.createTextNode(line)]));
    });
    svg.appendChild(g);
  }

  // 공장 외곽선
  for (const factory of YARD.factories) {
    svg.appendChild(el('rect', {
      x: factory.x, y: factory.y, width: factory.w, height: factory.h,
      class: 'factory-outline',
    }));
    svg.appendChild(el('text', {
      x: factory.x + 2, y: factory.y - 2, class: 'factory-label',
    }, [document.createTextNode(factory.name)]));
  }

  // 셀 렌더링
  for (const cell of ALL_CELLS) {
    const util = cellUtilization(cell.id, date);
    const g = el('g', { class: `cell cell-${cell.type} ${utilClass(util.ratio)}` + (cell.id === selectedCellId ? ' cell-selected' : ''), 'data-cell-id': cell.id });

    g.appendChild(el('rect', { x: cell.x, y: cell.y, width: cell.w, height: cell.h, class: 'cell-rect' }));

    // 셀 내부 슬롯 격자 + 점유 블록 칩
    // 정원(capacity)을 초과해 배치된 블록도 빈 슬롯을 늘려서 모두 표시한다.
    const occ = cellOccupancy(cell.id, date);
    const cap = Math.max(cell.capacity, 1, occ.length);
    const cols = Math.ceil(Math.sqrt(cap));
    const rows = Math.ceil(cap / cols);
    const pad = Math.min(cell.w, cell.h) * 0.06;
    const slotW = (cell.w - pad * 2) / cols;
    const slotH = (cell.h - pad * 2) / rows;

    for (let i = 0; i < cap; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const sx = cell.x + pad + col * slotW;
      const sy = cell.y + pad + row * slotH;
      const occupant = occ[i];
      if (occupant) {
        const shrink = 0.08;
        const isOverflow = i >= cell.capacity;
        g.appendChild(el('rect', {
          x: sx + slotW * shrink, y: sy + slotH * shrink,
          width: slotW * (1 - shrink * 2), height: slotH * (1 - shrink * 2),
          fill: occupant.block.color, class: 'block-chip' + (isOverflow ? ' block-chip-overflow' : ''), rx: 1,
        }));
        const fontSize = Math.max(2.6, Math.min(slotW, slotH) * 0.32);
        const chipW = slotW * (1 - shrink * 2);
        const maxChars = Math.max(1, Math.floor((chipW * 0.92) / (fontSize * 0.58)));
        const fullName = occupant.block.name;
        const label = fullName.length > maxChars
          ? (maxChars <= 1 ? fullName.slice(0, 1) : fullName.slice(0, maxChars - 1) + '…')
          : fullName;
        const textEl = el('text', {
          x: sx + slotW / 2, y: sy + slotH / 2 + fontSize * 0.35,
          'text-anchor': 'middle', 'font-size': fontSize, class: 'block-chip-label',
        }, [document.createTextNode(label)]);
        if (label !== fullName) textEl.appendChild(el('title', {}, [document.createTextNode(fullName)]));
        g.appendChild(textEl);
      } else {
        g.appendChild(el('rect', {
          x: sx + slotW * 0.08, y: sy + slotH * 0.08,
          width: slotW * 0.84, height: slotH * 0.84,
          class: 'slot-empty', rx: 1,
        }));
      }
    }

    // 셀 라벨 + 점유율 배지
    const labelSize = Math.max(2.6, Math.min(cell.w, cell.h) * 0.09);
    g.appendChild(el('text', {
      x: cell.x + 1.5, y: cell.y + labelSize + 1,
      'font-size': labelSize, class: 'cell-label',
    }, [document.createTextNode(cell.name)]));
    g.appendChild(el('text', {
      x: cell.x + cell.w - 1.5, y: cell.y + labelSize + 1,
      'text-anchor': 'end', 'font-size': labelSize, class: 'cell-badge',
    }, [document.createTextNode(`${util.occupied}/${util.capacity}`)]));

    g.style.cursor = 'pointer';
    g.addEventListener('click', () => {
      selectedCellId = cell.id;
      onSelectCell(cell.id);
      renderLayout(container, date); // re-render to update selection highlight
    });

    svg.appendChild(g);
  }

  container.appendChild(svg);
}

export function renderCellDetail(container, cellId, date) {
  container.innerHTML = '';
  if (!cellId) {
    container.innerHTML = '<p class="muted">배치도에서 셀을 클릭하면 상세 정보가 표시됩니다.</p>';
    return;
  }
  const cell = getCell(cellId);
  if (!cell) return;
  const util = cellUtilization(cellId, date);
  const occ = cellOccupancy(cellId, date);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3>${cell.factoryName} · ${cell.name}</h3>
    <table class="kv">
      <tr><th>구분</th><td>${cell.type === 'blast' ? '블라스팅셀' : '도장셀'}</td></tr>
      <tr><th>규격 (W×L×H)</th><td>${cell.w}m × ${cell.h}m × ${cell.hh}m</td></tr>
      <tr><th>면적</th><td>${cell.area.toLocaleString()} ㎡</td></tr>
      <tr><th>적치 가능 블록수</th><td>${cell.capacity} 개</td></tr>
      <tr><th>${date} 점유율</th><td class="${utilClass(util.ratio)}-text">${util.occupied} / ${util.capacity} ${util.ratio >= 1 ? '(만적)' : ''}</td></tr>
    </table>
    <h4>현재 점유 블록</h4>
  `;
  if (occ.length === 0) {
    wrap.innerHTML += '<p class="muted">해당 날짜에 점유된 블록이 없습니다.</p>';
  } else {
    const ul = document.createElement('ul');
    ul.className = 'occ-list';
    for (const { block, leg } of occ) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot" style="background:${block.color}"></span>
        <b>${block.name}</b> (${block.size.w}×${block.size.l}m) — ${leg.stage === 'blast' ? '블라스팅' : '도장'} 중
        <span class="muted">(${leg.start} ~ ${leg.end})</span>`;
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
  }
  container.appendChild(wrap);
}
