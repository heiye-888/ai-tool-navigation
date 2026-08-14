(function () {
  'use strict';

  const els = {
    adminLoginView: document.getElementById('adminLoginView'),
    adminDashboard: document.getElementById('adminDashboard'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminUsername: document.getElementById('adminUsername'),
    adminPassword: document.getElementById('adminPassword'),
    adminLoginError: document.getElementById('adminLoginError'),
    adminLogoutBtn: document.getElementById('adminLogoutBtn'),
    adminRefreshBtn: document.getElementById('adminRefreshBtn'),
    adminTotalCount: document.getElementById('adminTotalCount'),
    adminAccountName: document.getElementById('adminAccountName'),
    adminTableBody: document.getElementById('adminTableBody'),
    adminToast: document.getElementById('adminToast')
  };
  let currentUsers = [];
  const visiblePasswords = new Set();

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function showToast(message) {
    els.adminToast.textContent = message;
    els.adminToast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      els.adminToast.classList.remove('show');
    }, 1800);
  }

  async function apiJson(url, options) {
    let response;
    try {
      response = await fetch(url, Object.assign({
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }
      }, options || {}));
    } catch (error) {
      throw new Error('无法连接后台服务，请先启动 node server.js，再访问 http://localhost:3000/admin.html');
    }
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  }

  function showDashboard(username) {
    els.adminLoginView.hidden = true;
    els.adminDashboard.hidden = false;
    els.adminLogoutBtn.hidden = false;
    els.adminAccountName.textContent = username;
    loadUsers();
  }

  function showLogin() {
    els.adminLoginView.hidden = false;
    els.adminDashboard.hidden = true;
    els.adminLogoutBtn.hidden = true;
  }

  function formatTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const pad = function (num) { return String(num).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  async function loadUsers() {
    try {
      const data = await apiJson('/api/admin/users');
      els.adminTotalCount.textContent = String(data.total);
      currentUsers = data.users.slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      renderUsers();
    } catch (error) {
      els.adminTableBody.innerHTML = '<tr><td colspan="5">加载失败：' + escapeHtml(error.message) + '</td></tr>';
      showToast(error.message);
    }
  }

  function renderUsers() {
    if (currentUsers.length === 0) {
      els.adminTableBody.innerHTML = '<tr class="admin-empty-row"><td colspan="5">暂无注册用户</td></tr>';
      return;
    }
    els.adminTableBody.innerHTML = currentUsers.map(function (user, index) {
      const visible = visiblePasswords.has(user.id);
      return (
        '<tr>' +
          '<td class="admin-index">' + (index + 1) + '</td>' +
          '<td>' +
            '<span class="admin-username">' + escapeHtml(user.username) + '</span>' +
            '<button class="row-btn" type="button" data-action="copy-username" data-id="' + escapeHtml(user.id) + '" title="复制账号"><i data-lucide="copy"></i></button>' +
          '</td>' +
          '<td class="admin-password-cell">' +
            '<span class="admin-password-text">' + (visible ? escapeHtml(user.password) : '••••••••') + '</span>' +
            '<button class="row-btn" type="button" data-action="toggle-password" data-id="' + escapeHtml(user.id) + '" title="' + (visible ? '隐藏密码' : '显示密码') + '"><i data-lucide="' + (visible ? 'eye-off' : 'eye') + '"></i></button>' +
            '<button class="row-btn" type="button" data-action="copy-password" data-id="' + escapeHtml(user.id) + '" title="复制密码"><i data-lucide="copy"></i></button>' +
          '</td>' +
          '<td class="admin-time">' + escapeHtml(formatTime(user.createdAt)) + '</td>' +
          '<td class="admin-time">' + escapeHtml(formatTime(user.lastLoginAt)) + '</td>' +
        '</tr>'
      );
    }).join('');
    refreshIcons();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制');
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('已复制');
      } catch (copyError) {
        showToast('复制失败');
      }
      document.body.removeChild(textarea);
    }
  }

  els.adminLoginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const username = els.adminUsername.value.trim();
    const password = els.adminPassword.value;
    els.adminLoginError.hidden = true;
    if (!username || !password) {
      els.adminLoginError.textContent = '请输入管理员账号和密码';
      els.adminLoginError.hidden = false;
      return;
    }
    try {
      const data = await apiJson('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password })
      });
      if (data.role !== 'admin') {
        els.adminLoginError.textContent = '该账号不是管理员账号';
        els.adminLoginError.hidden = false;
        return;
      }
      showDashboard(data.username);
    } catch (error) {
      els.adminLoginError.textContent = error.message;
      els.adminLoginError.hidden = false;
    }
  });

  els.adminLogoutBtn.addEventListener('click', async function () {
    try {
      await apiJson('/api/logout', { method: 'POST' });
    } catch (error) {
      // 即使退出接口失败，也回到登录页
    }
    els.adminPassword.value = '';
    showLogin();
  });

  els.adminRefreshBtn.addEventListener('click', function () {
    loadUsers();
  });

  els.adminTableBody.addEventListener('click', async function (event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const user = currentUsers.find(function (item) { return item.id === btn.dataset.id; });
    if (!user) return;
    if (btn.dataset.action === 'toggle-password') {
      if (visiblePasswords.has(user.id)) {
        visiblePasswords.delete(user.id);
      } else {
        visiblePasswords.add(user.id);
      }
      renderUsers();
      return;
    }
    if (btn.dataset.action === 'copy-password') {
      copyText(user.password);
      return;
    }
    if (btn.dataset.action === 'copy-username') {
      copyText(user.username);
    }
  });

  (async function init() {
    refreshIcons();
    if (location.protocol === 'file:') {
      showLogin();
      els.adminLoginError.textContent = '当前是直接打开文件。请先启动 node server.js，再访问 http://localhost:3000/admin.html';
      els.adminLoginError.hidden = false;
      return;
    }
    try {
      const session = await apiJson('/api/session');
      if (session.role === 'admin') {
        showDashboard(session.username);
      } else {
        showLogin();
      }
    } catch (error) {
      showLogin();
    }
  })();
})();
