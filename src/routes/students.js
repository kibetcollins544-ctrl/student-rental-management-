const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const fmtPhone = p => { p=p.toString().replace(/\s+/g,'').replace(/^\+/,''); if(p.startsWith('0'))p='254'+p.slice(1); if(p.startsWith('7')||p.startsWith('1'))p='254'+p; return p; };

router.get('/', auth, (req, res) => {
  try {
    const students = db.prepare(`SELECT s.*,r.room_number,r.monthly_rent,p.name as property_name FROM students s LEFT JOIN rooms r ON s.room_id=r.id LEFT JOIN properties p ON r.property_id=p.id ORDER BY s.created_at DESC`).all();
    res.json({ success: true, data: students });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, (req, res) => {
  try {
    const s = db.prepare(`SELECT s.*,r.room_number,r.monthly_rent,p.name as property_name FROM students s LEFT JOIN rooms r ON s.room_id=r.id LEFT JOIN properties p ON r.property_id=p.id WHERE s.id=?`).get(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: s });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, (req, res) => {
  try {
    const { name, phone, email, id_number, institution, room_id, lease_start, lease_end } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone required' });
    const np = fmtPhone(phone);
    if (db.prepare('SELECT id FROM students WHERE phone=?').get(np)) return res.status(409).json({ success: false, message: 'Phone already registered' });
    const id = uuidv4();
    db.prepare("INSERT INTO students (id,name,phone,email,id_number,institution,room_id,lease_start,lease_end) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, name, np, email||null, id_number||null, institution||null, room_id||null, lease_start||null, lease_end||null);
    if (room_id) db.prepare("UPDATE rooms SET status='occupied' WHERE id=?").run(room_id);
    res.status(201).json({ success: true, message: 'Student registered', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id', auth, (req, res) => {
  try {
    const { name, email, institution, room_id, lease_start, lease_end, status } = req.body;
    const s = db.prepare('SELECT * FROM students WHERE id=?').get(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Student not found' });
    if (room_id && room_id !== s.room_id) {
      if (s.room_id) db.prepare("UPDATE rooms SET status='vacant' WHERE id=?").run(s.room_id);
      db.prepare("UPDATE rooms SET status='occupied' WHERE id=?").run(room_id);
    }
    db.prepare(`UPDATE students SET name=COALESCE(?,name),email=COALESCE(?,email),institution=COALESCE(?,institution),room_id=COALESCE(?,room_id),lease_start=COALESCE(?,lease_start),lease_end=COALESCE(?,lease_end),status=COALESCE(?,status) WHERE id=?`)
      .run(name||null,email||null,institution||null,room_id||null,lease_start||null,lease_end||null,status||null,req.params.id);
    res.json({ success: true, message: 'Student updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/invoices', auth, (req, res) => {
  try {
    const invoices = db.prepare(`SELECT i.*,(i.total_amount-i.paid_amount) as balance,r.room_number FROM invoices i JOIN rooms r ON i.room_id=r.id WHERE i.student_id=? ORDER BY i.month DESC`).all(req.params.id);
    res.json({ success: true, data: invoices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
