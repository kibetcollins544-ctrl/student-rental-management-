const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const moment = require('moment');

router.get('/stats', auth, async (req, res) => {
  const month = req.query.month || moment().format('YYYY-MM');
  try {
    const totalStudents = (await db('students').where('status', 'active').count('id as c').first()).c;
    const totalRooms = (await db('rooms').count('id as c').first()).c;
    const occupiedRooms = (await db('rooms').where('status', 'occupied').count('id as c').first()).c;
    const vacantRooms = (await db('rooms').where('status', 'vacant').count('id as c').first()).c;

    const invRows = await db('invoices').where('month', month)
      .select(
        db.raw('COUNT(*) as total_invoices'),
        db.raw('SUM(total_amount) as total_billed'),
        db.raw('SUM(paid_amount) as total_collected'),
        db.raw('SUM(total_amount - paid_amount) as total_outstanding'),
        db.raw("SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count"),
        db.raw("SUM(CASE WHEN status IN ('unpaid','overdue') THEN 1 ELSE 0 END) as unpaid_count")
      ).first();

    const recentPayments = await db('payments as p')
      .join('students as s', 'p.student_id', 's.id')
      .join('invoices as i', 'p.invoice_id', 'i.id')
      .select('p.amount', 'p.mpesa_code', 'p.method', 'p.paid_at', 's.name as student_name', 'i.month')
      .where('p.status', 'completed').orderBy('p.paid_at', 'desc').limit(10);

    const today = moment().format('YYYY-MM-DD');
    const overdueStudents = await db('invoices as i')
      .join('students as s', 'i.student_id', 's.id')
      .select('s.name', 's.phone', 'i.month', db.raw('i.total_amount - i.paid_amount as balance'), 'i.due_date')
      .whereIn('i.status', ['unpaid', 'overdue'])
      .where('i.due_date', '<', today)
      .orderBy('i.due_date', 'asc').limit(20);

    const monthlyRevenue = await db('invoices')
      .select('month', db.raw('SUM(paid_amount) as collected'), db.raw('SUM(total_amount) as billed'))
      .groupBy('month').orderBy('month', 'desc').limit(6);

    res.json({
      success: true,
      data: {
        overview: { totalStudents, totalRooms, occupiedRooms, vacantRooms,
          occupancyRate: totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0 },
        invoices: invRows,
        recentPayments,
        overdueStudents,
        monthlyRevenue: monthlyRevenue.reverse()
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
