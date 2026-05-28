async function loadAdmins() {
  const page = document.getElementById('page-admins');
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get('/admins');
    const currentAdmin = JSON.parse(localStorage.getItem('admin') || '{}');

    page.innerHTML = `
      <div class="section-header">
        <h3>Admin Accounts (${data.length})</h3>
        <div class="flex-gap">
          <button class="btn btn-ghost" onclick="showChangePasswordModal()">🔑 Change My Password</button>
          <button class="btn btn-primary" onclick="showAddAdminModal()">+ Add Admin</button>
        </div>
      </div>

      <!-- Info banner -->
      <div class="info-banner mb-16">
        <span>👑</span>
        <div>
          <strong>Landlord</strong> — Full access: can manage admins, properties, students, invoices and payments.<br>
          <strong>Caretaker</strong> — Can manage students, invoices and payments. Cannot manage admins or delete data.
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.length ? data.map(a => `
                <tr ${a.id === currentAdmin.id ? 'style="background:#f0f9ff"' : ''}>
                  <td>
                    <strong>${a.name}</strong>
                    ${a.id === currentAdmin.id ? '<span class="badge badge-info" style="margin-left:6px">You</span>' : ''}
                  </td>
                  <td>${a.email}</td>
                  <td>+${a.phone}</td>
                  <td>${fmt.badge(a.role)}</td>
                  <td>${fmt.date(a.created_at)}</td>
                  <td>
                    <div class="flex-gap">
                      <button class="btn btn-ghost btn-sm" onclick="showEditAdminModal('${a.id}','${a.name}','${a.phone}','${a.role}')">Edit</button>
                      <button class="btn btn-ghost btn-sm" onclick="showResetPasswordModal('${a.id}','${a.name}')">Reset PWD</button>
                      ${a.id !== currentAdmin.id ? `<button class="btn btn-danger btn-sm" onclick="deleteAdmin('${a.id}','${a.name}')">Remove</button>` : ''}
                    </div>
                  </td>
                </tr>`).join('') : '<tr><td colspan="6" class="empty-state">No admins found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    if (err.message.includes('landlord')) {
      document.getElementById('page-admins').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <p>Only landlords can manage admin accounts.</p>
          <p class="text-muted" style="margin-top:8px">Contact your landlord to add or manage admins.</p>
        </div>`;
    } else {
      document.getElementById('page-admins').innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
    }
  }
}

function showAddAdminModal() {
  openModal('Add Admin / Caretaker', `
    <form id="modal-form">
      <div class="form-row">
        <div class="form-group">
          <label>Full Name *</label>
          <input name="name" placeholder="Jane Mwangi" required />
        </div>
        <div class="form-group">
          <label>Role *</label>
          <select name="role">
            <option value="caretaker">Caretaker</option>
            <option value="landlord">Landlord</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Email Address *</label>
        <input name="email" type="email" placeholder="jane@example.com" required />
      </div>
      <div class="form-group">
        <label>Phone Number (Safaricom) *</label>
        <input name="phone" placeholder="0712345678" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Password *</label>
          <input name="password" type="password" placeholder="Min 6 characters" required minlength="6" />
        </div>
        <div class="form-group">
          <label>Confirm Password *</label>
          <input name="confirm_password" type="password" placeholder="Repeat password" required />
        </div>
      </div>
      <div id="add-admin-error" class="error-msg hidden"></div>
      <button type="submit" class="btn btn-primary btn-full">Create Account</button>
    </form>
  `);

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = document.getElementById('add-admin-error');
    errEl.classList.add('hidden');

    if (fd.get('password') !== fd.get('confirm_password')) {
      errEl.textContent = 'Passwords do not match';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      const res = await api.post('/admins', {
        name: fd.get('name'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        password: fd.get('password'),
        role: fd.get('role')
      });
      showToast(res.message);
      closeModal();
      loadAdmins();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

function showEditAdminModal(id, name, phone, role) {
  openModal(`Edit — ${name}`, `
    <form id="modal-form">
      <div class="form-group">
        <label>Full Name</label>
        <input name="name" value="${name}" required />
      </div>
      <div class="form-group">
        <label>Phone Number</label>
        <input name="phone" value="${phone}" />
      </div>
      <div class="form-group">
        <label>Role</label>
        <select name="role">
          <option value="caretaker" ${role === 'caretaker' ? 'selected' : ''}>Caretaker</option>
          <option value="landlord" ${role === 'landlord' ? 'selected' : ''}>Landlord</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Save Changes</button>
    </form>
  `);

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.patch(`/admins/${id}`, {
        name: fd.get('name'),
        phone: fd.get('phone'),
        role: fd.get('role')
      });
      showToast('Admin updated');
      closeModal();
      loadAdmins();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function showResetPasswordModal(id, name) {
  openModal(`Reset Password — ${name}`, `
    <form id="modal-form">
      <p class="text-muted mb-16">Set a new password for <strong>${name}</strong>. They will need to use this to log in.</p>
      <div class="form-group">
        <label>New Password *</label>
        <input name="new_password" type="password" placeholder="Min 6 characters" required minlength="6" />
      </div>
      <div class="form-group">
        <label>Confirm New Password *</label>
        <input name="confirm_password" type="password" placeholder="Repeat password" required />
      </div>
      <div id="reset-error" class="error-msg hidden"></div>
      <button type="submit" class="btn btn-warning btn-full">Reset Password</button>
    </form>
  `);

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = document.getElementById('reset-error');
    errEl.classList.add('hidden');

    if (fd.get('new_password') !== fd.get('confirm_password')) {
      errEl.textContent = 'Passwords do not match';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await api.patch(`/admins/${id}/password`, { new_password: fd.get('new_password') });
      showToast('Password reset successfully');
      closeModal();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

function showChangePasswordModal() {
  openModal('Change My Password', `
    <form id="modal-form">
      <div class="form-group">
        <label>Current Password *</label>
        <input name="current_password" type="password" placeholder="Your current password" required />
      </div>
      <div class="form-group">
        <label>New Password *</label>
        <input name="new_password" type="password" placeholder="Min 6 characters" required minlength="6" />
      </div>
      <div class="form-group">
        <label>Confirm New Password *</label>
        <input name="confirm_password" type="password" placeholder="Repeat new password" required />
      </div>
      <div id="change-pwd-error" class="error-msg hidden"></div>
      <button type="submit" class="btn btn-primary btn-full">Change Password</button>
    </form>
  `);

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = document.getElementById('change-pwd-error');
    errEl.classList.add('hidden');

    if (fd.get('new_password') !== fd.get('confirm_password')) {
      errEl.textContent = 'Passwords do not match';
      errEl.classList.remove('hidden');
      return;
    }

    try {
      await api.patch('/admins/me/password', {
        current_password: fd.get('current_password'),
        new_password: fd.get('new_password')
      });
      showToast('Password changed successfully');
      closeModal();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  };
}

async function deleteAdmin(id, name) {
  if (!confirm(`Remove ${name} from the system? This cannot be undone.`)) return;
  try {
    await api.delete(`/admins/${id}`);
    showToast(`${name} removed`);
    loadAdmins();
  } catch (err) { showToast(err.message, 'error'); }
}
