async function loadUtilities() {
  const page = document.getElementById('page-utilities');
  const month = new Date().toISOString().slice(0, 7);
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get(`/invoices/utilities/readings?month=${month}`);
    page.innerHTML = `
      <div class="section-header">
        <h3>Utility Readings — ${month}</h3>
        <button class="btn btn-primary" onclick="showAddReadingModal()">+ Add Reading</button>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Room</th><th>Utility</th><th>Previous</th><th>Current</th><th>Units Used</th><th>Rate</th><th>Amount</th><th>Date</th></tr></thead>
            <tbody>
              ${data.length ? data.map(r => `
                <tr>
                  <td><strong>${r.room_number}</strong></td>
                  <td>${r.utility_name}</td>
                  <td>${r.previous_reading}</td>
                  <td>${r.current_reading}</td>
                  <td><strong>${r.units_used}</strong></td>
                  <td>${fmt.currency(r.rate_per_unit)}</td>
                  <td><strong>${fmt.currency(r.amount)}</strong></td>
                  <td>${fmt.date(r.reading_date)}</td>
                </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No utility readings for this month</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    page.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

async function showAddReadingModal() {
  // Load rooms
  const { data: props } = await api.get('/properties');
  let roomOptions = '<option value="">— Select Room —</option>';
  for (const p of props) {
    const { data: rooms } = await api.get(`/properties/${p.id}/rooms`);
    if (rooms.length) {
      roomOptions += `<optgroup label="${p.name}">`;
      rooms.forEach(r => { roomOptions += `<option value="${r.id}">${r.room_number}</option>`; });
      roomOptions += '</optgroup>';
    }
  }

  openModal('Add Utility Reading', `
    <form id="modal-form">
      <div class="form-group"><label>Room</label><select name="room_id" required>${roomOptions}</select></div>
      <div class="form-group"><label>Utility Type</label>
        <select name="utility_type_id" required>
          <option value="ut1">Electricity (KWh)</option>
          <option value="ut2">Water (Units)</option>
          <option value="ut3">Internet (Month)</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Previous Reading</label><input name="previous_reading" type="number" value="0" step="0.01" /></div>
        <div class="form-group"><label>Current Reading</label><input name="current_reading" type="number" step="0.01" required /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Rate per Unit (KES)</label><input name="rate_per_unit" type="number" step="0.01" placeholder="e.g. 25" required /></div>
        <div class="form-group"><label>Reading Date</label><input name="reading_date" type="date" value="${new Date().toISOString().slice(0,10)}" required /></div>
      </div>
      <button type="submit" class="btn btn-primary btn-full">Save Reading</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/invoices/utilities/reading', {
        room_id: fd.get('room_id'),
        utility_type_id: fd.get('utility_type_id'),
        previous_reading: Number(fd.get('previous_reading')),
        current_reading: Number(fd.get('current_reading')),
        rate_per_unit: Number(fd.get('rate_per_unit')),
        reading_date: fd.get('reading_date')
      });
      showToast('Reading saved'); closeModal(); loadUtilities();
    } catch (err) { showToast(err.message, 'error'); }
  };
}
