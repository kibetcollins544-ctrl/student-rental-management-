const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const currentMonth = () => moment().format('YYYY-MM');
const getDueDate = (month) => moment(month, 'YYYY-MM').date(5).format('YYYY-MM-DD');

router.get('/', auth, async (req, res) => {
  const { month, status } = req.query;
  try {
    let q = db('invoices as i')
      .join('students as s', 'i.student_id', 's.id')
      .join('rooms as r', 'i.room_id', 'r.id')
      .join('properties as p', 'r.property_id', 'p.id')
      .select('i.*', 's.name as student_name', 's.phone as student_phone', 'r.room_number', 'p.name as property_name')
      .orderBy('i.created_at', 'desc');
    if (month) q = q.where('i.month', month);
    if (status) q = q.where('i.status', status);
    const invoices = await q;
    // compute balance
    invoices.forEach(i => { i.balance = i.total_amount - i.paid_amount; });
    res.json({ success: true, data: invoices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/generate', auth, async (req, res) => {
  const month = req.body.month || currentMonth();
  const dueDate = getDueDate(month);
  try {
    const students = await db('students as s')
      .join('rooms as r', 's.room_id', 'r.id')
      .select('s.id as student_id', 's.room_id', 'r.monthly_rent')
      .where('s.status', 'active').whereNotNull('s.room_id');
    let created = 0;
    for (const s of students) {
      const exists = await db('invoices').where({ student_id: s.student_id, month }).first();
      if (exists) continue;
      const utilRow = await db('utility_readings').where({ room_id: s.room_id, month }).sum('amount as total').first();
      const utilityAmount = utilRow.total || 0;
      const total = s.monthly_rent + utilityAmount;
      await db('invoices').insert({
        id: uuidv4(), student_id: s.student_id, room_id: s.room_id,
        month, rent_amount: s.monthly_rent, utility_amount: utilityAmount,
        total_amount: total, due_date: dueDate, status: 'unpaid'
      });
      created++;
    }
    res.json({ success: true, message: `Generated ${created} invoices for ${month}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await db('invoices as i')
      .join('students as s', 'i.student_id', 's.id')
      .join('rooms as r', 'i.room_id', 'r.id')
      .join('properties as p', 'r.property_id', 'p.id')
      .select('i.*', 's.name as student_name', 's.phone', 'r.room_number', 'p.name as property_name')
      .where('i.id', req.params.id).first();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    invoice.balance = invoice.total_amount - invoice.paid_amount;
    const payments = await db('payments').where('invoice_id', req.params.id).orderBy('created_at', 'desc');
    res.json({ success: true, data: { ...invoice, payments } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/utilities/reading', auth, async (req, res) => {
  const { room_id, utility_type_id, previous_reading, current_reading, rate_per_unit, reading_date } = req.body;
  if (!room_id || !utility_type_id || current_reading === undefined || !rate_per_unit)
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  try {
    const month = reading_date ? reading_date.slice(0, 7) : currentMonth();
    const units = current_reading - (previous_reading || 0);
    const amount = units * rate_per_unit;
    const id = uuidv4();
    await db('utility_readings').insert({
      id, room_id, utility_type_id, previous_reading: previous_reading || 0,
      current_reading, rate_per_unit, amount,
      reading_date: reading_date || moment().format('YYYY-MM-DD'), month
    });
    res.status(201).json({ success: true, message: 'Utility reading recorded', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/utilities/readings', auth, async (req, res) => {
  const { month, room_id } = req.query;
  try {
    let q = db('utility_readings as ur')
      .join('utility_types as ut', 'ur.utility_type_id', 'ut.id')
      .join('rooms as r', 'ur.room_id', 'r.id')
      .select('ur.*', 'ut.name as utility_name', 'r.room_number')
      .orderBy('ur.reading_date', 'desc');
    if (month) q = q.where('ur.month', month);
    if (room_id) q = q.where('ur.room_id', room_id);
    res.json({ success: true, data: await q });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
