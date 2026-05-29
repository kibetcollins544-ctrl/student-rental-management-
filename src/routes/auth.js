const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const admin = db.prepare('SELECT * FROM admins WHERE email=?').get(email);
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
      process.env.JWT_SECRET || 'rentease_default_secret', { expiresIn: '24h' }
    );
    res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/register', (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !phone || !password) return res.status(400).json({ success: false, message: 'All fields required' });
    const existing = db.prepare('SELECT id FROM admins WHERE email=?').get(email);
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
    db.prepare('INSERT INTO admins (id,name,email,phone,password,role) VALUES (?,?,?,?,?,?)')
      .run(uuidv4(), name, email, phone, bcrypt.hashSync(password, 10), role || 'caretaker');
    res.status(201).json({ success: true, message: 'Admin registered successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
