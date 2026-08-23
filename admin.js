const REPO_OWNER = 'yulchikyulenka89-ai';
const REPO_NAME = 'julia-language-studio';
const BRANCH = 'main';
const DATA_PATH = 'data/schedule.json';

const DAYS = [
  ['monday', 'Понедельник'],
  ['tuesday', 'Вторник'],
  ['wednesday', 'Среда'],
  ['thursday', 'Четверг'],
  ['friday', 'Пятница']
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

function emptyWeekCell() {
  return { status: 'empty', title: '', details: '' };
}

function cloneDay(dayCells) {
  return dayCells.map(cell => ({ ...emptyWeekCell(), ...(cell || {}) }));
}

function dayLabel(key) {
  return DAYS.find(([day]) => day === key)?.[1] || key;
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
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body;
}

async function loadData() {
  if (!token) throw new Error('Сначала введите GitHub token');
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}?ref=${BRANCH}&t=${Date.now()}`;
  const body = await api(url);
  fileSha = body.sha;
  schedule = JSON.parse(decodeBase64Unicode(body.content));
  schedule.meta ||= {};
  normalizeWeek();
  renderAll();
  selectWeekCell($('weekDay').value, Number($('weekLesson').value));
  setDefaultCopyTarget();
  $('syncInfo').textContent = schedule.meta.updatedAt
    ? `Последнее сохранение: ${new Date(schedule.meta.updatedAt).toLocaleString('ru-RU')}`
    : 'Изменения ещё не сохранялись из кабинета.';
}

async function saveData() {
  if (!schedule || !fileSha) throw new Error('Данные ещё не загружены');
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
  const cells = DAYS.flatMap(([key]) => schedule.week[key]);
  $('statFree').textContent = cells.filter(cell => cell.status === 'free').length;
  $('statBusy').textContent = cells.filter(cell => cell.status === 'busy').length;
  $('statFilled').textContent = cells.filter(cell => cell.title || cell.details || cell.status !== 'empty').length;
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
  setDefaultCopyTarget();
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
  showToast('Время строки и ячейка изменены. Нажмите «Сохранить всё».');
}

function clearWeekCell() {
  if (!schedule) return;
  const day = $('weekDay').value;
  const index = Number($('weekLesson').value);
  schedule.week[day][index] = emptyWeekCell();
  renderAll();
  selectWeekCell(day, index);
  showToast('Ячейка очищена. Время строки сохранено.');
}

function setDefaultCopyTarget() {
  const source = $('weekDay').value;
  const current = $('copyTargetDay').value;
  if (current && current !== source) return;
  const target = DAYS.find(([key]) => key !== source)?.[0];
  if (target) $('copyTargetDay').value = target;
}

function copySelectedDay() {
  if (!schedule) return;
  normalizeWeek();
  const source = $('weekDay').value;
  const target = $('copyTargetDay').value;
  if (!target || target === source) {
    showToast('Выберите другой день, куда копировать.');
    return;
  }
  if (!confirm(`Скопировать весь ${dayLabel(source).toLowerCase()} в ${dayLabel(target).toLowerCase()}? Данные ${dayLabel(target).toLowerCase()} будут заменены.`)) return;
  schedule.week[target] = cloneDay(schedule.week[source]);
  renderAll();
  showToast(`✅ ${dayLabel(source)} скопирован в ${dayLabel(target)}. Нажмите «Сохранить всё».`, 3600);
}

function copySelectedDayToWeek() {
  if (!schedule) return;
  normalizeWeek();
  const source = $('weekDay').value;
  if (!confirm(`Скопировать ${dayLabel(source).toLowerCase()} на всю неделю? Расписание остальных четырёх дней будет заменено.`)) return;
  DAYS.forEach(([key]) => {
    if (key !== source) schedule.week[key] = cloneDay(schedule.week[source]);
  });
  renderAll();
  showToast(`✅ ${dayLabel(source)} скопирован на всю неделю. Нажмите «Сохранить всё».`, 4000);
}

function renderAll() {
  renderStats();
  renderWeekAdmin();
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
$('copyDayBtn').onclick = copySelectedDay;
$('copyWeekBtn').onclick = copySelectedDayToWeek;
$('weekDay').onchange = () => selectWeekCell($('weekDay').value, Number($('weekLesson').value));
$('weekLesson').onchange = () => selectWeekCell($('weekDay').value, Number($('weekLesson').value));
