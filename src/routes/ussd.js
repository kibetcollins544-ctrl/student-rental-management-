const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { stkPush } = require('../services/daraja');

const formatPhone = (phone) => {
  phone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  return phone;
};
const fmt = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

router.post('/', express.urlencoded({ extended: false }), async (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;
  const phone = formatPhone(phoneNumber);
  let response = '';

  try {
    const student = db.prepare('SELECT * FROM students WHERE phone = ?').get(phone);

    if (text === '') {
      if (!student) {
        response = `END Sorry, ${phoneNumber} is not registered.\nContact your caretaker to register you.`;
      } else {
        response = `CON Welcome ${student.name.split(' ')[0]}!\n1. Check Balance\n2. Pay Rent (M-Pesa)\n3. Payment History\n4. My Room Details\n5. Contact Caretaker`;
      }
    } else if (text === '1') {
      const invoice = student && db.prepare(`SELECT * FROM invoices WHERE student_id = ? AND status != 'paid' ORDER BY month DESC LIMIT 1`).get(student.id);
      if (!invoice) {
        response = `END You have no outstanding balance. All paid up!`;
      } else {
        const balance = invoice.total_amount - invoice.paid_amount;
        response = `END Balance for ${invoice.month}:\nRent: ${fmt(invoice.rent_amount)}\nUtilities: ${fmt(invoice.utility_amount)}\nTotal: ${fmt(invoice.total_amount)}\nPaid: ${fmt(invoice.paid_amount)}\nBalance: ${fmt(balance)}\nDue: ${invoice.due_date}`;
      }
    } else if (text === '2') {
      const invoice = student && db.prepare(`SELECT * FROM invoices WHERE student_id = ? AND status != 'paid' ORDER BY month DESC LIMIT 1`).get(student.id);
      if (!invoice) {
        response = `END No pending invoice found.`;
      } else {
        const balance = invoice.total_amount - invoice.paid_amount;
        response = `CON Pay ${fmt(balance)} for ${invoice.month}\n1. Pay via M-Pesa (STK Push)\n2. Cancel`;
      }
    } else if (text === '2*1') {
      const invoice = student && db.prepare(`SELECT * FROM invoices WHERE student_id = ? AND status != 'paid' ORDER BY month DESC LIMIT 1`).get(student.id);
      if (!invoice) {
        response = `END No pending invoice.`;
      } else {
        try {
          const balance = invoice.total_amount - invoice.paid_amount;
          await stkPush({ phone, amount: balance, invoiceId: invoice.id, studentName: student.name });
          response = `END M-Pesa prompt sent to ${phoneNumber}.\nEnter your PIN to complete payment of ${fmt(balance)}.`;
        } catch (e) {
          console.error('USSD payment error:', e.message || e);
          response = `END Payment initiation failed. Try again or pay cash to caretaker.`;
        }
      }
    } else if (text === '2*2') {
      response = `END Payment cancelled.`;
    } else if (text === '3') {
      const payments = student && db.prepare(`SELECT p.amount, p.mpesa_code, p.paid_at, i.month FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE p.student_id = ? AND p.status = 'completed' ORDER BY p.paid_at DESC LIMIT 5`).all(student.id) || [];
      if (!payments.length) {
        response = `END No payment history found.`;
      } else {
        const lines = payments.map(p => `${p.month}: ${fmt(p.amount)} ${p.mpesa_code ? '(' + p.mpesa_code + ')' : '(cash)'}`).join('\n');
        response = `END Last ${payments.length} payments:\n${lines}`;
      }
    } else if (text === '4') {
      const room = student && student.room_id && db.prepare(`SELECT r.room_number, r.type, r.monthly_rent, p.name as property_name, p.address FROM rooms r JOIN properties p ON r.property_id = p.id WHERE r.id = ?`).get(student.room_id);
      if (!room) {
        response = `END No room assigned. Contact caretaker.`;
      } else {
        response = `END Room: ${room.room_number} (${room.type})\nProperty: ${room.property_name}\nAddress: ${room.address}\nMonthly Rent: ${fmt(room.monthly_rent)}\nLease: ${student.lease_start || 'N/A'} to ${student.lease_end || 'Open'}`;
      }
    } else if (text === '5') {
      const room = student && student.room_id && db.prepare(`SELECT property_id FROM rooms WHERE id = ?`).get(student.room_id);
      const admin = room && db.prepare(`SELECT a.name, a.phone FROM admins a JOIN properties p ON p.admin_id = a.id WHERE p.id = ?`).get(room.property_id);
      response = admin ? `END Caretaker: ${admin.name}\nPhone: +${admin.phone}` : `END Contact your property manager for assistance.`;
    } else {
      response = `END Invalid option. Dial again.`;
    }
  } catch (err) {
    console.error('USSD error:', err.message || err);
    response = `END Service error. Please try again.`;
  }

  res.set('Content-Type', 'text/plain');
  res.send(response);
});

module.exports = router;
