// 일정표 탭: 셀별 타임라인(간트) — 블록의 블라스팅→도장 흐름과 기간별 만적 여부를 확인
import { YARD, ALL_CELLS } from './data.js';
import { Store, activeLegOnDate, dateRange } from './store.js';

function fmtDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function renderSchedule(container, startDate, days, today) {
  container.innerHTML = '';
  const dates = dateRange(startDate, days);
  const blocks = Store.getBlocks();

  const table = document.createElement('table');
  table.className = 'gantt';

  // 헤더
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).textContent = '셀';
  for (const d of dates) {
    const th = document.createElement('th');
    th.textContent = fmtDay(d);
    if (d === today) th.classList.add('today-col');
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow === 0 || dow === 6) th.classList.add('weekend-col');
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const factory of YARD.factories) {
    const groupRow = document.createElement('tr');
    groupRow.className = 'factory-group-row';
    const th = document.createElement('th');
    th.colSpan = dates.length + 1;
    th.textContent = factory.name;
    groupRow.appendChild(th);
    tbody.appendChild(groupRow);

    for (const cell of factory.cells) {
      const row = document.createElement('tr');
      const rowHead = document.createElement('th');
      rowHead.className = 'row-head';
      rowHead.innerHTML = `${cell.name}<span class="cap-hint">cap ${cell.capacity}</span>`;
      row.appendChild(rowHead);

      for (const d of dates) {
        const td = document.createElement('td');
        const occupants = [];
        for (const b of blocks) {
          const leg = activeLegOnDate(b, d);
          if (leg && leg.cellId === cell.id) occupants.push({ b, leg });
        }
        if (d === today) td.classList.add('today-col');
        const dow = new Date(d + 'T00:00:00').getDay();
        if (dow === 0 || dow === 6) td.classList.add('weekend-col');

        if (occupants.length > 0) {
          td.classList.add('occupied');
          if (occupants.length > cell.capacity) td.classList.add('overflow');
          const strip = document.createElement('div');
          strip.className = 'day-strip';
          for (const { b, leg } of occupants) {
            const chip = document.createElement('span');
            chip.className = 'gantt-chip';
            chip.style.background = b.color;
            chip.textContent = b.name;
            chip.title = `${b.name} · ${leg.stage === 'blast' ? '블라스팅' : '도장'} (${leg.start} ~ ${leg.end})`;
            strip.appendChild(chip);
          }
          td.appendChild(strip);
        }
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
  }

  table.appendChild(tbody);
  container.appendChild(table);
}
