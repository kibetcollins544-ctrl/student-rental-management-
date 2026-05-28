require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const generateId = () => uuidv4();
const currentMonth = () => moment().format('YYYY-MM');
const getDueDate = (month) => moment(month, 'YYYY-MM').date(5).format('YYYY-MM-DD');

async function seed() {
  console.log('🌱 Seeding demo data...');

  // Admin
  const existingAdmin = await db('admins').where('email', 'admin@rental.com').first();
  let adminId;
  if (!existingAdmin) {
    adminId = generateId();
    await db('admins').insert({
      id: adminId, name: 'John Kamau',
      email: 'admin@rental.com', phone: '254712345678',
      password: bcrypt.hashSync('Admin@1234', 10), role: 'landlord'
    });
    console.log('✅ Admin created: admin@rental.com / Admin@1234');
  } else {
    adminId = existingAdmin.id;
    console.log('ℹ️  Admin already exists');
  }

  // Property
  const existingProp = await db('properties').where('name', 'Sunrise Hostels').first();
  let propId;
  if (!existingProp) {
    propId = generateId();
    await db('properties').insert({
      id: propId, name: 'Sunrise Hostels',
      address: 'Ngong Road, Nairobi', admin_id: adminId
    });
  } else {
    propId = existingProp.id;
  }

  // Rooms
  const roomDefs = [
    { num: 'A101', type: 'single', rent: 8000 },
    { num: 'A102', type: 'single', rent: 8000 },
    { num: 'A103', type: 'double', rent: 12000 },
    { num: 'B201', type: 'bedsitter', rent: 15000 },
    { num: 'B202', type: 'studio', rent: 18000 },
  ];
  const roomIds = [];
  for (const r of roomDefs) {
    const existing = await db('rooms').where({ property_id: propId, room_number: r.num }).first();
    if (!existing) {
      const id = generateId();
      await db('rooms').insert({ id, property_id: propId, room_number: r.num, type: r.type, monthly_rent: r.rent });
      roomIds.push(id);
    } else {
      roomIds.push(existing.id);
    }
  }

  // Students
  const studentDefs = [
    { name: 'Alice Wanjiku', phone: '254700111222', roomIdx: 0 },
    { name: 'Brian Otieno', phone: '254700333444', roomIdx: 1 },
    { name: 'Carol Muthoni', phone: '254700555666', roomIdx: 2 },
  ];
  const studentIds = [];
  for (const s of studentDefs) {
    const existing = await db('students').where('phone', s.phone).first();
    if (!existing) {
      const id = generateId();
      await db('students').insert({
        id, name: s.name, phone: s.phone,
        room_id: roomIds[s.roomIdx], lease_start: '2024-01-01', status: 'active'
      });
      await db('rooms').where('id', roomIds[s.roomIdx]).update({ status: 'occupied' });
      studentIds.push(id);
    } else {
      studentIds.push(existing.id);
    }
  }

  // Invoices for current month
  const month = currentMonth();
  const dueDate = getDueDate(month);
  for (let i = 0; i < studentIds.length; i++) {
    const existing = await db('invoices').where({ student_id: studentIds[i], month }).first();
    if (!existing) {
      const rent = roomDefs[i].rent;
      await db('invoices').insert({
        id: generateId(), student_id: studentIds[i], room_id: roomIds[i],
        month, rent_amount: rent, utility_amount: 1500,
        total_amount: rent + 1500, due_date: dueDate, status: 'unpaid'
      });
    }
  }

  console.log('✅ Seed complete!');
  console.log('📧 Login: admin@rental.com / Admin@1234');
  await db.destroy();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
