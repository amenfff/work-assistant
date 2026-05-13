let currentUser = null; // { uid, username, authUid }

async function autoLogin(username) {
  const db = getDB();
  if (!db) { console.log('[autoLogin] db is null'); return false; }
  const authUid = getAuthUid();
  console.log('[autoLogin] start, username:', username, 'authUid:', authUid);
  try {
    const res = await db.collection('users').where({ username: username }).limit(1).get();
    console.log('[autoLogin] users query result:', res);
    if (!res.data || res.data.length === 0) { console.log('[autoLogin] user not found'); return false; }
    const userRecord = res.data[0];
    console.log('[autoLogin] userRecord found, _id:', userRecord._id, 'has password:', !!userRecord.password);
    const savedHash = localStorage.getItem('wa_pwd_hash');
    console.log('[autoLogin] savedHash exists:', !!savedHash, 'length:', savedHash ? savedHash.length : 0);
    console.log('[autoLogin] password match:', userRecord.password === savedHash);
    if (!savedHash) { console.log('[autoLogin] no savedHash'); return false; }
    if (userRecord.password !== savedHash) { console.log('[autoLogin] hash mismatch'); return false; }
    
    // Update authUid if changed (device/browser switch)
    if (authUid && userRecord.authUid !== authUid) {
      try {
        await db.collection('users').doc(userRecord._id).update({ authUid: authUid });
      } catch (e) {
        console.warn('AuthUid update failed:', e);
      }
    }
    
    currentUser = { uid: userRecord._id, username: username, authUid: authUid || userRecord.authUid };
    localStorage.setItem('wa_user', JSON.stringify(currentUser));
    console.log('[autoLogin] success');
    return true;
  } catch(e) {
    console.error('[autoLogin] error:', e);
    return false;
  }
}

async function doLogin() {
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('btn-login');
  errEl.textContent = '';
  
  // Check lockout
  const attempts = getLoginAttempts();
  const now = Date.now();
  if (attempts.lockedUntil > now) {
    const waitMin = Math.ceil((attempts.lockedUntil - now) / 60000);
    errEl.textContent = `登录尝试过多，请 ${waitMin} 分钟后再试`;
    return;
  }
  
  const username = document.getElementById('inp-user').value.trim();
  const password = document.getElementById('inp-pass').value;
  if (!username) { errEl.textContent = '请输入用户名'; return; }
  if (!password) { errEl.textContent = '请输入密码'; return; }

  const db = getDB();
  const authUid = getAuthUid();
  if (!db) { errEl.textContent = '数据库连接失败'; return; }

  btn.disabled = true;
  btn.textContent = '请稍候…';
  try {
    // Query existing user
    let userRecord = null;
    try {
      const res = await db.collection('users').where({ username: username }).limit(1).get();
      if (res.data && res.data.length > 0) userRecord = res.data[0];
    } catch(e) {
      console.error('Query user error:', e);
      errEl.textContent = '查询失败，请稍后重试';
      btn.disabled = false; btn.textContent = '登录';
      return;
    }

    if (!userRecord) {
      errEl.textContent = '用户名不存在，请先注册';
      btn.disabled = false; btn.textContent = '登录';
      return;
    }

    // Verify password with PBKDF2
    const ok = await verifyPwd(password, userRecord.password);
    if (ok) {
      // Update authUid if device/browser changed
      if (authUid && userRecord.authUid !== authUid) {
        try {
          await db.collection('users').doc(userRecord._id).update({ authUid: authUid });
        } catch (e) { console.warn('AuthUid update failed:', e); }
      }
      currentUser = { uid: userRecord._id, username: username, authUid: authUid || userRecord.authUid };
      localStorage.setItem('wa_user', JSON.stringify(currentUser));
      localStorage.setItem('wa_pwd_hash', userRecord.password);
      document.getElementById('user-name').textContent = username;
      recordLoginAttempt(true);
      await migrateLocalData();
      await loadTasks();
      showMainApp();
      updateDate();
    } else {
      const { locked } = recordLoginAttempt(false);
      errEl.textContent = locked ? '登录尝试过多，请5分钟后再试' : '密码错误';
    }
  } catch (e) {
    console.error('Login error:', e);
    errEl.textContent = '操作失败，请稍后重试';
  }
  btn.disabled = false;
  btn.textContent = '登录';
}

async function doRegister() {
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('btn-register');
  errEl.textContent = '';
  
  const username = document.getElementById('inp-user').value.trim();
  const password = document.getElementById('inp-pass').value;
  if (!username) { errEl.textContent = '请输入用户名'; return; }
  if (!password) { errEl.textContent = '请输入密码'; return; }
  if (password.length < 4) { errEl.textContent = '密码至少4位'; return; }

  const db = getDB();
  const authUid = getAuthUid();
  if (!db) { errEl.textContent = '数据库连接失败'; return; }

  btn.disabled = true;
  btn.textContent = '请稍候…';
  try {
    // Check if username already exists
    let existing = null;
    try {
      const res = await db.collection('users').where({ username: username }).limit(1).get();
      if (res.data && res.data.length > 0) existing = res.data[0];
    } catch(e) {
      console.error('Query user error:', e);
      errEl.textContent = '查询失败，请稍后重试';
      btn.disabled = false; btn.textContent = '注册';
      return;
    }

    if (existing) {
      errEl.textContent = '用户名已存在，请直接登录';
      btn.disabled = false; btn.textContent = '注册';
      return;
    }

    // Create new user
    const hashed = await hashPwd(password);
    const now = Date.now();
    const res = await db.collection('users').add({
      username: username,
      password: hashed,
      authUid: authUid || '',
      createdAt: now,
      updatedAt: now
    });
    currentUser = { uid: res.id || res._id, username: username, authUid: authUid || '' };
    localStorage.setItem('wa_user', JSON.stringify(currentUser));
    localStorage.setItem('wa_pwd_hash', hashed);
    document.getElementById('user-name').textContent = username;
    recordLoginAttempt(true);
    await loadTasks();
    showMainApp();
    updateDate();
  } catch (e) {
    console.error('Register error:', e);
    errEl.textContent = '注册失败，请稍后重试';
  }
  btn.disabled = false;
  btn.textContent = '注册';
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem('wa_user');
  localStorage.removeItem('wa_pwd_hash');
  sessionStorage.removeItem('wa_login_attempts');
  showLoginPage();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { currentUser, autoLogin, doLogin, doRegister, doLogout };
}
