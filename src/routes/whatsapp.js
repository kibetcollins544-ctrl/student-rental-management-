const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { sendWhatsApp } = require('../services/africastalking');
const { stkPush } = require('../services/daraja');

const formatPhone = (phone) => {
  phone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  return phone;
};
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  const { from, message } = req.body;
  if (!from || !message) return res.status(200).send('OK');
  const phone = formatPhone(from.replace('+', ''));
  const text = message.trim().toLowerCase();
  let reply = '';

  try {
    const student = db.prepare('SELECT * FROM students WHERE phone = ?').get(phone);

    if (!student) {
      reply = `Hello! Your number is not registered in our system.\nContact your caretaker to register you.\n\nReply *menu* for help.`;
    } else if (['hi', 'hello', 'menu', 'help', 'start'].includes(text)) {
      reply = `Hello ${student.name.split(' ')[0]}! 👋\n\nWhat would you like to do?\n\n1️⃣ Reply *balance* - Check your balance\n2️⃣ Reply *pay* - Pay rent via M-Pesa\n3️⃣ Reply *history* - Payment history\n4️⃣ Reply *room* - My room details\n5️⃣ Reply *contact* - Caretaker contact`;
    } else if (text === 'balance') {
      const invoice = db.prepare(`SELECT * FROM invoices WHERE student_id = ? AND status != 'paid' ORDER BY month DESC LIMIT 1`).get(student.id);
      if (!invoice) {
        reply = `✅ Great news ${student.name.split(' ')[0]}! You have no outstanding balance.`;
      } else {
        const balance = invoice.total_amount - invoice.paid_amount;
        reply = `📋 *Invoice for ${invoice.month}*\n\nRent: ${fmt(invoice.rent_amount)}\nUtilities: ${fmt(invoice.utility_amount)}\nTotal: ${fmt(invoice.total_amount)}\nPaid: ${fmt(invoice.paid_amount)}\n*Balance: ${fmt(balance)}*\nDue Date: ${invoice.due_date}\n\nReply *pay* to pay now via M-Pesa.`;
      }
    } else if (text === 'pay') {
      const invoice = db.prepare(`SELECT * FROM invoices WHERE student_id = ? AND status != 'paid' ORDER BY month DESC LIMIT 1`).get(student.id);
      if (!invoice) {
        reply = `✅ No pending invoice. You're all paid up!`;
      } else {
        try {
          const balance = invoice.total_amount - invoice.paid_amount;
          await stkPush({ phone, amount: balance, invoiceId: invoice.id, studentName: student.name });
          reply = `📲 M-Pesa payment request sent!\n\nAmount: *${fmt(balance)}*\n\nCheck your phone and enter your M-Pesa PIN to complete payment.\n\nReply *balance* after payment to confirm.`;
        } catch (e) {
          console.error('WhatsApp payment error:', e.message || e);
          reply = `❌ Could not initiate payment. Please try again or pay cash to your caretaker.`;
        }
      }
    } else if (text === 'history') {
      const payments = db.prepare(`SELECT p.amount, p.mpesa_code, p.paid_at, i.month FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE p.student_id = ? AND p.status = 'completed' ORDER BY p.paid_at DESC LIMIT 5`).all(student.id);
      if (!payments.length) {
        reply = `No payment history found.`;
      } else {
        const lines = payments.map(p => `• ${p.month}: ${fmt(p.amount)} ${p.mpesa_code ? '- ' + p.mpesa_code : '(cash)'}`).join('\n');
        reply = `📜 *Your Last ${payments.length} Payments:*\n\n${lines}`;
      }
    } else if (text === 'room') {
      const room = student.room_id && db.prepare(`SELECT r.room_number, r.type, r.monthly_rent, p.name as property_name, p.address FROM rooms r JOIN properties p ON r.property_id = p.id WHERE r.id = ?`).get(student.room_id);
      if (!room) {
        reply = `No room assigned. Contact your caretaker.`;
      } else {
        reply = `🏠 *Your Room Details*\n\nRoom: ${room.room_number} (${room.type})\nProperty: ${room.property_name}\nAddress: ${room.address}\nMonthly Rent: ${fmt(room.monthly_rent)}\nLease Start: ${student.lease_start || 'N/A'}\nLease End: ${student.lease_end || 'Open-ended'}`;
      }
    } else if (text === 'contact') {
      const roomRow = student.room_id && db.prepare(`SELECT property_id FROM rooms WHERE id = ?`).get(student.room_id);
      const admin = roomRow && db.prepare(`SELECT a.name, a.phone FROM admins a JOIN properties p ON p.admin_id = a.id WHERE p.id = ?`).get(roomRow.property_id);
      reply = admin ? `📞 *Caretaker Contact*\n\nName: ${admin.name}\nPhone: +${admin.phone}` : `Contact your property manager for assistance.`;
    } else {
      reply = `I didn't understand that. Reply *menu* to see available options.`;
    }
  } catch (err) {
    console.error('WhatsApp error:', err.message || err);
    reply = `Service error. Please try again later.`;
  }

  try { await sendWhatsApp(phone, reply); } catch (e) { console.error('WA send error:', e.message || e); }
  res.status(200).send('OK');
});

module.exports = router;
