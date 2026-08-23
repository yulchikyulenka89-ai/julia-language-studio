const state = { data: null, filter: 'all' };

const slotsGrid = document.getElementById('slotsGrid');
const groupsGrid = document.getElementById('groupsGrid');
const updatedText = document.getElementById('updatedText');
const notice = document.getElementById('notice');

const statusMap = {
  free: ['Свободно', 'status-free'],
  hold: ['Бронь', 'status-hold'],
  busy: ['Занято', 'status-busy']
};

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }).format(date);
}

function updatedLabel(value) {
  if (!value) return 'Расписание готово к заполнению';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Расписание обновлено';
  return `Обновлено ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

function slotMatches(slot) {
  if (state.filter === 'all') return true;
  if (state.filter === 'individual' || state.filter === 'group') return slot.type === state.filter;
  if (state.filter === 'online' || state.filter === 'offline') return slot.format === state.filter;
  return true;
}

function renderSlots() {
  const slots = (state.data?.slots || [])
    .filter(s => s.visible !== false)
    .filter(s => s.status !== 'busy')
    .filter(slotMatches)
    .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));

  if (!slots.length) {
    slotsGrid.innerHTML = `<div class="empty"><strong>Свободных окон пока нет</strong><span>Можно написать преподавателю — иногда появляются новые места.</span></div>`;
    return;
  }

  slotsGrid.innerHTML = slots.map(slot => {
    const [statusLabel, statusClass] = statusMap[slot.status] || statusMap.free;
    const typeLabel = slot.type === 'group' ? 'Мини‑группа' : 'Индивидуально';
    const formatLabel = slot.format === 'offline' ? 'Очно' : 'Онлайн';
    const seats = slot.type === 'group' && Number.isFinite(Number(slot.seatsFree))
      ? `<span class="chip">Мест: ${esc(slot.seatsFree)}${slot.seatsTotal ? ` из ${esc(slot.seatsTotal)}` : ''}</span>` : '';
    return `
      <article class="card slot-card">
        <div class="slot-top">
          <div>
            <div class="slot-date">${esc(formatDate(slot.date))}</div>
            <div class="slot-time">${esc(slot.time || '—')}</div>
          </div>
          <span class="status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="slot-meta">
          <span class="chip">${typeLabel}</span>
          <span class="chip">${formatLabel}</span>
          ${slot.level ? `<span class="chip">${esc(slot.level)}</span>` : ''}
          ${slot.audience ? `<span class="chip">${esc(slot.audience)}</span>` : ''}
          ${slot.duration ? `<span class="chip">${esc(slot.duration)} мин</span>` : ''}
          ${seats}
        </div>
        ${slot.note ? `<p class="slot-note">${esc(slot.note)}</p>` : ''}
      </article>`;
  }).join('');
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
    </article>`).join('');
}

async function loadSchedule() {
  try {
    const response = await fetch(`data/schedule.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    updatedText.textContent = updatedLabel(state.data.meta?.updatedAt);
    if (state.data.meta?.notice) {
      notice.textContent = state.data.meta.notice;
      notice.classList.remove('hidden');
    }
    renderSlots();
    renderGroups();
  } catch (error) {
    console.error(error);
    updatedText.textContent = 'Не удалось загрузить расписание';
    slotsGrid.innerHTML = `<div class="empty"><strong>Расписание временно недоступно</strong><span>Попробуйте обновить страницу чуть позже.</span></div>`;
    groupsGrid.innerHTML = '';
  }
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filter = btn.dataset.filter;
    renderSlots();
  });
});

loadSchedule();
