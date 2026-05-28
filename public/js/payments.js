async function loadPayments() {
  const page = document.getElementById('page-payments');
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading...</div>`;

  try {
    const { data } = await api.get('/payments');
    page.innerHTML = `
      <div class="section-header">
        <h3>Payment History</h3>
        <span class="badge badge-info">${data.length} transactions</span>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Month</th><th>Amount</th><th>Method</th><th>M-Pesa Code</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${data.length ? data.map(p => `
                <tr>
                  <td><strong>${p.student_name}</strong></td>
                  <td>${p.month}</td>
                  <td><strong>${fmt.currency(p.amount)}</strong></td>
                  <td>${fmt.badge(p.method)}</td>
                  <td>${p.mpesa_code || '<span class="text-muted">—</span>'}</td>
                  <td>${fmt.badge(p.status)}</td>
                  <td>${p.paid_at ? new Date(p.paid_at).toLocaleString('en-KE') : fmt.date(p.created_at)}</td>
                </tr>`).join('') : '<tr><td colspan="7" class="empty-state">No payments recorded yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    page.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
}
