// ====== Security Utilities ======

// Web Crypto API — works in browser, falls back to Node crypto in tests
const _crypto = (typeof crypto !== 'undefined' && crypto.subtle)
  ? crypto
  : (typeof require !== 'undefined' ? require('crypto').webcrypto : null);

if (!_crypto) throw new Error('Web Crypto API not available');

/**
 * PBKDF2 password hashing with random salt
 * Format: salt:hash (hex-encoded)
 */
async function hashPwd(pwd) {
  const salt = _crypto.getRandomValues(new Uint8Array(16));
  const key = await _crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pwd),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await _crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hex = arr => Array.from(new Uint8Array(arr)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex(salt) + ':' + hex(hash);
}

/**
 * Verify password against stored PBKDF2 hash
 */
async function verifyPwd(pwd, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, hashHex] = storedHash.split(':');
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await _crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pwd),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await _crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  const hex = arr => Array.from(new Uint8Array(arr)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex(hash) === hashHex;
}

// ====== HTML Escaping (XSS Prevention) ======

function escHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');
}

function escAttr(s) {
  if (!s || typeof s !== 'string') return '';
  return escHtml(s).replace(/'/g, '&#x27;');
}

// ====== Format Utilities ======

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target - today) / 86400000);
  if (diff < 0) return { text: '已逾期 ' + Math.abs(diff) + ' 天', overdue: true };
  if (diff === 0) return { text: '今天截止', overdue: false };
  if (diff === 1) return { text: '明天截止', overdue: false };
  return { text: (d.getMonth()+1) + '/' + d.getDate() + ' 截止', overdue: false };
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return (d.getMonth()+1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function pad(n) { return n < 10 ? '0'+n : String(n); }

function formatUpdated(t) {
  const created = t.createdAt || 0;
  const updated = t.updatedAt || created;
  let parts = [];
  if (created) parts.push('创建 ' + fmtDate(created));
  if (updated > created + 60000) parts.push('更新 ' + fmtDate(updated));
  return parts.join(' / ');
}

// ====== Login Throttle ======

const LOGIN_MAX_RETRIES = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function getLoginAttempts() {
  try {
    const data = JSON.parse(sessionStorage.getItem('wa_login_attempts') || 'null');
    if (!data) return { count: 0, lockedUntil: 0 };
    return data;
  } catch { return { count: 0, lockedUntil: 0 }; }
}

function recordLoginAttempt(success) {
  let { count, lockedUntil } = getLoginAttempts();
  if (success) {
    sessionStorage.removeItem('wa_login_attempts');
    return { locked: false, remaining: LOGIN_MAX_RETRIES };
  }
  const now = Date.now();
  if (lockedUntil > 0 && now > lockedUntil) {
    // Lock expired, reset counter
    count = 1;
    lockedUntil = 0;
  } else {
    count = (count || 0) + 1;
  }
  if (count >= LOGIN_MAX_RETRIES) {
    lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  sessionStorage.setItem('wa_login_attempts', JSON.stringify({ count, lockedUntil, lastAttempt: now }));
  return {
    locked: lockedUntil > now,
    remaining: Math.max(0, LOGIN_MAX_RETRIES - count),
    lockedUntil
  };
}

// ====== Export (Node/browser dual support) ======
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hashPwd, verifyPwd, escHtml, escAttr, formatDate, fmtDate, pad, formatUpdated, getLoginAttempts, recordLoginAttempt };
}
