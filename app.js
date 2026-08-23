const state = { data: null };
const VK_GROUP_ID = '241020936';

const weeklySchedule = document.getElementById('weeklySchedule');

const DAYS = [
  ['monday', 'Понедельник', 'Пн'],
  ['tuesday', 'Вторник', 'Вт'],
  ['wednesday', 'Среда', 'Ср'],
  ['thursday', 'Четверг', 'Чт'],
  ['friday', 'Пятница', 'Пт']
];

const statusMap = {
  empty: ['Не задано', 'week-empty'],
  free: ['СВОБОДНО', 'week-free'],
  hold: ['Бронь', 'week-hold'],
  busy: ['Занято', 'week-busy']
};

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emptyCell() {
  return { status: 'empty', title: '', details: '' };
}

function normalizeWeek(data) {
  data.week ||= {};
  data.times = Array.isArray(data.times) ? data.times.slice(0, 10) : [];
  while (data.times.length < 10) data.times.push('');

  DAYS.forEach(([key]) => {
    const source = Array.isArray(data.week[key]) ? data.week[key] : [];
    data.week[key] = Array.from({ length: 10 }, (_, index) => ({
      ...emptyCell(),
      ...(source[index] || {})
    }));
  });
}

function bookingUrl(dayName, time, title) {
  const parts = [`Здравствуйте! Хочу записаться на ${dayName.toLowerCase()} ${time || ''}`.trim()];
  if (title) parts[0] += `, ${title}`;
  parts[0] += '.';
  const text = encodeURIComponent(parts.join(' '));
  return `https://vk.ru/write-${VK_GROUP_ID}?text=${text}`;
}

function renderWeekCell(cell, dayName, time) {
  const safe = { ...emptyCell(), ...(cell || {}) };
  const [statusLabel, statusClass] = statusMap[safe.status] || statusMap.empty;
  const hasContent = safe.title || safe.details || safe.status !== 'empty';

  if (!hasContent) {
    return `<div class="week-cell week-empty"><span class="week-dash">—</span></div>`;
  }

  const freeLink = safe.status === 'free'
    ? `<a class="week-book" href="${bookingUrl(dayName, time, safe.title)}" target="_blank" rel="noopener">Записаться <span aria-hidden="true">→</span></a>`
    : '';

  return `
    <div class="week-cell ${statusClass}">
      <div class="week-cell-top">
        <span class="week-status">${statusLabel}</span>
      </div>
      ${safe.title ? `<div class="week-title">${esc(safe.title)}</div>` : ''}
      ${safe.details ? `<div class="week-details">${esc(safe.details)}</div>` : ''}
      ${freeLink}
    </div>`;
}

function renderWeeklySchedule() {
  if (!state.data) return;
  normalizeWeek(state.data);

  const header = DAYS.map(([, full, short]) => `
    <th scope="col"><span class="day-full">${full}</span><span class="day-short">${short}</span></th>`).join('');

  const rows = Array.from({ length: 10 }, (_, rowIndex) => {
    const rowTime = state.data.times[rowIndex] || '—';
    const cells = DAYS.map(([key, full]) => `<td>${renderWeekCell(state.data.week[key][rowIndex], full, rowTime === '—' ? '' : rowTime)}</td>`).join('');
    return `<tr><th scope="row" class="lesson-number"><span>${esc(rowTime)}</span></th>${cells}</tr>`;
  }).join('');

  weeklySchedule.innerHTML = `
    <table class="weekly-table">
      <thead>
        <tr>
          <th class="lesson-corner" scope="col">Время</th>
          ${header}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function loadSchedule() {
  try {
    const response = await fetch(`data/schedule.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    normalizeWeek(state.data);
    renderWeeklySchedule();
  } catch (error) {
    console.error(error);
    weeklySchedule.innerHTML = `<div class="empty"><strong>Расписание временно недоступно</strong><span>Попробуйте обновить страницу чуть позже.</span></div>`;
  }
}

loadSchedule();
