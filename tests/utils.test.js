require('./setup');
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { hashPwd, verifyPwd, escHtml, escAttr, formatDate, fmtDate, pad, formatUpdated, getLoginAttempts, recordLoginAttempt } = require('../js/utils');

describe('hashPwd', () => {
  test('相同密码产生不同输出（随机盐）', async () => {
    const h1 = await hashPwd('password123');
    const h2 = await hashPwd('password123');
    assert.notStrictEqual(h1, h2);
    assert.match(h1, /^[a-f0-9]{32}:[a-f0-9]{64}$/);
  });

  test('不同密码产生不同哈希', async () => {
    const h1 = await hashPwd('password123');
    const h2 = await hashPwd('different456');
    assert.notStrictEqual(h1, h2);
  });

  test('空密码也能哈希', async () => {
    const h = await hashPwd('');
    assert.match(h, /^[a-f0-9]{32}:[a-f0-9]{64}$/);
  });
});

describe('verifyPwd', () => {
  test('正确密码验证通过', async () => {
    const h = await hashPwd('mysecret');
    assert.strictEqual(await verifyPwd('mysecret', h), true);
  });

  test('错误密码验证失败', async () => {
    const h = await hashPwd('mysecret');
    assert.strictEqual(await verifyPwd('wrongpass', h), false);
  });

  test('旧格式 SHA256 哈希验证失败（强制重新登录）', async () => {
    assert.strictEqual(await verifyPwd('mysecret', 'abc123def456'), false);
  });

  test('null/undefined/空字符串 存储哈希返回 false', async () => {
    assert.strictEqual(await verifyPwd('pass', null), false);
    assert.strictEqual(await verifyPwd('pass', undefined), false);
    assert.strictEqual(await verifyPwd('pass', ''), false);
  });
});

describe('escHtml', () => {
  test('转义 HTML 特殊字符', () => {
    assert.strictEqual(
      escHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  test('转义单引号和反斜杠', () => {
    assert.strictEqual(escHtml("it's a test / path \\"), "it&#x27;s a test &#x2F; path &#x5C;");
  });

  test('转义反引号', () => {
    assert.strictEqual(escHtml('`onclick=alert(1)`'), '&#x60;onclick=alert(1)&#x60;');
  });

  test('空值和非法输入返回空字符串', () => {
    assert.strictEqual(escHtml(null), '');
    assert.strictEqual(escHtml(undefined), '');
    assert.strictEqual(escHtml(123), '');
  });

  test('正常文本不转义', () => {
    assert.strictEqual(escHtml('Hello 世界'), 'Hello 世界');
  });
});

describe('escAttr', () => {
  test('转义属性值中的特殊字符', () => {
    assert.ok(escAttr("it's").includes('&#x27;'));
  });
});

describe('formatDate', () => {
  test('逾期日期标记为 overdue', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = formatDate(past.toISOString().split('T')[0]);
    assert.strictEqual(result.overdue, true);
    assert.ok(result.text.includes('已逾期'));
  });

  test('今天截止', () => {
    const today = new Date().toISOString().split('T')[0];
    const result = formatDate(today);
    assert.strictEqual(result.text, '今天截止');
    assert.strictEqual(result.overdue, false);
  });

  test('明天截止', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = formatDate(tomorrow.toISOString().split('T')[0]);
    assert.strictEqual(result.text, '明天截止');
    assert.strictEqual(result.overdue, false);
  });

  test('空日期返回空字符串', () => {
    assert.strictEqual(formatDate(''), '');
  });
});

describe('fmtDate', () => {
  test('格式化时间戳', () => {
    const ts = new Date('2024-06-15T14:30:00').getTime();
    assert.strictEqual(fmtDate(ts), '6月15日 14:30');
  });

  test('空值返回空', () => {
    assert.strictEqual(fmtDate(0), '');
    assert.strictEqual(fmtDate(null), '');
  });
});

describe('pad', () => {
  test('补零', () => {
    assert.strictEqual(pad(5), '05');
    assert.strictEqual(pad(12), '12');
    assert.strictEqual(pad(0), '00');
  });
});

describe('formatUpdated', () => {
  test('只创建时只显示创建时间', () => {
    const now = Date.now();
    const t = { createdAt: now, updatedAt: now };
    assert.ok(formatUpdated(t).includes('创建'));
  });

  test('更新后显示创建和更新时间', () => {
    const created = Date.now() - 120000;
    const updated = Date.now();
    const t = { createdAt: created, updatedAt: updated };
    assert.ok(formatUpdated(t).includes('创建'));
    assert.ok(formatUpdated(t).includes('更新'));
  });
});

describe('login throttle', () => {
  test('初始状态允许登录', () => {
    const attempts = getLoginAttempts();
    assert.strictEqual(attempts.count, 0);
    assert.strictEqual(attempts.lockedUntil, 0);
  });

  test('记录失败增加计数', () => {
    recordLoginAttempt(false);
    const attempts = getLoginAttempts();
    assert.ok(attempts.count >= 1);
  });

  test('5次失败后锁定', () => {
    for (let i = 0; i < 5; i++) recordLoginAttempt(false);
    const { locked } = recordLoginAttempt(false);
    assert.strictEqual(locked, true);
  });

  test('成功登录清除记录', () => {
    recordLoginAttempt(false);
    recordLoginAttempt(false);
    const result = recordLoginAttempt(true);
    assert.strictEqual(result.locked, false);
    assert.strictEqual(result.remaining, 5);
    assert.strictEqual(sessionStorage.getItem('wa_login_attempts'), null);
  });
});
