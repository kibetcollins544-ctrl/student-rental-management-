require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

console.log('🌱 Seeding demo data...');

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rental.com';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const DEFAULT_ADMIN_PHONE = process.env.ADMIN_PHONE || '254712345678';

// Admin
let adminId;
const existingAdmin = db.prepare('SELECT id FROM admins WHERE email=?').get(DEFAULT_ADMIN_EMAIL);
if (!existingAdmin) {
  adminId = uuidv4();
  db.prepare('INSERT INTO admins (id,name,email,phone,password,role) VALUES (?,?,?,?,?,?)')
    .run(adminId, 'John Kamau', DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PHONE, bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10), 'landlord');
  console.log(`✅ Admin created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
} else {
  adminId = existingAdmin.id;
  console.log('ℹ️  Admin already exists');
}

// Property
let propId;
const existingProp = db.prepare("SELECT id FROM properties WHERE name='Sunrise Hostels'").get();
if (!existingProp) {
  propId = uuidv4();
  db.prepare("INSERT INTO properties (id,name,address,admin_id) VALUES (?,?,?,?)")
    .run(propId, 'Sunrise Hostels', 'Ngong Road, Nairobi', adminId);
} else {
  propId = existingProp.id;
}

// Rooms
const roomDefs = [
  { num: 'A101', type: 'single',    rent: 8000  },
  { num: 'A102', type: 'single',    rent: 8000  },
  { num: 'A103', type: 'double',    rent: 12000 },
  { num: 'B201', type: 'bedsitter', rent: 15000 },
  { num: 'B202', type: 'studio',    rent: 18000 },
];
const roomIds = [];
for (const r of roomDefs) {
  const ex = db.prepare("SELECT id FROM rooms WHERE property_id=? AND room_number=?").get(propId, r.num);
  if (!ex) {
    const id = uuidv4();
    db.prepare("INSERT INTO rooms (id,property_id,room_number,type,monthly_rent) VALUES (?,?,?,?,?)")
      .run(id, propId, r.num, r.type, r.rent);
    roomIds.push(id);
  } else {
    roomIds.push(ex.id);
  }
}

// Students
const studentDefs = [
  { name: 'Alice Wanjiku', phone: '254700111222', idx: 0 },
  { name: 'Brian Otieno',  phone: '254700333444', idx: 1 },
  { name: 'Carol Muthoni', phone: '254700555666', idx: 2 },
];
const studentIds = [];
for (const s of studentDefs) {
  const ex = db.prepare("SELECT id FROM students WHERE phone=?").get(s.phone);
  if (!ex) {
    const id = uuidv4();
    db.prepare("INSERT INTO students (id,name,phone,room_id,lease_start,status) VALUES (?,?,?,?,?,?)")
      .run(id, s.name, s.phone, roomIds[s.idx], '2024-01-01', 'active');
    db.prepare("UPDATE rooms SET status='occupied' WHERE id=?").run(roomIds[s.idx]);
    studentIds.push(id);
  } else {
    studentIds.push(ex.id);
  }
}

// Invoices for current month
const month = moment().format('YYYY-MM');
const dueDate = moment(month, 'YYYY-MM').date(5).format('YYYY-MM-DD');
for (let i = 0; i < studentIds.length; i++) {
  const ex = db.prepare("SELECT id FROM invoices WHERE student_id=? AND month=?").get(studentIds[i], month);
  if (!ex) {
    const rent = roomDefs[i].rent;
    db.prepare("INSERT INTO invoices (id,student_id,room_id,month,rent_amount,utility_amount,total_amount,due_date,status) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(uuidv4(), studentIds[i], roomIds[i], month, rent, 1500, rent + 1500, dueDate, 'unpaid');
  }
}

console.log('✅ Seed complete!');
console.log('📧 Login: admin@rental.com / Admin@1234');
