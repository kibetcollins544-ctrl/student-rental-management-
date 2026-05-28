async function loadInvoices() {
  const page = document.getElementById('page-invoices');
  const month = new Date().toISOString().slice(0, 7);
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get(`/invoices?month=${month}`);
    page.innerHTML = `
      <div class="section-header">
        <h3>Invoices — ${month}</h3>
        <div class="flex-gap">
          <input type="month" id="invoice-month-filter" value="${month}" class="btn btn-ghost" style="padding:6px 10px" onchange="filterInvoices(this.value)" />
          <button class="btn btn-success" onclick="generateInvoices()">⚡ Generate This Month</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Room</th><th>Property</th><th>Rent</th><th>Utilities</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="invoices-tbody">
              ${renderInvoiceRows(data)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    page.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}

function renderInvoiceRows(data) {
  if (!data.length) return '<tr><td colspan="10" class="empty-state">No invoices for this period</td></tr>';
  return data.map(i => `
    <tr>
      <td><strong>${i.student_name}</strong><br><span class="text-muted" style="font-size:11px">${fmt.phone(i.student_phone)}</span></td>
      <td>${i.room_number}</td>
      <td>${i.property_name}</td>
      <td>${fmt.currency(i.rent_amount)}</td>
      <td>${fmt.currency(i.utility_amount)}</td>
      <td><strong>${fmt.currency(i.total_amount)}</strong></td>
      <td>${fmt.currency(i.paid_amount)}</td>
      <td style="color:${i.balance > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>${fmt.currency(i.balance)}</strong></td>
      <td>${fmt.badge(i.status)}</td>
      <td>
        <div class="flex-gap">
          <button class="btn btn-primary btn-sm" onclick="initiateMpesa('${i.id}','${i.student_phone}','${i.student_name}',${i.balance})">💳 Pay</button>
          <button class="btn btn-ghost btn-sm" onclick="recordCash('${i.id}',${i.balance})">Cash</button>
        </div>
      </td>
    </tr>`).join('');
}

async function filterInvoices(month) {
  const { data } = await api.get(`/invoices?month=${month}`);
  document.getElementById('invoices-tbody').innerHTML = renderInvoiceRows(data);
}

async function generateInvoices() {
  const month = document.getElementById('invoice-month-filter')?.value || new Date().toISOString().slice(0,7);
  try {
    const res = await api.post('/invoices/generate', { month });
    showToast(res.message);
    loadInvoices();
  } catch (err) { showToast(err.message, 'error'); }
}

function initiateMpesa(invoiceId, phone, name, balance) {
  openModal('Pay via M-Pesa', `
    <form id="modal-form">
      <p style="margin-bottom:16px">Send STK Push to <strong>${fmt.phone(phone)}</strong> for <strong>${fmt.currency(balance)}</strong></p>
      <div class="form-group"><label>Phone Number</label><input name="phone" value="${phone}" placeholder="254712345678" required /></div>
      <button type="submit" class="btn btn-success btn-full">📲 Send M-Pesa Request</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await api.post('/payments/mpesa/stk', { invoice_id: invoiceId, phone: fd.get('phone') });
      showToast(res.message); closeModal();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function recordCash(invoiceId, balance) {
  openModal('Record Cash Payment', `
    <form id="modal-form">
      <div class="form-group"><label>Amount (KES)</label><input name="amount" type="number" value="${balance}" required /></div>
      <button type="submit" class="btn btn-primary btn-full">Record Payment</button>
    </form>
  `);
  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/payments/cash', { invoice_id: invoiceId, amount: Number(fd.get('amount')) });
      showToast('Cash payment recorded'); closeModal(); loadInvoices();
    } catch (err) { showToast(err.message, 'error'); }
  };
}
