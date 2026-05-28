require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & Middleware ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// ── Static Admin Dashboard ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/students', require('./routes/students'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/ussd', require('./routes/ussd'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

// ── Health Check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Serve Dashboard SPA ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Cron: Auto-generate invoices on 1st of each month ────────────────
cron.schedule('0 8 1 * *', async () => {
  console.log('⏰ Auto-generating monthly invoices...');
  try {
    const db = require('./database/db');
    const { currentMonth, getDueDate, generateId } = require('./utils/helpers');
    const month = currentMonth();
    const dueDate = getDueDate(month);
    const students = db.prepare(`
      SELECT s.id as student_id, s.room_id, r.monthly_rent
      FROM students s JOIN rooms r ON s.room_id = r.id
      WHERE s.status='active' AND s.room_id IS NOT NULL
    `).all();

    let count = 0;
    for (const s of students) {
      const exists = db.prepare('SELECT id FROM invoices WHERE student_id=? AND month=?').get(s.student_id, month);
      if (exists) continue;
      const util = db.prepare("SELECT COALESCE(SUM(amount),0) as t FROM utility_readings WHERE room_id=? AND month=?").get(s.room_id, month);
      const total = s.monthly_rent + (util.t || 0);
      db.prepare('INSERT INTO invoices (id,student_id,room_id,month,rent_amount,utility_amount,total_amount,due_date) VALUES (?,?,?,?,?,?,?,?)')
        .run(generateId(), s.student_id, s.room_id, month, s.monthly_rent, util.t || 0, total, dueDate);
      count++;
    }
    console.log(`✅ Auto-generated ${count} invoices for ${month}`);
  } catch (err) {
    console.error('Cron error:', err.message);
  }
});

// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Student Rental System running on http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}`);
  console.log(`📱 USSD Endpoint: POST http://localhost:${PORT}/api/ussd`);
  console.log(`💬 WhatsApp Endpoint: POST http://localhost:${PORT}/api/whatsapp`);
  console.log(`💳 M-Pesa Callback: POST http://localhost:${PORT}/api/payments/mpesa/callback\n`);
});

module.exports = app;
