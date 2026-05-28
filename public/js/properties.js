async function loadProperties() {
  const page = document.getElementById('page-properties');
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get('/properties');
    page.innerHTML = `
      <div class="section-header">
        <h3>Properties & Rooms</h3>
        <button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>
      </div>
      ${data.length ? data.map(p => `
        <div class="card mb-16">
          <div class="card-header">
            <div>
              <strong>${p.name}</strong>
              <div class="text-muted" style="font-size:12px;margin-top:2px">📍 ${p.address}</div>
            </div>
            <div class="flex-gap">
              <span class="badge badge-info">${p.occupied_rooms}/${p.total_rooms} occupied</span>
              <button class="btn btn-ghost btn-sm" onclick="loadRooms('${p.id}', '${p.name}')">View Rooms</button>
              <button class="btn btn-primary btn-sm" onclick="showAddRoomModal('${p.id}')">+ Room</button>
            </div>
          </div>
          <div id="rooms-${p.id}"></div>
        </div>`).join('') : '<div class="empty-state"><div class="empty-icon">🏢</div>No properties yet. Add one to get started.</div>'}
    `;
  } catch (err) {
    page.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function loadRooms(propertyId, propertyName) {
  const container = document.getElementById(`rooms-${propertyId}`);
  container.innerHTML = `<div style="padding:12px;color:var(--text-muted)">Loading rooms...</div>`;
  const { data } = await api.get(`/properties/${propertyId}/rooms`);

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Room</th><th>Type</th><th>Rent</th><th>Status</th><th>Tenant</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.length ? data.map(r => `
            <tr>
              <td><strong>${r.room_number}</strong></td>
              <td>${r.type}</td>
              <td>${fmt.currency(r.monthly_rent)}</td>
              <td>${fmt.badge(r.status)}</td>
              <td>${r.tenant_name || '<span class="text-muted">—</span>'}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="showEditRoomModal('${r.id}','${r.room_number}',${r.monthly_rent},'${r.type}','${r.status}')">Edit</button>
              </td>
            </tr>`).join('') : '<tr><td colspan="6" class="empty-state">No rooms added yet</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function showAddPropertyModal() {
  openModal('Add Property', `
    <form id="modal-form">
      <div class="form-group"><label>Property Name</label><input name="name" placeholder="e.g. Sunrise Hostels" required /></div>
      <div class="form-group"><label>Address</label><input name="address" placeholder="e.g. Ngong Road, Nairobi" required /></div>
      <button type="submit" class="btn btn-primary btn-full">Add Property</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/properties', { name: fd.get('name'), address: fd.get('address') });
      showToast('Property added'); closeModal(); loadProperties();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function showAddRoomModal(propertyId) {
  openModal('Add Room', `
    <form id="modal-form">
      <div class="form-row">
        <div class="form-group"><label>Room Number</label><input name="room_number" placeholder="e.g. A101" required /></div>
        <div class="form-group"><label>Floor</label><input name="floor" type="number" value="1" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Type</label>
          <select name="type"><option value="single">Single</option><option value="double">Double</option><option value="bedsitter">Bedsitter</option><option value="studio">Studio</option></select>
        </div>
        <div class="form-group"><label>Monthly Rent (KES)</label><input name="monthly_rent" type="number" placeholder="8000" required /></div>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Add Room</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post(`/properties/${propertyId}/rooms`, {
        room_number: fd.get('room_number'), floor: fd.get('floor'),
        type: fd.get('type'), monthly_rent: Number(fd.get('monthly_rent'))
      });
      showToast('Room added'); closeModal(); loadProperties();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function showEditRoomModal(id, room_number, monthly_rent, type, status) {
  openModal(`Edit Room ${room_number}`, `
    <form id="modal-form">
      <div class="form-group"><label>Monthly Rent (KES)</label><input name="monthly_rent" type="number" value="${monthly_rent}" required /></div>
      <div class="form-group"><label>Type</label>
        <select name="type">
          ${['single','double','bedsitter','studio'].map(t => `<option value="${t}" ${t===type?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Status</label>
        <select name="status">
          ${['occupied','vacant','maintenance'].map(s => `<option value="${s}" ${s===status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Update Room</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.patch(`/properties/rooms/${id}`, {
        monthly_rent: Number(fd.get('monthly_rent')), type: fd.get('type'), status: fd.get('status')
      });
      showToast('Room updated'); closeModal(); loadProperties();
    } catch (err) { showToast(err.message, 'error'); }
  };
}
