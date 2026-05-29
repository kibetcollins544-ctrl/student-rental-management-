require('dotenv').config();
const db = require('./db');

console.log('🔧 Running migrations...');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'caretaker',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    room_number TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    type TEXT DEFAULT 'single',
    monthly_rent REAL NOT NULL,
    status TEXT DEFAULT 'vacant',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    id_number TEXT,
    institution TEXT,
    room_id TEXT,
    lease_start DATE,
    lease_end DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS utility_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT DEFAULT 'KWh'
  );

  CREATE TABLE IF NOT EXISTS utility_readings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    utility_type_id TEXT NOT NULL,
    previous_reading REAL DEFAULT 0,
    current_reading REAL NOT NULL,
    rate_per_unit REAL NOT NULL,
    amount REAL NOT NULL,
    reading_date DATE NOT NULL,
    month TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (utility_type_id) REFERENCES utility_types(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    month TEXT NOT NULL,
    rent_amount REAL NOT NULL,
    utility_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    due_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT DEFAULT 'mpesa',
    mpesa_code TEXT,
    mpesa_phone TEXT,
    status TEXT DEFAULT 'pending',
    checkout_request_id TEXT,
    merchant_request_id TEXT,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS ussd_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    student_id TEXT,
    state TEXT DEFAULT 'start',
    data TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    phone TEXT NOT NULL,
    channel TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed utility types
const existing = db.prepare("SELECT id FROM utility_types WHERE id='ut1'").get();
if (!existing) {
  db.prepare("INSERT INTO utility_types (id,name,unit) VALUES (?,?,?)").run('ut1','Electricity','KWh');
  db.prepare("INSERT INTO utility_types (id,name,unit) VALUES (?,?,?)").run('ut2','Water','Units');
  db.prepare("INSERT INTO utility_types (id,name,unit) VALUES (?,?,?)").run('ut3','Internet','Month');
}

console.log('✅ Migration complete');
