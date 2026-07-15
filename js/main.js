import { ALL_CELLS, YARD } from './data.js';
import { Store, cellUtilization } from './store.js';
import { renderLayout, renderCellDetail, setOnSelectCell, getSelectedCellId } from './layout.js';
import { renderSchedule } from './schedule.js';
import { renderBlocks } from './blocks.js';

const TODAY_DEFAULT = '2026-07-15';

const state = {
  date: TODAY_DEFAULT,
  tab: 'layout',
  scheduleStart: '2026-07-08',
  scheduleDays: 21,
};

const els = {
  tabs: document.querySelectorAll('.tab-btn'),
  panels: {
    layout: document.getElementById('panel-layout'),
    schedule: document.getElementById('panel-schedule'),
    blocks: document.getElementById('panel-blocks'),
  },
  dateInput: document.getElementById('date-input'),
  dashboard: document.getElementById('dashboard'),
  layoutSvgHost: document.getElementById('layout-svg-host'),
  cellDetailHost: document.getElementById('cell-detail-host'),
  scheduleHost: document.getElementById('schedule-host'),
  scheduleStart: document.getElementById('schedule-start'),
  scheduleDays: document.getElementById('schedule-days'),
  blocksHost: document.getElementById('blocks-host'),
};

function renderDashboard() {
  const byFactory = YARD.factories.map(f => {
    const cells = f.cells;
    const totals = cells.reduce((acc, c) => {
      const u = cellUtilization(c.id, state.date);
      acc.occupied += u.occupied;
      acc.capacity += u.capacity;
      return acc;
    }, { occupied: 0, capacity: 0 });
    return { name: f.name, ...totals };
  });
  const grand = byFactory.reduce((acc, f) => ({ occupied: acc.occupied + f.occupied, capacity: acc.capacity + f.capacity }), { occupied: 0, capacity: 0 });

  els.dashboard.innerHTML = `
    <div class="dash-card dash-total">
      <div class="dash-label">전체 야드 (${state.date} 기준)</div>
      <div class="dash-value">${grand.occupied} / ${grand.capacity} <span class="dash-pct">${grand.capacity ? Math.round(grand.occupied / grand.capacity * 100) : 0}%</span></div>
      <div class="bar"><div class="bar-fill" style="width:${grand.capacity ? Math.min(100, grand.occupied / grand.capacity * 100) : 0}%"></div></div>
    </div>
    ${byFactory.map(f => `
      <div class="dash-card">
        <div class="dash-label">${f.name}</div>
        <div class="dash-value">${f.occupied} / ${f.capacity} <span class="dash-pct">${f.capacity ? Math.round(f.occupied / f.capacity * 100) : 0}%</span></div>
        <div class="bar"><div class="bar-fill ${f.occupied > f.capacity ? 'bar-over' : ''}" style="width:${f.capacity ? Math.min(100, f.occupied / f.capacity * 100) : 0}%"></div></div>
      </div>
    `).join('')}
  `;
}

function renderAll() {
  renderDashboard();
  if (state.tab === 'layout') {
    renderLayout(els.layoutSvgHost, state.date);
    renderCellDetail(els.cellDetailHost, getSelectedCellId(), state.date);
  } else if (state.tab === 'schedule') {
    renderSchedule(els.scheduleHost, state.scheduleStart, state.scheduleDays, state.date);
  } else if (state.tab === 'blocks') {
    renderBlocks(els.blocksHost, state.date);
  }
}

function switchTab(tab) {
  state.tab = tab;
  els.tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  Object.entries(els.panels).forEach(([name, panel]) => panel.classList.toggle('active', name === tab));
  renderAll();
}

function init() {
  els.dateInput.value = state.date;
  els.scheduleStart.value = state.scheduleStart;
  els.scheduleDays.value = state.scheduleDays;

  els.tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  els.dateInput.addEventListener('change', () => {
    state.date = els.dateInput.value || TODAY_DEFAULT;
    renderAll();
  });

  els.scheduleStart.addEventListener('change', () => {
    state.scheduleStart = els.scheduleStart.value;
    renderAll();
  });
  els.scheduleDays.addEventListener('change', () => {
    state.scheduleDays = Number(els.scheduleDays.value) || 21;
    renderAll();
  });

  setOnSelectCell((cellId) => {
    renderCellDetail(els.cellDetailHost, cellId, state.date);
  });

  Store.onChange(renderAll);

  switchTab('layout');
}

init();
