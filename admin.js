const REPO_OWNER = 'yulchikyulenka89-ai';
const REPO_NAME = 'julia-language-studio';
const BRANCH = 'main';
const DATA_PATH = 'data/schedule.json';

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
  schedule.slots ||= [];
  schedule.groups ||= [];
  $('noticeInput').value = schedule.meta.notice || '';
  renderAll();
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

function slotLabel(slot) {
  const date = slot.date ? new Date(`${slot.date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }) : 'без даты';
  return `${date} · ${slot.time || '—'}`;
}

function renderStats() {
  const free = schedule.slots.filter(s => s.status === 'free').length;
  const groups = schedule.groups.filter(g => Number(g.seatsFree || 0) > 0).length;
  const visible = schedule.slots.filter(s => s.visible !== false && s.status !== 'busy').length + schedule.groups.filter(g => g.visible !== false && Number(g.seatsFree || 0) > 0).length;
  $('statFree').textContent = free;
  $('statGroups').textContent = groups;
  $('statVisible').textContent = visible;
}

function renderSlots() {
  const list = $('slotsList');
  if (!schedule.slots.length) {
    list.innerHTML = '<div class="empty"><strong>Окон пока нет</strong><span>Добавьте первое свободное время выше.</span></div>';
    return;
  }
  const ordered = [...schedule.slots].sort((a,b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
  list.innerHTML = ordered.map(slot => `
    <div class="admin-item">
      <div>
        <div class="admin-item-title">${esc(slotLabel(slot))}</div>
        <div class="admin-item-sub">${slot.type === 'group' ? 'Мини‑группа' : 'Индивидуально'} · ${slot.format === 'online' ? 'Онлайн' : 'Очно'} · ${slot.status === 'free' ? 'Свободно' : slot.status === 'hold' ? 'Бронь' : 'Занято'}${slot.audience ? ` · ${esc(slot.audience)}` : ''}${slot.visible === false ? ' · скрыто' : ''}</div>
      </div>
      <div class="admin-item-actions">
        <button class="icon-btn" data-edit-slot="${esc(slot.id)}">✏️</button>
        <button class="icon-btn danger" data-delete-slot="${esc(slot.id)}">🗑</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-edit-slot]').forEach(btn => btn.onclick = () => editSlot(btn.dataset.editSlot));
  list.querySelectorAll('[data-delete-slot]').forEach(btn => btn.onclick = () => deleteSlot(btn.dataset.deleteSlot));
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
  renderSlots();
  renderGroups();
}

function resetSlotForm() {
  $('slotForm').reset();
  $('slotId').value = '';
  $('slotDuration').value = 60;
  $('slotSeatsFree').value = 1;
  $('slotSeatsTotal').value = 1;
  $('slotVisible').checked = true;
  $('slotSubmit').textContent = 'Добавить окно';
  $('slotCancel').classList.add('hidden');
}

function editSlot(id) {
  const s = schedule.slots.find(x => x.id === id);
  if (!s) return;
  $('slotId').value = s.id;
  $('slotDate').value = s.date || '';
  $('slotTime').value = s.time || '';
  $('slotDuration').value = s.duration || 60;
  $('slotType').value = s.type || 'individual';
  $('slotFormat').value = s.format || 'offline';
  $('slotStatus').value = s.status || 'free';
  $('slotAudience').value = s.audience || '';
  $('slotLevel').value = s.level || '';
  $('slotSeatsFree').value = s.seatsFree ?? 1;
  $('slotSeatsTotal').value = s.seatsTotal ?? 1;
  $('slotNote').value = s.note || '';
  $('slotVisible').checked = s.visible !== false;
  $('slotSubmit').textContent = 'Сохранить изменения';
  $('slotCancel').classList.remove('hidden');
  $('slotForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteSlot(id) {
  const slot = schedule.slots.find(x => x.id === id);
  if (!slot || !confirm(`Удалить окно ${slotLabel(slot)}?`)) return;
  schedule.slots = schedule.slots.filter(x => x.id !== id);
  renderAll();
  showToast('Окно удалено локально. Нажмите «Сохранить всё».');
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

$('slotForm').onsubmit = event => {
  event.preventDefault();
  const id = $('slotId').value || uid('slot');
  const item = {
    id,
    date: $('slotDate').value,
    time: $('slotTime').value,
    duration: Number($('slotDuration').value || 60),
    type: $('slotType').value,
    format: $('slotFormat').value,
    status: $('slotStatus').value,
    audience: $('slotAudience').value.trim(),
    level: $('slotLevel').value.trim(),
    seatsFree: Number($('slotSeatsFree').value || 0),
    seatsTotal: Number($('slotSeatsTotal').value || 1),
    note: $('slotNote').value.trim(),
    visible: $('slotVisible').checked
  };
  const index = schedule.slots.findIndex(x => x.id === id);
  if (index >= 0) schedule.slots[index] = item; else schedule.slots.push(item);
  resetSlotForm();
  renderAll();
  showToast('Окно добавлено локально. Теперь нажмите «Сохранить всё».');
};

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
  showToast('Группа добавлена локально. Теперь нажмите «Сохранить всё».');
};

$('slotCancel').onclick = resetSlotForm;
$('groupCancel').onclick = resetGroupForm;
