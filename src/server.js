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
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting — only on API routes
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// ── Health Check (before everything else) ────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), port: PORT });
});

// ── API Routes (MUST come before static files) ───────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/invoices',   require('./routes/invoices'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/admins',     require('./routes/admins'));
app.use('/api/ussd',       require('./routes/ussd'));
app.use('/api/whatsapp',   require('./routes/whatsapp'));

// ── 404 handler for unknown /api routes ──────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// ── Static Admin Dashboard (AFTER API routes) ────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Serve Dashboard SPA for all non-API routes ───────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Cron: Auto-generate invoices on 1st of each month ────────────────
cron.schedule('0 8 1 * *', async () => {
  console.log('⏰ Auto-generating monthly invoices...');
  try {
    const db = require('./database/db');
    const { v4: uuidv4 } = require('uuid');
    const moment = require('moment');
    const month = moment().format('YYYY-MM');
    const dueDate = moment(month, 'YYYY-MM').date(5).format('YYYY-MM-DD');

    const students = await db('students as s')
      .join('rooms as r', 's.room_id', 'r.id')
      .select('s.id as student_id', 's.room_id', 'r.monthly_rent')
      .where('s.status', 'active').whereNotNull('s.room_id');

    let count = 0;
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
      count++;
    }
    console.log(`✅ Auto-generated ${count} invoices for ${month}`);
  } catch (err) {
    console.error('Cron error:', err.message);
  }
});

// ── Start Server ──────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 RentEase running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔑 Health:    http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
