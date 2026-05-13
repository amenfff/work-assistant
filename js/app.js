async function init() {
  showLoading(true);
  try {
    await initDB();
    // Check saved user
    const savedUser = JSON.parse(localStorage.getItem('wa_user') || 'null');
    if (savedUser && savedUser.username) {
      const autoOk = await autoLogin(savedUser.username);
      if (autoOk) {
        document.getElementById('user-name').textContent = savedUser.username;
        await loadTasks();
        showMainApp();
      } else {
        localStorage.removeItem('wa_user');
        localStorage.removeItem('wa_pwd_hash');
        showLoginPage();
      }
    } else {
      showLoginPage();
    }
  } catch (e) {
    console.error('Init error:', e);
    showLoginPage();
    document.getElementById('login-err').textContent = '连接失败，请刷新重试';
  }
  showLoading(false);
  updateDate();
}

// Keyboard shortcuts
document.getElementById('task-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') addTask(); });
document.getElementById('inp-user').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('inp-pass').focus(); });
document.getElementById('inp-pass').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

// Start
init();
