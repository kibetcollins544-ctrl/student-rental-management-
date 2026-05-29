const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const landlordOnly = (req, res, next) => {
  if (req.admin.role !== 'landlord') return res.status(403).json({ success: false, message: 'Only landlords can manage admins' });
  next();
};

router.get('/', auth, landlordOnly, (req, res) => {
  try {
    res.json({ success: true, data: db.prepare('SELECT id,name,email,phone,role,created_at FROM admins ORDER BY created_at DESC').all() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, landlordOnly, (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name||!email||!phone||!password) return res.status(400).json({ success: false, message: 'Name, email, phone and password required' });
    if (db.prepare('SELECT id FROM admins WHERE email=?').get(email)) return res.status(409).json({ success: false, message: 'Email already registered' });
    if (db.prepare('SELECT id FROM admins WHERE phone=?').get(phone)) return res.status(409).json({ success: false, message: 'Phone already registered' });
    const id = uuidv4();
    db.prepare("INSERT INTO admins (id,name,email,phone,password,role) VALUES (?,?,?,?,?,?)").run(id, name, email, phone, bcrypt.hashSync(password,10), role||'caretaker');
    res.status(201).json({ success: true, message: `${role||'caretaker'} account created for ${name}`, id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/me/password', auth, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password||!new_password) return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.admin.id);
    if (!bcrypt.compareSync(current_password, admin.password)) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    db.prepare('UPDATE admins SET password=? WHERE id=?').run(bcrypt.hashSync(new_password,10), req.admin.id);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id', auth, landlordOnly, (req, res) => {
  try {
    const { name, phone, role } = req.body;
    if (!db.prepare('SELECT id FROM admins WHERE id=?').get(req.params.id)) return res.status(404).json({ success: false, message: 'Admin not found' });
    if (req.params.id===req.admin.id && role && role!=='landlord') return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    db.prepare(`UPDATE admins SET name=COALESCE(?,name),phone=COALESCE(?,phone),role=COALESCE(?,role) WHERE id=?`).run(name||null,phone||null,role||null,req.params.id);
    res.json({ success: true, message: 'Admin updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id/password', auth, landlordOnly, (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password||new_password.length<6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    db.prepare('UPDATE admins SET password=? WHERE id=?').run(bcrypt.hashSync(new_password,10), req.params.id);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, landlordOnly, (req, res) => {
  try {
    if (req.params.id===req.admin.id) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    db.prepare('DELETE FROM admins WHERE id=?').run(req.params.id);
    res.json({ success: true, message: `${admin.name} removed` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
