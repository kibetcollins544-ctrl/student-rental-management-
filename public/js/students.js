async function loadStudents() {
  const page = document.getElementById('page-students');
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get('/students');
    page.innerHTML = `
      <div class="section-header">
        <h3>Students / Tenants (${data.length})</h3>
        <button class="btn btn-primary" onclick="showAddStudentModal()">+ Register Student</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Room</th><th>Property</th><th>Rent</th><th>Lease End</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.length ? data.map(s => `
                <tr>
                  <td><strong>${s.name}</strong>${s.institution ? `<br><span class="text-muted" style="font-size:11px">${s.institution}</span>` : ''}</td>
                  <td>${fmt.phone(s.phone)}</td>
                  <td>${s.room_number || '<span class="text-muted">—</span>'}</td>
                  <td>${s.property_name || '<span class="text-muted">—</span>'}</td>
                  <td>${s.monthly_rent ? fmt.currency(s.monthly_rent) : '—'}</td>
                  <td>${fmt.date(s.lease_end)}</td>
                  <td>${fmt.badge(s.status)}</td>
                  <td>
                    <div class="flex-gap">
                      <button class="btn btn-ghost btn-sm" onclick="viewStudent('${s.id}')">View</button>
                      <button class="btn btn-ghost btn-sm" onclick="showEditStudentModal('${s.id}')">Edit</button>
                    </div>
                  </td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No students registered yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    page.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function showAddStudentModal() {
  // Load rooms for dropdown
  const { data: props } = await api.get('/properties');
  let roomOptions = '<option value="">— Select Room —</option>';
  for (const p of props) {
    const { data: rooms } = await api.get(`/properties/${p.id}/rooms`);
    const vacant = rooms.filter(r => r.status === 'vacant');
    if (vacant.length) {
      roomOptions += `<optgroup label="${p.name}">`;
      vacant.forEach(r => { roomOptions += `<option value="${r.id}">${r.room_number} (${r.type}) - ${fmt.currency(r.monthly_rent)}/mo</option>`; });
      roomOptions += '</optgroup>';
    }
  }

  openModal('Register Student', `
    <form id="modal-form">
      <div class="form-row">
        <div class="form-group"><label>Full Name *</label><input name="name" placeholder="Alice Wanjiku" required /></div>
        <div class="form-group"><label>Phone (Safaricom) *</label><input name="phone" placeholder="0712345678" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input name="email" type="email" placeholder="alice@email.com" /></div>
        <div class="form-group"><label>ID / Admission No.</label><input name="id_number" placeholder="12345678" /></div>
      </div>
      <div class="form-group"><label>Institution</label><input name="institution" placeholder="University of Nairobi" /></div>
      <div class="form-group"><label>Assign Room</label><select name="room_id">${roomOptions}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Lease Start</label><input name="lease_start" type="date" /></div>
        <div class="form-group"><label>Lease End</label><input name="lease_end" type="date" /></div>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Register Student</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/students', Object.fromEntries(fd));
      showToast('Student registered'); closeModal(); loadStudents();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

async function viewStudent(id) {
  const { data: s } = await api.get(`/students/${id}`);
  const { data: invoices } = await api.get(`/students/${id}/invoices`);

  openModal(`${s.name}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="text-muted" style="font-size:11px">PHONE</div><strong>${fmt.phone(s.phone)}</strong></div>
      <div><div class="text-muted" style="font-size:11px">STATUS</div>${fmt.badge(s.status)}</div>
      <div><div class="text-muted" style="font-size:11px">ROOM</div><strong>${s.room_number || '—'}</strong></div>
      <div><div class="text-muted" style="font-size:11px">PROPERTY</div><strong>${s.property_name || '—'}</strong></div>
      <div><div class="text-muted" style="font-size:11px">INSTITUTION</div>${s.institution || '—'}</div>
      <div><div class="text-muted" style="font-size:11px">LEASE END</div>${fmt.date(s.lease_end)}</div>
    </div>
    <h4 style="margin-bottom:8px">Invoices</h4>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Month</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          ${invoices.map(i => `<tr>
            <td>${i.month}</td><td>${fmt.currency(i.total_amount)}</td>
            <td>${fmt.currency(i.paid_amount)}</td><td>${fmt.currency(i.balance)}</td>
            <td>${fmt.badge(i.status)}</td>
          </tr>`).join('') || '<tr><td colspan="5" class="empty-state">No invoices</td></tr>'}
        </tbody>
      </table>
    </div>
  `);
}

async function showEditStudentModal(id) {
  const { data: s } = await api.get(`/students/${id}`);
  openModal('Edit Student', `
    <form id="modal-form">
      <div class="form-group"><label>Full Name</label><input name="name" value="${s.name}" /></div>
      <div class="form-group"><label>Institution</label><input name="institution" value="${s.institution || ''}" /></div>
      <div class="form-row">
        <div class="form-group"><label>Lease Start</label><input name="lease_start" type="date" value="${s.lease_start || ''}" /></div>
        <div class="form-group"><label>Lease End</label><input name="lease_end" type="date" value="${s.lease_end || ''}" /></div>
      </div>
      <div class="form-group"><label>Status</label>
        <select name="status">
          ${['active','inactive','evicted'].map(st => `<option value="${st}" ${st===s.status?'selected':''}>${st}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Update Student</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.patch(`/students/${id}`, Object.fromEntries(fd));
      showToast('Student updated'); closeModal(); loadStudents();
    } catch (err) { showToast(err.message, 'error'); }
  };
}
