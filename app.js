const state = { data: null };
const contactUrl = 'https://vk.ru/club241020936';

const weeklySchedule = document.getElementById('weeklySchedule');
const groupsGrid = document.getElementById('groupsGrid');
const updatedText = document.getElementById('updatedText');
const notice = document.getElementById('notice');

const DAYS = [
  ['monday', 'Понедельник', 'Пн'],
  ['tuesday', 'Вторник', 'Вт'],
  ['wednesday', 'Среда', 'Ср'],
  ['thursday', 'Четверг', 'Чт'],
  ['friday', 'Пятница', 'Пт']
];

const statusMap = {
  empty: ['Не задано', 'week-empty'],
  free: ['Свободно', 'week-free'],
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

function updatedLabel(value) {
  if (!value) return 'Расписание готово к заполнению';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Расписание обновлено';
  return `Обновлено ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)}`;
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

function renderWeekCell(cell) {
  const safe = { ...emptyCell(), ...(cell || {}) };
  const [statusLabel, statusClass] = statusMap[safe.status] || statusMap.empty;
  const hasContent = safe.title || safe.details || safe.status !== 'empty';

  if (!hasContent) {
    return `<div class="week-cell week-empty"><span class="week-dash">—</span></div>`;
  }

  const freeLink = safe.status === 'free'
    ? `<a class="week-book" href="${contactUrl}" target="_blank" rel="noopener">Записаться</a>`
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
    const cells = DAYS.map(([key]) => `<td>${renderWeekCell(state.data.week[key][rowIndex])}</td>`).join('');
    const rowTime = state.data.times[rowIndex] || '—';
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

function renderGroups() {
  const groups = (state.data?.groups || []).filter(g => g.visible !== false && Number(g.seatsFree || 0) > 0);
  if (!groups.length) {
    groupsGrid.innerHTML = `<div class="empty"><strong>Набор в группы появится здесь</strong><span>Когда откроются места, они сразу отобразятся на этой странице.</span></div>`;
    return;
  }
  groupsGrid.innerHTML = groups.map(group => `
    <article class="card group-card">
      <h3>${esc(group.title || 'Мини‑группа')}</h3>
      <div class="big-number">${esc(group.seatsFree || 0)} ${Number(group.seatsFree) === 1 ? 'место' : 'места'}</div>
      ${group.days ? `<div class="group-row"><span>Дни</span><b>${esc(group.days)}</b></div>` : ''}
      ${group.time ? `<div class="group-row"><span>Время</span><b>${esc(group.time)}</b></div>` : ''}
      ${group.level ? `<div class="group-row"><span>Уровень</span><b>${esc(group.level)}</b></div>` : ''}
      ${group.audience ? `<div class="group-row"><span>Для кого</span><b>${esc(group.audience)}</b></div>` : ''}
      ${group.format ? `<div class="group-row"><span>Формат</span><b>${group.format === 'offline' ? 'Очно' : 'Онлайн'}</b></div>` : ''}
      ${group.note ? `<p class="slot-note">${esc(group.note)}</p>` : ''}
      <a class="card-action" href="${contactUrl}" target="_blank" rel="noopener">Узнать подробнее <span aria-hidden="true">→</span></a>
    </article>`).join('');
}

async function loadSchedule() {
  try {
    const response = await fetch(`data/schedule.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    normalizeWeek(state.data);
    updatedText.textContent = updatedLabel(state.data.meta?.updatedAt);
    if (state.data.meta?.notice) {
      notice.textContent = state.data.meta.notice;
      notice.classList.remove('hidden');
    } else {
      notice.classList.add('hidden');
    }
    renderWeeklySchedule();
    renderGroups();
  } catch (error) {
    console.error(error);
    updatedText.textContent = 'Не удалось загрузить расписание';
    weeklySchedule.innerHTML = `<div class="empty"><strong>Расписание временно недоступно</strong><span>Попробуйте обновить страницу чуть позже.</span></div>`;
    groupsGrid.innerHTML = '';
  }
}

loadSchedule();
