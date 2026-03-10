/* ─────────────────────────────────────────────
   MERCX TALENTS — Shared App Utilities
   ───────────────────────────────────────────── */

const API = {
  base: '/api',

  getToken() { return localStorage.getItem('mercx_token'); },
  getUser()  { try { return JSON.parse(localStorage.getItem('mercx_user')); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem('mercx_token', token);
    localStorage.setItem('mercx_user', JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem('mercx_token');
    localStorage.removeItem('mercx_user');
  },

  async req(method, path, body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${this.getToken()}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(this.base + path, opts);
      const data = await res.json();
      if (res.status === 401) { this.clearSession(); window.location = '/pages/login.html'; }
      return data;
    } catch (e) {
      return { success: false, message: 'Network error. Check your connection.' };
    }
  },

  get(path, auth = true)         { return this.req('GET', path, null, auth); },
  post(path, body, auth = true)  { return this.req('POST', path, body, auth); },
  put(path, body, auth = true)   { return this.req('PUT', path, body, auth); },
  delete(path, auth = true)      { return this.req('DELETE', path, null, auth); },
  patch(path, body, auth = true) { return this.req('PATCH', path, body, auth); },
};

/* ─── Auth Guard ─────────────────────────────────────────────── */
function requireAuth(role = null) {
  const user = API.getUser();
  const token = API.getToken();
  if (!token || !user) { window.location = '/pages/login.html'; return null; }
  if (role && user.role !== role) { window.location = '/pages/dashboard.html'; return null; }
  return user;
}

/* ─── Toast Notifications ────────────────────────────────────── */
function toast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:360px;';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const colours = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#6c47ff' };
  const el = document.createElement('div');
  el.style.cssText = `background:#1a1a26;border:1px solid ${colours[type]}44;border-left:3px solid ${colours[type]};
    border-radius:10px;padding:12px 16px;display:flex;gap:10px;align-items:flex-start;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideInRight 0.3s ease;font-size:0.88rem;color:#f0f0ff;
    font-family:'DM Sans',sans-serif;cursor:pointer;`;
  el.innerHTML = `<span style="font-size:1rem;flex-shrink:0">${icons[type]}</span><span style="line-height:1.5">${message}</span>`;
  el.onclick = () => el.remove();
  container.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}

/* ─── Format Helpers ─────────────────────────────────────────── */
function fmt(n) { return Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
function statusBadge(status) {
  const map = {
    pending: ['⏳','#f59e0b'], active: ['🟢','#10b981'], in_progress: ['⚙️','#6c47ff'],
    completed: ['✅','#10b981'], cancelled: ['❌','#ef4444'], disputed: ['⚠️','#ef4444'],
    funded: ['🔒','#00d4aa'], released: ['💸','#10b981'], refunded: ['↩️','#6c47ff'],
    freelancer: ['💼','#6c47ff'], client: ['🏢','#00d4aa'], admin: ['🔴','#ef4444'],
    banned: ['🚫','#ef4444']
  };
  const [icon, color] = map[status] || ['•','#888'];
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;
    background:${color}22;color:${color};font-size:0.78rem;font-weight:600;border:1px solid ${color}44">
    ${icon} ${status}</span>`;
}

/* ─── Modal Helper ───────────────────────────────────────────── */
function showModal(title, html, onConfirm = null) {
  document.getElementById('modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:#12121a;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:slideUp .25s ease">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-family:'Syne',sans-serif;font-size:1.3rem">${title}</h3>
        <button onclick="document.getElementById('modal-overlay').remove()" style="background:none;border:none;color:#888;font-size:1.4rem;cursor:pointer">✕</button>
      </div>
      <div id="modal-body">${html}</div>
      ${onConfirm ? `<div style="display:flex;gap:10px;margin-top:24px">
        <button onclick="document.getElementById('modal-overlay').remove()" style="flex:1;padding:11px;background:#1e1e2e;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#aaa;cursor:pointer;font-family:inherit">Cancel</button>
        <button id="modal-confirm" style="flex:1;padding:11px;background:linear-gradient(135deg,#6c47ff,#5533ee);border:none;border-radius:10px;color:white;font-weight:600;cursor:pointer;font-family:inherit">Confirm</button>
      </div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  if (onConfirm) document.getElementById('modal-confirm').onclick = () => { onConfirm(); overlay.remove(); };
}

/* ─── CSS Injected Once ──────────────────────────────────────── */
(function() {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes slideInRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .spin{animation:spin .8s linear infinite}
  `;
  document.head.appendChild(s);
})();
