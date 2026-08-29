// 배치도 탭: 야드 SVG 맵 (실척, viewBox 단위 = m) + 셀별 점유 현황 + 상세 패널
import { YARD, ALL_CELLS, YARD_BOUNDS, getCell, usablePlacementSize, EQUIPMENT_CLEARANCE_M } from './data.js';
import { cellOccupancy, cellUtilization } from './store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.appendChild(c);
  return e;
}

const CELL_TYPE_LABEL = { blast: '블라스팅셀', paint: '도장셀', yard: '야적 구역' };

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

    // 셀 내부에 점유 블록을 실제 치수(w×l, m)로 축척에 맞춰 배치한다 (셸프 패킹).
    // 실제 물리적 배치 이력은 없으므로 배치 순서는 추정치이지만, 블록 크기와 셀 크기의
    // 비율만큼은 정확히 맞춰서 "정원 안에 실제로 들어가는지"를 눈으로 확인할 수 있게 한다.
    const occ = cellOccupancy(cell.id, date);
    const usableX = cell.x + EQUIPMENT_CLEARANCE_M;
    const usableY = cell.y + EQUIPMENT_CLEARANCE_M;
    const usableW = Math.max(0, cell.w - EQUIPMENT_CLEARANCE_M * 2);
    const usableH = Math.max(0, cell.h - EQUIPMENT_CLEARANCE_M * 2);

    g.appendChild(el('rect', {
      x: usableX, y: usableY, width: usableW, height: usableH, class: 'cell-usable-outline',
    }));

    // 셀 경계 밖으로 튀어나온 블록(용량 초과)도 잘려서 보이도록 클리핑한다.
    const clipId = `cell-clip-${cell.id}`;
    g.appendChild(el('defs', {}, [
      el('clipPath', { id: clipId }, [
        el('rect', { x: cell.x, y: cell.y, width: cell.w, height: cell.h }),
      ]),
    ]));
    const blocksGroup = el('g', { 'clip-path': `url(#${clipId})` });

    const gap = Math.min(cell.w, cell.h) * 0.03;
    let cursorX = usableX, cursorY = usableY, rowH = 0;
    occ.forEach((occupant, i) => {
      const bw = occupant.block.size.w;
      const bl = occupant.block.size.l;
      if (cursorX > usableX && cursorX + bw > usableX + usableW) {
        cursorX = usableX;
        cursorY += rowH + gap;
        rowH = 0;
      }
      const isOverflow = i >= cell.capacity || (cursorX + bw) > (usableX + usableW) || (cursorY + bl) > (usableY + usableH);
      blocksGroup.appendChild(el('rect', {
        x: cursorX, y: cursorY, width: bw, height: bl,
        fill: occupant.block.color, class: 'block-chip' + (isOverflow ? ' block-chip-overflow' : ''),
      }));
      const fontSize = Math.max(1.6, Math.min(bw, bl) * 0.28);
      const maxChars = Math.max(1, Math.floor((bw * 0.9) / (fontSize * 0.58)));
      const fullName = occupant.block.name;
      const label = fullName.length > maxChars
        ? (maxChars <= 1 ? fullName.slice(0, 1) : fullName.slice(0, maxChars - 1) + '…')
        : fullName;
      const textEl = el('text', {
        x: cursorX + bw / 2, y: cursorY + bl / 2 + fontSize * 0.35,
        'text-anchor': 'middle', 'font-size': fontSize, class: 'block-chip-label',
      }, [document.createTextNode(label)]);
      textEl.appendChild(el('title', {}, [document.createTextNode(`${fullName} (${bw}×${bl}m)`)]));
      blocksGroup.appendChild(textEl);

      cursorX += bw + gap;
      rowH = Math.max(rowH, bl);
    });
    g.appendChild(blocksGroup);

    // 셀 라벨 + 점유율 배지
    const labelSize = Math.max(2.6, Math.min(cell.w, cell.h) * 0.09);
    const labelText = cell.signage ? `${cell.name} (#${cell.signage})` : cell.name;
    g.appendChild(el('text', {
      x: cell.x + 1.5, y: cell.y + labelSize + 1,
      'font-size': labelSize, class: 'cell-label',
    }, [document.createTextNode(labelText)]));
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
  const usable = usablePlacementSize(cell);

  const isYard = cell.type === 'yard';
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h3>${cell.factoryName} · ${cell.name}${cell.signage ? ` <span class="muted">(#${cell.signage})</span>` : ''}</h3>
    <table class="kv">
      <tr><th>구분</th><td>${CELL_TYPE_LABEL[cell.type] || cell.type}</td></tr>
      ${isYard ? '<tr><th colspan="2" class="muted">공장 밖 야적/출고 대기 구역 (정식 규격 없음, 위치 참고용)</th></tr>' : `
      <tr><th>건축규격 (가로×세로×높이)</th><td>${cell.w}m × ${cell.h}m × ${cell.hh}m</td></tr>
      ${cell.netW ? `<tr><th>입고 사이즈(실사용)</th><td>${cell.netW}m × ${cell.netL}m</td></tr>` : ''}
      <tr><th>블록 배치 가능 크기</th><td>${usable.w.toFixed(1)}m × ${usable.l.toFixed(1)}m <span class="muted">(장비 여유 1.5m×사방 제외)</span></td></tr>
      <tr><th>면적</th><td>${cell.area.toLocaleString()} ㎡</td></tr>
      `}
      <tr><th>적치 가능 블록수</th><td>${cell.capacity} 개</td></tr>
      <tr><th>${date} 점유율</th><td class="${utilClass(util.ratio)}-text">${util.occupied} / ${util.capacity} ${util.ratio >= 1 ? '(만적)' : ''}</td></tr>
      ${cell.note ? `<tr><th>비고</th><td class="muted">${cell.note}</td></tr>` : ''}
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
