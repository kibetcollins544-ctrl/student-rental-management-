let revenueChart = null;

async function loadDashboard() {
  const page = document.getElementById('page-dashboard');
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div>Loading dashboard...</div>`;

  try {
    const { data } = await api.get('/dashboard/stats');
    const { overview, invoices, recentPayments, overdueStudents, monthlyRevenue } = data;

    page.innerHTML = `
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div><div class="stat-value">${overview.totalStudents}</div><div class="stat-label">Active Students</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">🏠</div>
          <div><div class="stat-value">${overview.occupiedRooms}/${overview.totalRooms}</div><div class="stat-label">Rooms Occupied</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">💰</div>
          <div><div class="stat-value">${fmt.currency(invoices?.total_collected || 0)}</div><div class="stat-label">Collected This Month</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">⚠️</div>
          <div><div class="stat-value">${fmt.currency(invoices?.total_outstanding || 0)}</div><div class="stat-label">Outstanding</div></div>
        </div>
      </div>

      <!-- Occupancy + Revenue -->
      <div class="grid-2 mb-16">
        <div class="card">
          <div class="card-header"><h3>Occupancy Rate</h3></div>
          <div style="text-align:center; padding: 10px 0;">
            <div style="font-size:48px; font-weight:700; color:var(--primary)">${overview.occupancyRate}%</div>
            <div class="text-muted" style="margin:8px 0">${overview.occupiedRooms} occupied · ${overview.vacantRooms} vacant</div>
            <div class="progress-bar" style="margin-top:12px">
              <div class="progress-fill" style="width:${overview.occupancyRate}%"></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Monthly Revenue</h3></div>
          <canvas id="revenue-chart" height="120"></canvas>
        </div>
      </div>

      <!-- Recent Payments + Overdue -->
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>Recent Payments</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Month</th><th>Amount</th><th>Method</th></tr></thead>
              <tbody>
                ${recentPayments.length ? recentPayments.map(p => `
                  <tr>
                    <td>${p.student_name}</td>
                    <td>${p.month}</td>
                    <td>${fmt.currency(p.amount)}</td>
                    <td>${fmt.badge(p.method)}</td>
                  </tr>`).join('') : '<tr><td colspan="4" class="empty-state">No payments yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>⚠️ Overdue Payments</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Month</th><th>Balance</th><th>Due</th></tr></thead>
              <tbody>
                ${overdueStudents.length ? overdueStudents.map(s => `
                  <tr>
                    <td>${s.name}</td>
                    <td>${s.month}</td>
                    <td style="color:var(--danger);font-weight:600">${fmt.currency(s.balance)}</td>
                    <td>${fmt.date(s.due_date)}</td>
                  </tr>`).join('') : '<tr><td colspan="4" class="empty-state">No overdue payments 🎉</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Revenue Chart
    if (monthlyRevenue.length) {
      const ctx = document.getElementById('revenue-chart').getContext('2d');
      if (revenueChart) revenueChart.destroy();
      revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: monthlyRevenue.map(r => r.month),
          datasets: [
            { label: 'Billed', data: monthlyRevenue.map(r => r.billed), backgroundColor: '#dbeafe', borderColor: '#2563eb', borderWidth: 1 },
            { label: 'Collected', data: monthlyRevenue.map(r => r.collected), backgroundColor: '#dcfce7', borderColor: '#16a34a', borderWidth: 1 }
          ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
      });
    }
  } catch (err) {
    page.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div>${err.message}</div>`;
  }
}
