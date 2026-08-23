const REPO_OWNER = 'yulchikyulenka89-ai';
const REPO_NAME = 'julia-language-studio';
const BRANCH = 'main';
const DATA_PATH = 'data/schedule.json';

const DAYS = [
  ['monday', 'Понедельник', 'Пн'],
  ['tuesday', 'Вторник', 'Вт'],
  ['wednesday', 'Среда', 'Ср'],
  ['thursday', 'Четверг', 'Чт'],
  ['friday', 'Пятница', 'Пт']
];

let token = '';
let fileSha = '';
let schedule = null;

const $ = id => document.getElementById(id);
const loginView = $('loginView');
const appView = $('appView');
const toast = $('toast');

function showToast(message, ms = 2600) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), ms);
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function encodeBase64Unicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function decodeBase64Unicode(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyWeekCell() {
  return { status: 'empty', title: '', details: '' };
}

function normalizeWeek() {
  schedule.week ||= {};
  schedule.times = Array.isArray(schedule.times) ? schedule.times.slice(0, 10) : [];
  while (schedule.times.length < 10) schedule.times.push('');

  DAYS.forEach(([key]) => {
    const source = Array.isArray(schedule.week[key]) ? schedule.week[key] : [];
    schedule.week[key] = Array.from({ length: 10 }, (_, index) => ({
      ...emptyWeekCell(),
      ...(source[index] || {})
    }));
  });
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  let body = null;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const message = body?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

async function loadData() {
  if (!token) throw new Error('Сначала введите GitHub token');
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}?ref=${BRANCH}&t=${Date.now()}`;
  const body = await api(url);
  fileSha = body.sha;
  schedule = JSON.parse(decodeBase64Unicode(body.content));
  schedule.meta ||= {};
  schedule.groups ||= [];
  schedule.slots ||= [];
  normalizeWeek();
  $('noticeInput').value = schedule.meta.notice || '';
  renderAll();
  selectWeekCell($('weekDay').value, Number($('weekLesson').value));
  $('syncInfo').textContent = schedule.meta.updatedAt
    ? `Последнее сохранение: ${new Date(schedule.meta.updatedAt).toLocaleString('ru-RU')}`
    : 'Изменения ещё не сохранялись из кабинета.';
}

async function saveData() {
  if (!schedule || !fileSha) throw new Error('Данные ещё не загружены');
  schedule.meta.notice = $('noticeInput').value.trim();
  schedule.meta.updatedAt = new Date().toISOString();
  const payload = {
    message: `Update studio schedule ${new Date().toLocaleString('ru-RU')}`,
    content: encodeBase64Unicode(JSON.stringify(schedule, null, 2) + '\n'),
    sha: fileSha,
    branch: BRANCH
  };
  const body = await api(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  fileSha = body.content.sha;
  $('syncInfo').textContent = `Сохранено: ${new Date(schedule.meta.updatedAt).toLocaleString('ru-RU')}`;
  showToast('✅ Расписание сохранено и скоро обновится на сайте');
}

function renderStats() {
  normalizeWeek();
  const weekCells = DAYS.flatMap(([key]) => schedule.week[key]);
  const free = weekCells.filter(cell => cell.status === 'free').length;
  const filled = weekCells.filter(cell => cell.title || cell.details || cell.status !== 'empty').length;
  const groups = schedule.groups.filter(g => Number(g.seatsFree || 0) > 0 && g.visible !== false).length;
  $('statFree').textContent = free;
  $('statGroups').textContent = groups;
  $('statVisible').textContent = filled;
}

function statusLabel(status) {
  return status === 'free' ? 'Свободно' : status === 'hold' ? 'Бронь' : status === 'busy' ? 'Занято' : 'Не задано';
}

function renderWeekAdmin() {
  normalizeWeek();
  const selectedDay = $('weekDay').value;
  const selectedIndex = Number($('weekLesson').value);
  const headers = DAYS.map(([, full]) => `<th>${full}</th>`).join('');
  const rows = Array.from({ length: 10 }, (_, rowIndex) => {
    const cells = DAYS.map(([key]) => {
      const cell = schedule.week[key][rowIndex] || emptyWeekCell();
      const active = key === selectedDay && rowIndex === selectedIndex ? ' active' : '';
      const title = cell.title || statusLabel(cell.status);
      return `<td><button type="button" class="week-admin-cell${active}" data-day="${key}" data-index="${rowIndex}" data-status="${esc(cell.status || 'empty')}">
        <strong>${esc(title)}</strong>
        <small>${esc(cell.details || statusLabel(cell.status))}</small>
      </button></td>`;
    }).join('');
    return `<tr><th class="admin-row-num">${esc(schedule.times[rowIndex] || '—')}</th>${cells}</tr>`;
  }).join('');

  $('weekAdminGrid').innerHTML = `<table class="week-admin-table"><thead><tr><th class="admin-row-num">Время</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  $('weekAdminGrid').querySelectorAll('[data-day]').forEach(button => {
    button.onclick = () => selectWeekCell(button.dataset.day, Number(button.dataset.index));
  });
}

function selectWeekCell(day, index) {
  if (!schedule) return;
  normalizeWeek();
  $('weekDay').value = day;
  $('weekLesson').value = String(index);
  const cell = schedule.week[day][index] || emptyWeekCell();
  $('weekTime').value = schedule.times[index] || '';
  $('weekStatus').value = cell.status || 'empty';
  $('weekTitle').value = cell.title || '';
  $('weekDetails').value = cell.details || '';
  renderWeekAdmin();
}

function applyWeekCell() {
  if (!schedule) return;
  normalizeWeek();
  const day = $('weekDay').value;
  const index = Number($('weekLesson').value);
  schedule.times[index] = $('weekTime').value;
  schedule.week[day][index] = {
    status: $('weekStatus').value,
    title: $('weekTitle').value.trim(),
    details: $('weekDetails').value.trim()
  };
  renderAll();
  selectWeekCell(day, index);
  showToast('Время строки и ячейка изменены локально. Нажмите «Сохранить всё».');
}

function clearWeekCell() {
  if (!schedule) return;
  const day = $('weekDay').value;
  const index = Number($('weekLesson').value);
  schedule.week[day][index] = emptyWeekCell();
  renderAll();
  selectWeekCell(day, index);
  showToast('Ячейка очищена. Время строки сохранено. Нажмите «Сохранить всё».');
}

function renderGroups() {
  const list = $('groupsList');
  if (!schedule.groups.length) {
    list.innerHTML = '<div class="empty"><strong>Групп пока нет</strong><span>Добавьте группу выше, когда откроется набор.</span></div>';
    return;
  }
  list.innerHTML = schedule.groups.map(group => `
    <div class="admin-item">
      <div>
        <div class="admin-item-title">${esc(group.title || 'Группа')}</div>
        <div class="admin-item-sub">${esc(group.days || 'дни не указаны')} · ${esc(group.time || 'время не указано')} · мест ${esc(group.seatsFree || 0)}/${esc(group.seatsTotal || 0)}${group.visible === false ? ' · скрыто' : ''}</div>
      </div>
      <div class="admin-item-actions">
        <button class="icon-btn" data-edit-group="${esc(group.id)}">✏️</button>
        <button class="icon-btn danger" data-delete-group="${esc(group.id)}">🗑</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-edit-group]').forEach(btn => btn.onclick = () => editGroup(btn.dataset.editGroup));
  list.querySelectorAll('[data-delete-group]').forEach(btn => btn.onclick = () => deleteGroup(btn.dataset.deleteGroup));
}

function renderAll() {
  renderStats();
  renderWeekAdmin();
  renderGroups();
}

function resetGroupForm() {
  $('groupForm').reset();
  $('groupId').value = '';
  $('groupSeatsFree').value = 1;
  $('groupSeatsTotal').value = 4;
  $('groupVisible').checked = true;
  $('groupSubmit').textContent = 'Добавить группу';
  $('groupCancel').classList.add('hidden');
}

function editGroup(id) {
  const g = schedule.groups.find(x => x.id === id);
  if (!g) return;
  $('groupId').value = g.id;
  $('groupTitle').value = g.title || '';
  $('groupDays').value = g.days || '';
  $('groupTime').value = g.time || '';
  $('groupAudience').value = g.audience || '';
  $('groupLevel').value = g.level || '';
  $('groupFormat').value = g.format || 'offline';
  $('groupSeatsFree').value = g.seatsFree ?? 1;
  $('groupSeatsTotal').value = g.seatsTotal ?? 4;
  $('groupNote').value = g.note || '';
  $('groupVisible').checked = g.visible !== false;
  $('groupSubmit').textContent = 'Сохранить изменения';
  $('groupCancel').classList.remove('hidden');
  $('groupForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteGroup(id) {
  const group = schedule.groups.find(x => x.id === id);
  if (!group || !confirm(`Удалить группу «${group.title || 'Без названия'}»?`)) return;
  schedule.groups = schedule.groups.filter(x => x.id !== id);
  renderAll();
  showToast('Группа удалена локально. Нажмите «Сохранить всё».');
}

$('loginBtn').onclick = async () => {
  token = $('tokenInput').value.trim();
  if (!token) return showToast('Введите GitHub token');
  $('loginBtn').disabled = true;
  $('loginBtn').textContent = 'Загружаю…';
  try {
    await loadData();
    $('tokenInput').value = '';
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    showToast('✅ Кабинет загружен');
  } catch (error) {
    token = '';
    showToast(`Ошибка входа: ${error.message}`, 5000);
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').textContent = 'Войти и загрузить расписание';
  }
};

$('saveAllBtn').onclick = async () => {
  $('saveAllBtn').disabled = true;
  $('saveAllBtn').textContent = 'Сохраняю…';
  try {
    await saveData();
    renderAll();
  } catch (error) {
    showToast(`Не удалось сохранить: ${error.message}`, 5000);
  } finally {
    $('saveAllBtn').disabled = false;
    $('saveAllBtn').textContent = '💾 Сохранить всё';
  }
};

$('reloadBtn').onclick = async () => {
  try {
    await loadData();
    showToast('Данные обновлены из GitHub');
  } catch (error) {
    showToast(`Ошибка обновления: ${error.message}`, 5000);
  }
};

$('weekApplyBtn').onclick = applyWeekCell;
$('weekClearBtn').onclick = clearWeekCell;
$('weekDay').onchange = () => selectWeekCell($('weekDay').value, Number($('weekLesson').value));
$('weekLesson').onchange = () => selectWeekCell($('weekDay').value, Number($('weekLesson').value));

$('groupForm').onsubmit = event => {
  event.preventDefault();
  const id = $('groupId').value || uid('group');
  const item = {
    id,
    title: $('groupTitle').value.trim(),
    days: $('groupDays').value.trim(),
    time: $('groupTime').value.trim(),
    audience: $('groupAudience').value.trim(),
    level: $('groupLevel').value.trim(),
    format: $('groupFormat').value,
    seatsFree: Number($('groupSeatsFree').value || 0),
    seatsTotal: Number($('groupSeatsTotal').value || 1),
    note: $('groupNote').value.trim(),
    visible: $('groupVisible').checked
  };
  const index = schedule.groups.findIndex(x => x.id === id);
  if (index >= 0) schedule.groups[index] = item; else schedule.groups.push(item);
  resetGroupForm();
  renderAll();
  showToast('Группа изменена локально. Теперь нажмите «Сохранить всё».');
};

$('groupCancel').onclick = resetGroupForm;
