// ── API Client ────────────────────────────────────────────────────────
const API_BASE = '/api';

const getToken = () => localStorage.getItem('token');

const api = {
  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);

    // Guard against non-JSON responses (e.g. server not running)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server error (${res.status}): API not reachable`);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },
  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  patch: (path, body) => api.request('PATCH', path, body),
  delete: (path) => api.request('DELETE', path),
};

// ── Toast Notifications ───────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── Modal Helpers ─────────────────────────────────────────────────────
function openModal(title, bodyHTML, onSubmit = null) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');

  if (onSubmit) {
    const form = document.getElementById('modal-form');
    if (form) form.addEventListener('submit', onSubmit);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Format Helpers ────────────────────────────────────────────────────
const fmt = {
  currency: (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
  date: (d) => d ? new Date(d).toLocaleDateString('en-KE') : '—',
  phone: (p) => p ? `+${p}` : '—',
  badge: (status) => {
    const map = {
      paid: 'success', active: 'success', occupied: 'success', completed: 'success',
      partial: 'warning', maintenance: 'warning', pending: 'warning',
      unpaid: 'danger', overdue: 'danger', inactive: 'danger', evicted: 'danger', failed: 'danger',
      vacant: 'info', caretaker: 'info', landlord: 'info',
    };
    return `<span class="badge badge-${map[status] || 'gray'}">${status}</span>`;
  }
};
