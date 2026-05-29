const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const moment = require('moment');

router.get('/stats', auth, (req, res) => {
  try {
    const month = req.query.month || moment().format('YYYY-MM');
    const today = moment().format('YYYY-MM-DD');

    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status='active'").get().c;
    const totalRooms    = db.prepare("SELECT COUNT(*) as c FROM rooms").get().c;
    const occupiedRooms = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE status='occupied'").get().c;
    const vacantRooms   = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE status='vacant'").get().c;

    const invoices = db.prepare(`
      SELECT COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount),0) as total_billed,
        COALESCE(SUM(paid_amount),0) as total_collected,
        COALESCE(SUM(total_amount-paid_amount),0) as total_outstanding,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status IN ('unpaid','overdue') THEN 1 ELSE 0 END) as unpaid_count
      FROM invoices WHERE month=?`).get(month);

    const recentPayments = db.prepare(`
      SELECT p.amount, p.mpesa_code, p.method, p.paid_at, s.name as student_name, i.month
      FROM payments p JOIN students s ON p.student_id=s.id JOIN invoices i ON p.invoice_id=i.id
      WHERE p.status='completed' ORDER BY p.paid_at DESC LIMIT 10`).all();

    const overdueStudents = db.prepare(`
      SELECT s.name, s.phone, i.month, (i.total_amount-i.paid_amount) as balance, i.due_date
      FROM invoices i JOIN students s ON i.student_id=s.id
      WHERE i.status IN ('unpaid','overdue') AND i.due_date < ? ORDER BY i.due_date ASC LIMIT 20`).all(today);

    const monthlyRevenue = db.prepare(`
      SELECT month, SUM(paid_amount) as collected, SUM(total_amount) as billed
      FROM invoices GROUP BY month ORDER BY month DESC LIMIT 6`).all().reverse();

    res.json({ success: true, data: {
      overview: { totalStudents, totalRooms, occupiedRooms, vacantRooms,
        occupancyRate: totalRooms ? Math.round((occupiedRooms/totalRooms)*100) : 0 },
      invoices, recentPayments, overdueStudents, monthlyRevenue
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
