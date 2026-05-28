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
    const student = await db('students').where('phone', phone).first();

    if (!student) {
      reply = `Hello! Your number is not registered in our system.\nContact your caretaker to register you.\n\nReply *menu* for help.`;
    } else if (['hi', 'hello', 'menu', 'help', 'start'].includes(text)) {
      reply = `Hello ${student.name.split(' ')[0]}! 👋\n\nWhat would you like to do?\n\n1️⃣ Reply *balance* - Check your balance\n2️⃣ Reply *pay* - Pay rent via M-Pesa\n3️⃣ Reply *history* - Payment history\n4️⃣ Reply *room* - My room details\n5️⃣ Reply *contact* - Caretaker contact`;
    } else if (text === 'balance') {
      const invoice = await db('invoices').where('student_id', student.id).whereNot('status', 'paid').orderBy('month', 'desc').first();
      if (!invoice) {
        reply = `✅ Great news ${student.name.split(' ')[0]}! You have no outstanding balance.`;
      } else {
        const balance = invoice.total_amount - invoice.paid_amount;
        reply = `📋 *Invoice for ${invoice.month}*\n\nRent: ${fmt(invoice.rent_amount)}\nUtilities: ${fmt(invoice.utility_amount)}\nTotal: ${fmt(invoice.total_amount)}\nPaid: ${fmt(invoice.paid_amount)}\n*Balance: ${fmt(balance)}*\nDue Date: ${invoice.due_date}\n\nReply *pay* to pay now via M-Pesa.`;
      }
    } else if (text === 'pay') {
      const invoice = await db('invoices').where('student_id', student.id).whereNot('status', 'paid').orderBy('month', 'desc').first();
      if (!invoice) {
        reply = `✅ No pending invoice. You're all paid up!`;
      } else {
        try {
          const balance = invoice.total_amount - invoice.paid_amount;
          await stkPush({ phone, amount: balance, invoiceId: invoice.id, studentName: student.name });
          reply = `📲 M-Pesa payment request sent!\n\nAmount: *${fmt(balance)}*\n\nCheck your phone and enter your M-Pesa PIN to complete payment.\n\nReply *balance* after payment to confirm.`;
        } catch (e) {
          reply = `❌ Could not initiate payment. Please try again or pay cash to your caretaker.`;
        }
      }
    } else if (text === 'history') {
      const payments = await db('payments as p').join('invoices as i', 'p.invoice_id', 'i.id')
        .select('p.amount', 'p.mpesa_code', 'p.paid_at', 'i.month')
        .where('p.student_id', student.id).where('p.status', 'completed')
        .orderBy('p.paid_at', 'desc').limit(5);
      if (!payments.length) {
        reply = `No payment history found.`;
      } else {
        const lines = payments.map(p => `• ${p.month}: ${fmt(p.amount)} ${p.mpesa_code ? '- ' + p.mpesa_code : '(cash)'}`).join('\n');
        reply = `📜 *Your Last ${payments.length} Payments:*\n\n${lines}`;
      }
    } else if (text === 'room') {
      const room = student.room_id ? await db('rooms as r').join('properties as p', 'r.property_id', 'p.id')
        .select('r.room_number', 'r.type', 'r.monthly_rent', 'p.name as property_name', 'p.address')
        .where('r.id', student.room_id).first() : null;
      if (!room) {
        reply = `No room assigned. Contact your caretaker.`;
      } else {
        reply = `🏠 *Your Room Details*\n\nRoom: ${room.room_number} (${room.type})\nProperty: ${room.property_name}\nAddress: ${room.address}\nMonthly Rent: ${fmt(room.monthly_rent)}\nLease Start: ${student.lease_start || 'N/A'}\nLease End: ${student.lease_end || 'Open-ended'}`;
      }
    } else if (text === 'contact') {
      const roomRow = student.room_id ? await db('rooms').where('id', student.room_id).first() : null;
      const admin = roomRow ? await db('admins as a').join('properties as p', 'p.admin_id', 'a.id').select('a.name', 'a.phone').where('p.id', roomRow.property_id).first() : null;
      reply = admin ? `📞 *Caretaker Contact*\n\nName: ${admin.name}\nPhone: +${admin.phone}` : `Contact your property manager for assistance.`;
    } else {
      reply = `I didn't understand that. Reply *menu* to see available options.`;
    }
  } catch (err) {
    console.error('WhatsApp error:', err.message);
    reply = `Service error. Please try again later.`;
  }

  try { await sendWhatsApp(phone, reply); } catch (e) { console.error('WA send error:', e.message); }
  res.status(200).send('OK');
});

module.exports = router;
