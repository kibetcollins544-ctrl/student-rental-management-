const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const formatPhone = (phone) => {
  phone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  return phone;
};

router.get('/', auth, async (req, res) => {
  try {
    const students = await db('students as s')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('properties as p', 'r.property_id', 'p.id')
      .select('s.*', 'r.room_number', 'r.monthly_rent', 'p.name as property_name')
      .orderBy('s.created_at', 'desc');
    res.json({ success: true, data: students });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const student = await db('students as s')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('properties as p', 'r.property_id', 'p.id')
      .select('s.*', 'r.room_number', 'r.monthly_rent', 'p.name as property_name')
      .where('s.id', req.params.id).first();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { name, phone, email, id_number, institution, room_id, lease_start, lease_end } = req.body;
  if (!name || !phone) return res.status(400).json({ success: false, message: 'Name and phone required' });
  try {
    const normalizedPhone = formatPhone(phone);
    const existing = await db('students').where('phone', normalizedPhone).first();
    if (existing) return res.status(409).json({ success: false, message: 'Phone already registered' });
    const id = uuidv4();
    await db('students').insert({ id, name, phone: normalizedPhone, email, id_number, institution, room_id, lease_start, lease_end });
    if (room_id) await db('rooms').where('id', room_id).update({ status: 'occupied' });
    res.status(201).json({ success: true, message: 'Student registered', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/:id', auth, async (req, res) => {
  const { name, email, institution, room_id, lease_start, lease_end, status } = req.body;
  try {
    const student = await db('students').where('id', req.params.id).first();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (room_id && room_id !== student.room_id) {
      if (student.room_id) await db('rooms').where('id', student.room_id).update({ status: 'vacant' });
      await db('rooms').where('id', room_id).update({ status: 'occupied' });
    }
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (institution) update.institution = institution;
    if (room_id) update.room_id = room_id;
    if (lease_start) update.lease_start = lease_start;
    if (lease_end) update.lease_end = lease_end;
    if (status) update.status = status;
    await db('students').where('id', req.params.id).update(update);
    res.json({ success: true, message: 'Student updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/invoices', auth, async (req, res) => {
  try {
    const invoices = await db('invoices as i')
      .join('rooms as r', 'i.room_id', 'r.id')
      .select('i.*', 'r.room_number')
      .where('i.student_id', req.params.id)
      .orderBy('i.month', 'desc');
    res.json({ success: true, data: invoices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
