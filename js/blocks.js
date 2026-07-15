// 블록관리 탭: 블록 목록 + 추가/수정/삭제 (블록별 공정 일정 route 편집)
import { ALL_CELLS, STAGE_LABEL } from './data.js';
import { Store, activeLegOnDate } from './store.js';

let editingId = null; // null = 새 블록 추가 폼 닫힘, 'new' = 새 블록, id = 해당 블록 수정

function cellOptions(selectedCellId, stage) {
  const cells = stage ? ALL_CELLS.filter(c => c.type === stage) : ALL_CELLS;
  return cells.map(c => `<option value="${c.id}" ${c.id === selectedCellId ? 'selected' : ''}>${c.factoryName} ${c.name}</option>`).join('');
}

function legRowHTML(leg, idx) {
  const stage = leg?.stage || 'blast';
  return `
    <div class="leg-row" data-idx="${idx}">
      <select class="leg-stage">
        <option value="blast" ${stage === 'blast' ? 'selected' : ''}>블라스팅</option>
        <option value="paint" ${stage === 'paint' ? 'selected' : ''}>도장</option>
      </select>
      <select class="leg-cell">${cellOptions(leg?.cellId, stage)}</select>
      <input type="date" class="leg-start" value="${leg?.start || ''}">
      <span>~</span>
      <input type="date" class="leg-end" value="${leg?.end || ''}">
      <button type="button" class="leg-remove" title="이 공정 제거">✕</button>
    </div>`;
}

function bindLegRow(row) {
  const stageSel = row.querySelector('.leg-stage');
  const cellSel = row.querySelector('.leg-cell');
  stageSel.addEventListener('change', () => {
    cellSel.innerHTML = cellOptions(null, stageSel.value);
  });
  row.querySelector('.leg-remove').addEventListener('click', () => row.remove());
}

function readLegRows(formEl) {
  return [...formEl.querySelectorAll('.leg-row')].map(row => ({
    stage: row.querySelector('.leg-stage').value,
    cellId: row.querySelector('.leg-cell').value,
    start: row.querySelector('.leg-start').value,
    end: row.querySelector('.leg-end').value,
  })).filter(r => r.cellId && r.start && r.end);
}

function formHTML(block) {
  const legs = block?.route || [{ stage: 'blast', cellId: '', start: '', end: '' }];
  return `
    <form class="block-form" id="block-form">
      <div class="form-row">
        <label>블록명 <input required type="text" name="name" value="${block?.name || ''}" placeholder="예: 11A"></label>
        <label>가로 W(m) <input required type="number" min="1" step="0.1" name="w" value="${block?.size?.w || ''}"></label>
        <label>세로 L(m) <input required type="number" min="1" step="0.1" name="l" value="${block?.size?.l || ''}"></label>
      </div>
      <div class="legs-wrap">
        <h4>공정 일정 (블라스팅 → 도장 순서로 추가)</h4>
        <div id="legs">${legs.map((l, i) => legRowHTML(l, i)).join('')}</div>
        <button type="button" id="add-leg" class="btn-secondary">+ 공정 추가</button>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary">저장</button>
        <button type="button" id="cancel-edit" class="btn-secondary">취소</button>
      </div>
    </form>`;
}

export function renderBlocks(container, today) {
  container.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'blocks-toolbar';
  toolbar.innerHTML = `
    <button id="new-block-btn" class="btn-primary">+ 새 블록</button>
    <button id="export-btn" class="btn-secondary">내보내기(JSON)</button>
    <label class="btn-secondary" style="cursor:pointer">가져오기(JSON)<input id="import-input" type="file" accept="application/json" style="display:none"></label>
    <button id="reset-btn" class="btn-secondary">샘플 데이터로 초기화</button>
  `;
  container.appendChild(toolbar);

  const formHost = document.createElement('div');
  formHost.className = 'form-host';
  container.appendChild(formHost);

  const table = document.createElement('table');
  table.className = 'block-table';
  table.innerHTML = `
    <thead><tr>
      <th></th><th>블록명</th><th>크기(W×L)</th><th>오늘 상태</th><th>공정 일정</th><th></th>
    </tr></thead>
    <tbody></tbody>`;
  container.appendChild(table);
  const tbody = table.querySelector('tbody');

  for (const block of Store.getBlocks()) {
    const leg = activeLegOnDate(block, today);
    const statusText = leg
      ? `${STAGE_LABEL[leg.stage]} 중 (${leg.cellId})`
      : (block.route[0] && today < block.route[0].start ? '대기(입고 전)'
        : (block.route.length && today > block.route[block.route.length - 1].end ? '완료/출고' : '이동 중'));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="dot" style="background:${block.color}"></span></td>
      <td><b>${block.name}</b></td>
      <td>${block.size.w} × ${block.size.l} m</td>
      <td>${statusText}</td>
      <td class="route-cell">${block.route.map(r => `<div class="route-leg">${STAGE_LABEL[r.stage]} · ${r.cellId} <span class="muted">(${r.start}~${r.end})</span></div>`).join('') || '<span class="muted">일정 없음</span>'}</td>
      <td class="row-actions">
        <button class="btn-secondary edit-btn">수정</button>
        <button class="btn-danger delete-btn">삭제</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => openForm(formHost, block, today, container));
    tr.querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm(`'${block.name}' 블록을 삭제할까요?`)) Store.deleteBlock(block.id);
    });
    tbody.appendChild(tr);
  }

  toolbar.querySelector('#new-block-btn').addEventListener('click', () => openForm(formHost, null, today, container));
  toolbar.querySelector('#export-btn').addEventListener('click', () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blocks.json';
    a.click();
  });
  toolbar.querySelector('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      Store.importJSON(json);
    } catch (err) {
      alert('JSON 파일을 읽을 수 없습니다: ' + err.message);
    }
    e.target.value = '';
  });
  toolbar.querySelector('#reset-btn').addEventListener('click', () => {
    if (confirm('현재 블록 데이터를 샘플 데이터로 초기화할까요?')) Store.resetSeed();
  });
}

function openForm(formHost, block) {
  formHost.innerHTML = formHTML(block);
  formHost.querySelectorAll('.leg-row').forEach(bindLegRow);

  formHost.querySelector('#add-leg').addEventListener('click', () => {
    const legsDiv = formHost.querySelector('#legs');
    const idx = legsDiv.children.length;
    legsDiv.insertAdjacentHTML('beforeend', legRowHTML(null, idx));
    bindLegRow(legsDiv.lastElementChild);
  });

  formHost.querySelector('#cancel-edit').addEventListener('click', () => {
    formHost.innerHTML = '';
  });

  formHost.querySelector('#block-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const route = readLegRows(e.target);
    if (route.length === 0) {
      alert('최소 1개 이상의 공정 일정을 입력하세요.');
      return;
    }
    const payload = { name: fd.get('name'), w: fd.get('w'), l: fd.get('l'), route };
    if (block) Store.updateBlock(block.id, payload);
    else Store.addBlock(payload);
    formHost.innerHTML = '';
  });
}
