const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', auth, (req, res) => {
  try {
    const props = db.prepare(`SELECT p.*,a.name as admin_name FROM properties p JOIN admins a ON p.admin_id=a.id ORDER BY p.created_at DESC`).all();
    for (const p of props) {
      p.total_rooms    = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE property_id=?").get(p.id).c;
      p.occupied_rooms = db.prepare("SELECT COUNT(*) as c FROM rooms WHERE property_id=? AND status='occupied'").get(p.id).c;
    }
    res.json({ success: true, data: props });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name || !address) return res.status(400).json({ success: false, message: 'Name and address required' });
    const id = uuidv4();
    db.prepare("INSERT INTO properties (id,name,address,admin_id) VALUES (?,?,?,?)").run(id, name, address, req.admin.id);
    res.status(201).json({ success: true, message: 'Property created', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/rooms', auth, (req, res) => {
  try {
    const rooms = db.prepare(`
      SELECT r.*, s.name as tenant_name, s.phone as tenant_phone
      FROM rooms r LEFT JOIN students s ON s.room_id=r.id AND s.status='active'
      WHERE r.property_id=? ORDER BY r.room_number`).all(req.params.id);
    res.json({ success: true, data: rooms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/rooms', auth, (req, res) => {
  try {
    const { room_number, floor, type, monthly_rent } = req.body;
    if (!room_number || !monthly_rent) return res.status(400).json({ success: false, message: 'Room number and rent required' });
    const id = uuidv4();
    db.prepare("INSERT INTO rooms (id,property_id,room_number,floor,type,monthly_rent) VALUES (?,?,?,?,?,?)")
      .run(id, req.params.id, room_number, floor||1, type||'single', monthly_rent);
    res.status(201).json({ success: true, message: 'Room added', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/rooms/:id', auth, (req, res) => {
  try {
    const { monthly_rent, status, type } = req.body;
    const update = {};
    if (monthly_rent !== undefined) update.monthly_rent = monthly_rent;
    if (status) update.status = status;
    if (type) update.type = type;
    const sets = Object.keys(update).map(k => `${k}=?`).join(',');
    if (sets) db.prepare(`UPDATE rooms SET ${sets} WHERE id=?`).run(...Object.values(update), req.params.id);
    res.json({ success: true, message: 'Room updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
