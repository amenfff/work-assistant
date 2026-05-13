let tasks = [];
let currentFilter = 'all';

async function migrateLocalData() {
  const STORE_KEY = 'work_tasks_final';
  const local = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (!local || local.length === 0) return;
  const db = getDB();
  if (!db || !currentUser || !currentUser.username) return;
  try {
    const existing = await db.collection('tasks').where({ username: currentUser.username }).limit(1).get();
    if (existing.data && existing.data.length > 0) return;
    for (const t of local) {
      await db.collection('tasks').add({
        username: currentUser.username,
        text: t.text,
        category: t.category || '未分类',
        dueDate: t.dueDate || '',
        tags: t.tags || [],
        done: !!t.done,
        createdAt: t.createdAt || Date.now(),
        updatedAt: t.updatedAt || Date.now()
      });
    }
    localStorage.removeItem(STORE_KEY);
  } catch (e) {
    console.warn('Migration failed:', e);
  }
}

async function loadTasks() {
  setSync('syncing', '同步中…');
  const db = getDB();
  if (!db || !currentUser || !currentUser.username) {
    setSync('error', '未登录');
    renderTasks();
    return;
  }
  try {
    let allData = [];
    let page = 0;
    const pageSize = 100;
    while (true) {
      const res = await db.collection('tasks')
        .where({ username: currentUser.username })
        .orderBy('createdAt', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get();
      const data = res.data || [];
      if (data.length === 0) break;
      allData = allData.concat(data);
      page++;
      if (data.length < pageSize) break;
    }
    tasks = allData.map(d => ({
      id: d._id,
      text: d.text,
      category: d.category || '未分类',
      dueDate: d.dueDate || '',
      tags: d.tags || [],
      done: !!d.done,
      createdAt: d.createdAt || 0,
      updatedAt: d.updatedAt || 0
    }));
    setSync('ok', '已同步');
  } catch (e) {
    console.error('Load error:', e);
    setSync('error', '同步失败');
  }
  renderTasks();
}

async function cloudAdd(task) {
  const db = getDB();
  if (!db || !currentUser || !currentUser.username) return null;
  try {
    setSync('syncing', '保存中…');
    const res = await db.collection('tasks').add({
      username: currentUser.username,
      text: task.text, category: task.category,
      dueDate: task.dueDate, tags: task.tags,
      done: task.done, createdAt: task.createdAt, updatedAt: task.updatedAt
    });
    task.id = res.id || res._id;
    setSync('ok', '已同步');
    return task;
  } catch (e) {
    console.error('Add error:', e);
    setSync('error', '保存失败');
    return null;
  }
}

async function cloudUpdate(id, updates) {
  const db = getDB();
  if (!db) return false;
  try {
    setSync('syncing', '保存中…');
    await db.collection('tasks').doc(id).update({ ...updates, updatedAt: Date.now() });
    setSync('ok', '已同步');
    return true;
  } catch (e) {
    console.error('Update error:', e);
    setSync('error', '更新失败');
    return false;
  }
}

async function cloudDelete(id) {
  const db = getDB();
  if (!db) return false;
  try {
    setSync('syncing', '删除中…');
    await db.collection('tasks').doc(id).remove();
    setSync('ok', '已同步');
    return true;
  } catch (e) {
    console.error('Delete error:', e);
    setSync('error', '删除失败');
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tasks, currentFilter, migrateLocalData, loadTasks, cloudAdd, cloudUpdate, cloudDelete };
}
