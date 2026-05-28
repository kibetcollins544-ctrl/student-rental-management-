const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Only landlords can manage admins
const landlordOnly = (req, res, next) => {
  if (req.admin.role !== 'landlord')
    return res.status(403).json({ success: false, message: 'Only landlords can manage admins' });
  next();
};

// GET all admins
router.get('/', auth, landlordOnly, async (req, res) => {
  try {
    const admins = await db('admins')
      .select('id', 'name', 'email', 'phone', 'role', 'created_at')
      .orderBy('created_at', 'desc');
    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add new admin/caretaker
router.post('/', auth, landlordOnly, async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email || !phone || !password)
    return res.status(400).json({ success: false, message: 'Name, email, phone and password are required' });

  const validRoles = ['landlord', 'caretaker'];
  if (role && !validRoles.includes(role))
    return res.status(400).json({ success: false, message: 'Role must be landlord or caretaker' });

  try {
    const existing = await db('admins').where('email', email).first();
    if (existing)
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const existingPhone = await db('admins').where('phone', phone).first();
    if (existingPhone)
      return res.status(409).json({ success: false, message: 'Phone number already registered' });

    const id = uuidv4();
    await db('admins').insert({
      id, name, email, phone,
      password: bcrypt.hashSync(password, 10),
      role: role || 'caretaker'
    });

    res.status(201).json({ success: true, message: `${role || 'caretaker'} account created for ${name}`, id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update admin (name, phone, role)
router.patch('/:id', auth, landlordOnly, async (req, res) => {
  const { name, phone, role } = req.body;
  try {
    const admin = await db('admins').where('id', req.params.id).first();
    if (!admin)
      return res.status(404).json({ success: false, message: 'Admin not found' });

    // Prevent demoting yourself
    if (req.params.id === req.admin.id && role && role !== 'landlord')
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });

    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (role) update.role = role;

    await db('admins').where('id', req.params.id).update(update);
    res.json({ success: true, message: 'Admin updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH reset password
router.patch('/:id/password', auth, landlordOnly, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  try {
    await db('admins').where('id', req.params.id).update({
      password: bcrypt.hashSync(new_password, 10)
    });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE admin
router.delete('/:id', auth, landlordOnly, async (req, res) => {
  if (req.params.id === req.admin.id)
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  try {
    const admin = await db('admins').where('id', req.params.id).first();
    if (!admin)
      return res.status(404).json({ success: false, message: 'Admin not found' });
    await db('admins').where('id', req.params.id).delete();
    res.json({ success: true, message: `${admin.name} removed` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH change own password (any admin)
router.patch('/me/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ success: false, message: 'Current and new password required' });
  if (new_password.length < 6)
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  try {
    const admin = await db('admins').where('id', req.admin.id).first();
    if (!bcrypt.compareSync(current_password, admin.password))
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    await db('admins').where('id', req.admin.id).update({ password: bcrypt.hashSync(new_password, 10) });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
