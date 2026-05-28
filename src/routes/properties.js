const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', auth, async (req, res) => {
  try {
    const properties = await db('properties as p')
      .join('admins as a', 'p.admin_id', 'a.id')
      .select('p.*', 'a.name as admin_name')
      .orderBy('p.created_at', 'desc');
    for (const p of properties) {
      p.total_rooms = (await db('rooms').where('property_id', p.id).count('id as c').first()).c;
      p.occupied_rooms = (await db('rooms').where({ property_id: p.id, status: 'occupied' }).count('id as c').first()).c;
    }
    res.json({ success: true, data: properties });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { name, address } = req.body;
  if (!name || !address) return res.status(400).json({ success: false, message: 'Name and address required' });
  try {
    const id = uuidv4();
    await db('properties').insert({ id, name, address, admin_id: req.admin.id });
    res.status(201).json({ success: true, message: 'Property created', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id/rooms', auth, async (req, res) => {
  try {
    const rooms = await db('rooms as r')
      .leftJoin('students as s', function() {
        this.on('s.room_id', 'r.id').andOn(db.raw("s.status = 'active'"));
      })
      .where('r.property_id', req.params.id)
      .select('r.*', 's.name as tenant_name', 's.phone as tenant_phone')
      .orderBy('r.room_number');
    res.json({ success: true, data: rooms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/rooms', auth, async (req, res) => {
  const { room_number, floor, type, monthly_rent } = req.body;
  if (!room_number || !monthly_rent) return res.status(400).json({ success: false, message: 'Room number and rent required' });
  try {
    const id = uuidv4();
    await db('rooms').insert({ id, property_id: req.params.id, room_number, floor: floor || 1, type: type || 'single', monthly_rent });
    res.status(201).json({ success: true, message: 'Room added', id });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.patch('/rooms/:id', auth, async (req, res) => {
  const { monthly_rent, status, type } = req.body;
  try {
    const update = {};
    if (monthly_rent !== undefined) update.monthly_rent = monthly_rent;
    if (status) update.status = status;
    if (type) update.type = type;
    await db('rooms').where('id', req.params.id).update(update);
    res.json({ success: true, message: 'Room updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
