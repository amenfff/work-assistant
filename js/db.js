// ====== Database + Auth ======
const ENV_ID = 'work-assistant-d8gdihp3bcd18d295';

let _app, _db, _auth, _authUid = null;

async function initDB() {
  _app = cloudbase.init({ env: ENV_ID });
  _db = _app.database();
  _auth = _app.auth();
  
  // Anonymous login — uid is the isolation boundary
  try {
    const loginState = await _auth.signInAnonymously();
    _authUid = loginState && loginState.uid ? loginState.uid : null;
    if (!_authUid) {
      // Fallback: try to get from auth.currentUser
      const user = _auth.currentUser;
      _authUid = user ? user.uid : null;
    }
    console.log('Auth uid:', _authUid);
  } catch (e) {
    console.warn('Anonymous login failed:', e.message || e);
    _authUid = null;
  }
  
  return { app: _app, db: _db, auth: _auth, authUid: _authUid };
}

function getDB() { return _db; }
function getAuth() { return _auth; }
function getAuthUid() { return _authUid; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initDB, getDB, getAuth, getAuthUid };
}
