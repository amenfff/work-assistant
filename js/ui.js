let collapsedGroups = JSON.parse(localStorage.getItem('wa_collapsed') || '{}');

function showLoading(v) { document.getElementById('loading-mask').classList.toggle('show', v); }
function showLoginPage() {
  document.getElementById('login-page').style.display = '';
  document.getElementById('main-app').style.display = 'none';
}
function showMainApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-app').style.display = '';
}
function setSync(state, text) {
  document.getElementById('sync-dot').className = 'sync-dot ' + state;
  document.getElementById('sync-text').textContent = text;
}

function saveCollapsed() { localStorage.setItem('wa_collapsed', JSON.stringify(collapsedGroups)); }

async function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const category = document.getElementById('cat-input').value.trim() || '未分类';
  const dueDate = document.getElementById('due-date-input').value;
  const tagRaw = document.getElementById('tag-input').value.trim();
  const tags = tagRaw ? tagRaw.split(/[\s,，、]+/).filter(t => t) : [];
  const now = Date.now();
  const task = { id: 0, text, category, dueDate, tags, done: false, createdAt: now, updatedAt: now };
  const saved = await cloudAdd(task);
  if (saved) {
    tasks.unshift(saved);
    input.value = '';
    document.getElementById('cat-input').value = '';
    document.getElementById('tag-input').value = '';
    document.getElementById('due-date-input').value = '';
    renderTasks();
    input.focus();
  }
}

async function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    const ok = await cloudUpdate(id, { done: !t.done });
    if (ok) { t.done = !t.done; t.updatedAt = Date.now(); renderTasks(); }
  }
}

async function deleteTask(id) {
  if (!confirm('确定删除这条任务吗？')) return;
  const ok = await cloudDelete(id);
  if (ok) { tasks = tasks.filter(t => t.id !== id); renderTasks(); }
}

function startEdit(id) {
  const el = document.getElementById('task-' + id);
  if (el) {
    el.classList.add('editing');
    const inp = el.querySelector('.edit-inline input');
    if (inp) { inp.value = tasks.find(t => t.id === id).text; inp.focus(); }
  }
}

async function saveEdit(id) {
  const el = document.getElementById('task-' + id);
  if (!el) return;
  const inp = el.querySelector('.edit-inline input');
  const text = inp.value.trim();
  if (!text) return;
  const ok = await cloudUpdate(id, { text });
  if (ok) { const t = tasks.find(t => t.id === id); if (t) { t.text = text; t.updatedAt = Date.now(); renderTasks(); } }
}

function cancelEdit(id) {
  const el = document.getElementById('task-' + id);
  if (el) el.classList.remove('editing');
}

function toggleGroup(cat) {
  collapsedGroups[cat] = !collapsedGroups[cat];
  saveCollapsed();
  renderTasks();
}

function groupLatestUpdate(gTasks) {
  let latest = 0;
  gTasks.forEach(t => { const u = t.updatedAt || t.createdAt || 0; if (u > latest) latest = u; });
  return fmtDate(latest);
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function renderTasks() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  let filtered = tasks.filter(t => {
    if (search && !t.text.toLowerCase().includes(search) && !(t.category||'').toLowerCase().includes(search) && !t.tags.join(' ').toLowerCase().includes(search)) return false;
    if (currentFilter === 'todo') return !t.done;
    if (currentFilter === 'done') return t.done;
    return true;
  });

  const list = document.getElementById('task-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>.</p><p>没有任务</p></div>';
  } else {
    const groups = {};
    filtered.forEach(t => { const cat = t.category || '未分类'; if (!groups[cat]) groups[cat] = []; groups[cat].push(t); });
    let html = '';
    Object.keys(groups).sort().forEach(cat => {
      const gTasks = groups[cat];
      const todoCount = gTasks.filter(t => !t.done).length;
      const isCollapsed = collapsedGroups[cat];
      html += '<div class="group-card">';
      html += '<div class="group-header" onclick="toggleGroup(\'' + escAttr(cat) + '\')">';
      html += '<span class="group-arrow' + (isCollapsed ? ' collapsed' : '') + '">&#9660;</span>';
      html += '<span class="group-name">' + escHtml(cat) + '</span>';
      html += '<span class="group-count">' + todoCount + ' 待办</span>';
      html += '<span class="group-date">最近更新 ' + groupLatestUpdate(gTasks) + '</span>';
      html += '</div>';
      html += '<div class="group-body' + (isCollapsed ? ' collapsed' : '') + '">';
      html += '<div class="group-tasks">';
      gTasks.forEach(t => { html += buildTaskHTML(t); });
      html += '</div></div></div>';
    });
    list.innerHTML = html;
  }

  document.getElementById('stat-total').textContent = tasks.length;
  document.getElementById('stat-todo').textContent = tasks.filter(t => !t.done).length;
  document.getElementById('stat-done').textContent = tasks.filter(t => t.done).length;
}

function buildTaskHTML(t) {
  const safeId = typeof t.id === 'string' ? t.id : String(t.id);
  let metaHtml = '';
  if (t.dueDate) {
    const df = formatDate(t.dueDate);
    metaHtml += '<span class="due-date' + (df.overdue ? ' overdue' : '') + '">' + df.text + '</span>';
  }
  if (t.tags && t.tags.length) {
    t.tags.forEach(tag => { metaHtml += '<span class="tag-badge">' + escHtml(tag) + '</span>'; });
  }
  const info = formatUpdated(t);
  return '<div class="task-item' + (t.done ? ' done' : '') + '" id="task-' + safeId + '">' +
    '<div class="checkbox' + (t.done ? ' checked' : '') + '" onclick="toggleDone(\'' + safeId + '\')"></div>' +
    '<div class="task-body">' +
    '<div class="task-title">' + escHtml(t.text) + '</div>' +
    (metaHtml ? '<div class="task-meta">' + metaHtml + '</div>' : '') +
    '<div class="date-info">' + info + '</div>' +
    '<div class="edit-inline">' +
    '<input type="text" maxlength="200" onkeydown="if(event.key===\'Enter\')saveEdit(\'' + safeId + '\');if(event.key===\'Escape\')cancelEdit(\'' + safeId + '\');">' +
    '<button class="btn-sm" onclick="saveEdit(\'' + safeId + '\')">保存</button>' +
    '<button class="btn-sm cancel" onclick="cancelEdit(\'' + safeId + '\')">取消</button>' +
    '</div>' +
    '</div>' +
    '<div class="task-actions">' +
    '<button class="btn-icon edit" title="编辑" onclick="event.stopPropagation();startEdit(\'' + safeId + '\')">&#9998;</button>' +
    '<button class="btn-icon danger" title="删除" onclick="event.stopPropagation();deleteTask(\'' + safeId + '\')">&#10005;</button>' +
    '</div></div>';
}

function updateDate() {
  const now = new Date();
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  document.getElementById('date-display').textContent =
    now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日 ' + days[now.getDay()];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderTasks, buildTaskHTML, addTask, toggleDone, deleteTask, updateDate };
}
