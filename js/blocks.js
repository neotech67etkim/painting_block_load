// 블록관리 탭: 블록 목록 + 추가/수정/삭제 (블록별 공정 일정 route 편집)
import { ALL_CELLS, STAGE_LABEL } from './data.js';
import { Store, activeLegOnDate } from './store.js';
import { importXlsxFile } from './importXlsx.js';
import { importDailyStatusFiles } from './importDailyStatus.js';

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

  const xlsxBar = document.createElement('div');
  xlsxBar.className = 'blocks-toolbar xlsx-bar';
  xlsxBar.innerHTML = `
    <label class="btn-primary" style="cursor:pointer">실적 엑셀 가져오기(.xlsx)
      <input id="xlsx-input" type="file" accept=".xlsx,.xls" style="display:none">
    </label>
    <label class="xlsx-mode"><input type="radio" name="xlsx-mode" value="replace" checked> 기존 블록 교체</label>
    <label class="xlsx-mode"><input type="radio" name="xlsx-mode" value="append"> 기존 블록에 추가</label>
    <span class="muted">엑셀 형식: A호선·B블록·C~F SIZE(소지면적,L,B,H)·G~H계획(착수,완료)·I~J실적(착수,완료)·K비고. 도장 착수 전 2일(입고1일+작업1일)을 블라스팅 기간으로 자동 생성하고, 셀은 용량 기준 자동 배정합니다.</span>
  `;
  container.appendChild(xlsxBar);

  const xlsxStatus = document.createElement('div');
  xlsxStatus.id = 'xlsx-status';
  xlsxStatus.className = 'xlsx-status';
  container.appendChild(xlsxStatus);

  const dailyBar = document.createElement('div');
  dailyBar.className = 'blocks-toolbar xlsx-bar';
  dailyBar.innerHTML = `
    <label class="btn-primary" style="cursor:pointer">일일작업현황 여러 개 가져오기(.xlsx)
      <input id="daily-input" type="file" accept=".xlsx,.xls" multiple style="display:none">
    </label>
    <label class="xlsx-mode"><input type="radio" name="daily-mode" value="replace" checked> 기존 블록 교체</label>
    <label class="xlsx-mode"><input type="radio" name="daily-mode" value="append"> 기존 블록에 추가</label>
    <span class="muted">"도장작업계획 (YY. M월 D일)" 형식의 일일현황 파일들을 날짜순으로 모아 셀 점유 이력을 재구성합니다.
      작업 단계(1ST/2ND/FINAL 등)는 구분하지 않고 "그 셀에 있으면 점유 중"으로 단순화합니다.
      크기(W×L)는 파일에 면적(m²)만 있어 정사각형으로 근사합니다.</span>
  `;
  container.appendChild(dailyBar);

  const dailyStatus = document.createElement('div');
  dailyStatus.id = 'daily-status';
  dailyStatus.className = 'xlsx-status';
  container.appendChild(dailyStatus);

  const formHost = document.createElement('div');
  formHost.className = 'form-host';
  container.appendChild(formHost);

  const table = document.createElement('table');
  table.className = 'block-table';
  const hasMeta = Store.getBlocks().some(b => b.meta);
  table.innerHTML = `
    <thead><tr>
      <th></th><th>블록명</th><th>크기(W×L)</th><th>오늘 상태</th><th>공정 일정</th>${hasMeta ? '<th>비고</th>' : ''}<th></th>
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

    const metaCell = block.meta
      ? `<td class="muted">${block.meta.usedActual ? '실적' : '계획'}${block.meta.note ? ' · ' + block.meta.note : ''}</td>`
      : (hasMeta ? '<td></td>' : '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="dot" style="background:${block.color}"></span></td>
      <td><b>${block.name}</b></td>
      <td>${block.size.w} × ${block.size.l} m</td>
      <td>${statusText}</td>
      <td class="route-cell">${block.route.map(r => `<div class="route-leg">${STAGE_LABEL[r.stage]} · ${r.cellId} <span class="muted">(${r.start}~${r.end})</span></div>`).join('') || '<span class="muted">일정 없음</span>'}</td>
      ${metaCell}
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

  xlsxBar.querySelector('#xlsx-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mode = xlsxBar.querySelector('input[name="xlsx-mode"]:checked').value;
    xlsxStatus.textContent = `'${file.name}' 읽는 중...`;
    try {
      const { blocks: parsed, skipped, sheetName, overflowLegCount, total } = await importXlsxFile(file);
      if (parsed.length === 0) {
        xlsxStatus.innerHTML = `<span class="xlsx-warn">'${sheetName}' 시트에서 유효한 블록을 찾지 못했습니다. 서식(2행 헤더, A~K열)을 확인해주세요.</span>`;
      } else {
        Store.loadBlocksBulk(parsed, { replace: mode === 'replace' });
        // Store 변경 시 renderBlocks가 통째로 다시 그려져 위 xlsxStatus 참조는 이미
        // 옛 DOM 노드가 되므로, 같은 id로 새로 그려진 요소를 다시 찾아서 메시지를 넣는다.
        const liveStatus = document.getElementById('xlsx-status');
        if (liveStatus) liveStatus.innerHTML = `<span class="xlsx-ok">'${sheetName}' 시트에서 ${total}건 중 ${parsed.length}건 배치 완료</span>` +
          (overflowLegCount > 0 ? ` <span class="xlsx-warn">(${overflowLegCount}건 공정 구간은 셀 정원을 초과해 배정됨 — 배치도/일정표에서 빨간색으로 표시됩니다)</span>` : '') +
          (skipped.length > 0 ? ` <span class="muted">· 제외 ${skipped.length}건(날짜 정보 없음)</span>` : '');
      }
    } catch (err) {
      xlsxStatus.innerHTML = `<span class="xlsx-warn">엑셀을 읽지 못했습니다: ${err.message}</span>`;
    }
    e.target.value = '';
  });

  dailyBar.querySelector('#daily-input').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (files.length === 0) return;
    const mode = dailyBar.querySelector('input[name="daily-mode"]:checked').value;
    dailyStatus.textContent = `파일 ${files.length}개 읽는 중...`;
    try {
      const { blocks: parsed, perFile, unmatchedLabels, fileCount, usedFileCount } = await importDailyStatusFiles(files);
      const fileLines = perFile.map(p => {
        if (p.error) return `<div class="muted">· ${p.fileName}: <span class="xlsx-warn">${p.error}</span></div>`;
        return `<div class="muted">· ${p.fileName} (${p.date}): ${p.observations.length}건 인식</div>`;
      }).join('');
      if (parsed.length === 0) {
        dailyStatus.innerHTML = `<span class="xlsx-warn">유효한 블록을 찾지 못했습니다.</span>${fileLines}`;
      } else {
        Store.loadBlocksBulk(parsed, { replace: mode === 'replace' });
        // xlsx-status와 같은 이유로, Store 변경으로 다시 그려진 뒤 같은 id 요소를 재조회.
        const liveStatus = document.getElementById('daily-status');
        if (liveStatus) liveStatus.innerHTML = `<span class="xlsx-ok">파일 ${usedFileCount}/${fileCount}개에서 블록 ${parsed.length}개 재구성 완료</span>` +
          (unmatchedLabels.length > 0 ? ` <span class="xlsx-warn">· 못 알아본 셀 라벨: ${unmatchedLabels.join(', ')}</span>` : '') +
          fileLines;
      }
    } catch (err) {
      dailyStatus.innerHTML = `<span class="xlsx-warn">가져오지 못했습니다: ${err.message}</span>`;
    }
    e.target.value = '';
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
