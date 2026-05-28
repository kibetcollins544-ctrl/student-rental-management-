const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });
  try {
    const admin = await db('admins').where('email', email).first();
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
      process.env.JWT_SECRET, { expiresIn: '24h' }
    );
    res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/register', async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email || !phone || !password)
    return res.status(400).json({ success: false, message: 'All fields required' });
  try {
    const existing = await db('admins').where('email', email).first();
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
    await db('admins').insert({ id: uuidv4(), name, email, phone, password: bcrypt.hashSync(password, 10), role: role || 'caretaker' });
    res.status(201).json({ success: true, message: 'Admin registered successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
