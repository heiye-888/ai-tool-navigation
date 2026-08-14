const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'server-data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PORT = process.env.PORT || 3000;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,19}$/;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const sessions = new Map();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (error) {
    return { users: [], admin: null };
  }
}

function writeData(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function hashPassword(password, salt) {
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, function (error, derivedKey) {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey.toString('hex'));
    });
  });
}

function cipherKey() {
  return crypto.createHash('sha256').update(process.env.ADMIN_SECRET || 'local-demo-secret-change-me').digest();
}

function encryptPassword(password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey(), iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPassword(value) {
  const parts = value.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey(), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function randomId() {
  return crypto.randomUUID();
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function passwordTypeCount(password) {
  let count = 0;
  if (/[a-z]/.test(password)) count += 1;
  if (/[A-Z]/.test(password)) count += 1;
  if (/[0-9]/.test(password)) count += 1;
  if (/[^A-Za-z0-9]/.test(password)) count += 1;
  return count;
}

function passwordError(password) {
  if (/\s/.test(password)) return '密码不能包含空格';
  if (password.length < 8 || password.length > 32) return '密码长度需为 8-32 位';
  if (passwordTypeCount(password) < 2) return '密码需包含字母、数字、特殊符号中的至少两种';
  return '';
}

function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  cookieHeader.split(';').forEach(function (part) {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    result[key] = decodeURIComponent(value);
  });
  return result;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = sessions.get(cookies.session);
  if (!session || session.expires < Date.now()) return null;
  return session;
}

function setSessionCookie(res, username, role) {
  const token = randomToken();
  sessions.set(token, {
    username: username,
    role: role,
    expires: Date.now() + SESSION_TTL
  });
  res.setHeader('Set-Cookie', 'session=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(SESSION_TTL / 1000));
}

function clearSessionCookie(res, token) {
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (chunk) {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('请求内容过大'));
        req.destroy();
      }
    });
    req.on('end', function () {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('请求格式不正确'));
      }
    });
    req.on('error', reject);
  });
}

async function ensureAdmin() {
  ensureDataDir();
  const data = readData();
  if (data.admin) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin888888';
  const salt = crypto.randomBytes(16).toString('hex');
  data.admin = {
    username: username,
    passwordHash: await hashPassword(password, salt),
    salt: salt,
    createdAt: new Date().toISOString()
  };
  writeData(data);
  console.log('[后台] 管理员账号已创建：' + username + ' / ' + password);
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, mode: 'server' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/register') {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!USERNAME_RE.test(username)) {
      sendJson(res, 400, { error: '账号需以英文开头，由 4-20 位英文、数字或下划线组成' });
      return;
    }
    const passwordIssue = passwordError(password);
    if (passwordIssue) {
      sendJson(res, 400, { error: passwordIssue });
      return;
    }

    const data = readData();
    const exists = data.users.some(function (user) {
      return user.username.toLowerCase() === username.toLowerCase();
    });
    if (exists) {
      sendJson(res, 400, { error: '该账号已存在，请直接登录' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
      id: randomId(),
      username: username,
      passwordHash: await hashPassword(password, salt),
      passwordEnc: encryptPassword(password),
      salt: salt,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    data.users.push(user);
    writeData(data);
    setSessionCookie(res, username, 'user');
    sendJson(res, 200, { username: username, role: 'user' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const data = readData();
    const admin = data.admin;
    const user = data.users.find(function (item) {
      return item.username.toLowerCase() === username.toLowerCase();
    });

    if (admin && admin.username.toLowerCase() === username.toLowerCase()) {
      const hash = await hashPassword(password, admin.salt);
      if (hash === admin.passwordHash) {
        setSessionCookie(res, admin.username, 'admin');
        sendJson(res, 200, { username: admin.username, role: 'admin' });
        return;
      }
    }

    if (user) {
      const hash = await hashPassword(password, user.salt);
      if (hash === user.passwordHash) {
        user.lastLoginAt = new Date().toISOString();
        writeData(data);
        setSessionCookie(res, user.username, 'user');
        sendJson(res, 200, { username: user.username, role: 'user' });
        return;
      }
    }

    sendJson(res, 400, { error: '账号或密码不正确' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    clearSessionCookie(res, cookies.session);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/session') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { error: '未登录' });
      return;
    }
    sendJson(res, 200, { username: session.username, role: session.role });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/users') {
    const session = getSession(req);
    if (!session || session.role !== 'admin') {
      sendJson(res, 403, { error: '没有管理员权限' });
      return;
    }
    const data = readData();
    const users = data.users.map(function (user) {
      return {
        id: user.id,
        username: user.username,
        password: decryptPassword(user.passwordEnc),
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt || ''
      };
    });
    sendJson(res, 200, { total: users.length, users: users });
    return;
  }

  sendJson(res, 404, { error: '接口不存在' });
}

function serveStatic(req, res, pathname) {
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(ROOT, 'index.html');
  } else if (pathname === '/admin') {
    filePath = path.join(ROOT, 'admin.html');
  } else {
    filePath = path.join(ROOT, decodeURIComponent(pathname));
  }

  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(normalized, function (error, content) {
    if (error) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(normalized).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.indexOf('/api/') === 0) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      sendJson(res, 400, { error: error.message || '请求失败' });
    }
    return;
  }
  serveStatic(req, res, url.pathname);
}

ensureAdmin().then(function () {
  http.createServer(handleRequest).listen(PORT, function () {
    console.log('AI 工具导航服务已启动：http://localhost:' + PORT);
  });
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
