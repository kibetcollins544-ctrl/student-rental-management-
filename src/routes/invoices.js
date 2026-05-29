const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

router.get('/', auth, (req, res) => {
  try {
    const { month, status } = req.query;
    let sql = `SELECT i.*,(i.total_amount-i.paid_amount) as balance,s.name as student_name,s.phone as student_phone,r.room_number,p.name as property_name FROM invoices i JOIN students s ON i.student_id=s.id JOIN rooms r ON i.room_id=r.id JOIN properties p ON r.property_id=p.id WHERE 1=1`;
    const params = [];
    if (month)  { sql += ' AND i.month=?';  params.push(month); }
    if (status) { sql += ' AND i.status=?'; params.push(status); }
    sql += ' ORDER BY i.created_at DESC';
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/generate', auth, (req, res) => {
  try {
    const month = req.body.month || moment().format('YYYY-MM');
    const dueDate = moment(month,'YYYY-MM').date(5).format('YYYY-MM-DD');
    const students = db.prepare(`SELECT s.id as student_id,s.room_id,r.monthly_rent FROM students s JOIN rooms r ON s.room_id=r.id WHERE s.status='active' AND s.room_id IS NOT NULL`).all();
    let created = 0;
    for (const s of students) {
      if (db.prepare('SELECT id FROM invoices WHERE student_id=? AND month=?').get(s.student_id, month)) continue;
      const util = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM utility_readings WHERE room_id=? AND month=?").get(s.room_id, month);
      const ua = util.t || 0;
      db.prepare("INSERT INTO invoices (id,student_id,room_id,month,rent_amount,utility_amount,total_amount,due_date,status) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(uuidv4(), s.student_id, s.room_id, month, s.monthly_rent, ua, s.monthly_rent+ua, dueDate, 'unpaid');
      created++;
    }
    res.json({ success: true, message: `Generated ${created} invoices for ${month}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/utilities/readings', auth, (req, res) => {
  try {
    const { month, room_id } = req.query;
    let sql = `SELECT ur.*, (ur.current_reading - ur.previous_reading) as units_used, ut.name as utility_name, r.room_number FROM utility_readings ur JOIN utility_types ut ON ur.utility_type_id=ut.id JOIN rooms r ON ur.room_id=r.id WHERE 1=1`;
    const params = [];
    if (month)   { sql += ' AND ur.month=?';   params.push(month); }
    if (room_id) { sql += ' AND ur.room_id=?'; params.push(room_id); }
    sql += ' ORDER BY ur.reading_date DESC';
    res.json({ success: true, data: db.prepare(sql).all(...params) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/utilities/reading', auth, (req, res) => {
  try {
    const { room_id, utility_type_id, previous_reading, current_reading, rate_per_unit, reading_date } = req.body;
    if (!room_id||!utility_type_id||current_reading===undefined||!rate_per_unit) return res.status(400).json({ success: false, message: 'Missing required fields' });
    const month = reading_date ? reading_date.slice(0,7) : moment().format('YYYY-MM');
    const amount = (current_reading - (previous_reading||0)) * rate_per_unit;
    const id = uuidv4();
    db.prepare("INSERT INTO utility_readings (id,room_id,utility_type_id,previous_reading,current_reading,rate_per_unit,amount,reading_date,month) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, room_id, utility_type_id, previous_reading||0, current_reading, rate_per_unit, amount, reading_date||moment().format('YYYY-MM-DD'), month);
    res.status(201).json({ success: true, message: 'Utility reading recorded', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, (req, res) => {
  try {
    const inv = db.prepare(`SELECT i.*,(i.total_amount-i.paid_amount) as balance,s.name as student_name,s.phone,r.room_number,p.name as property_name FROM invoices i JOIN students s ON i.student_id=s.id JOIN rooms r ON i.room_id=r.id JOIN properties p ON r.property_id=p.id WHERE i.id=?`).get(req.params.id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const payments = db.prepare('SELECT * FROM payments WHERE invoice_id=? ORDER BY created_at DESC').all(req.params.id);
    res.json({ success: true, data: { ...inv, payments } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
