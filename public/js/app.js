// ── App Bootstrap ─────────────────────────────────────────────────────
const pageLoaders = {
  dashboard: loadDashboard,
  properties: loadProperties,
  students: loadStudents,
  invoices: loadInvoices,
  payments: loadPayments,
  utilities: loadUtilities,
  admins: loadAdmins,
};

const pageTitles = {
  dashboard: 'Dashboard',
  properties: 'Properties & Rooms',
  students: 'Students / Tenants',
  invoices: 'Invoices',
  payments: 'Payments',
  utilities: 'Utility Readings',
  admins: 'Admin Management',
};

function navigateTo(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Show/hide pages
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
    el.classList.toggle('hidden', el.id !== `page-${page}`);
  });

  document.getElementById('page-title').textContent = pageTitles[page] || page;

  if (pageLoaders[page]) pageLoaders[page]();
}

// Nav click handlers
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(el.dataset.page);
  });
});

// ── Auth ──────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    localStorage.setItem('token', data.token);
    localStorage.setItem('admin', JSON.stringify(data.admin));
    initApp(data.admin);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

function initApp(admin) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('admin-name-sidebar').textContent = admin.name;
  document.getElementById('admin-role-badge').textContent = admin.role;
  document.getElementById('current-month-display').textContent = new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });

  // Show Admins nav only for landlords
  document.querySelectorAll('.landlord-only').forEach(el => {
    el.style.display = admin.role === 'landlord' ? 'flex' : 'none';
  });

  navigateTo('dashboard');
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
});

// ── Auto-login if token exists ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const admin = localStorage.getItem('admin');
  if (token && admin) {
    initApp(JSON.parse(admin));
  }
});
