const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { stkPush, stkQuery } = require('../services/daraja');
const { v4: uuidv4 } = require('uuid');

const fmtPhone = p => { p=p.toString().replace(/\s+/g,'').replace(/^\+/,''); if(p.startsWith('0'))p='254'+p.slice(1); if(p.startsWith('7')||p.startsWith('1'))p='254'+p; return p; };

router.post('/mpesa/stk', async (req, res) => {
  try {
    const { invoice_id, phone } = req.body;
    if (!invoice_id||!phone) return res.status(400).json({ success: false, message: 'invoice_id and phone required' });
    const inv = db.prepare(`SELECT i.*,s.name as student_name FROM invoices i JOIN students s ON i.student_id=s.id WHERE i.id=?`).get(invoice_id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (inv.status==='paid') return res.status(400).json({ success: false, message: 'Invoice already paid' });
    const np = fmtPhone(phone);
    const balance = inv.total_amount - inv.paid_amount;
    const result = await stkPush({ phone: np, amount: balance, invoiceId: inv.id, studentName: inv.student_name });
    const pid = uuidv4();
    db.prepare("INSERT INTO payments (id,invoice_id,student_id,amount,method,mpesa_phone,status,checkout_request_id,merchant_request_id) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(pid, invoice_id, inv.student_id, balance, 'mpesa', np, 'pending', result.CheckoutRequestID, result.MerchantRequestID);
    res.json({ success: true, message: 'STK Push sent. Check your phone to complete payment.', checkout_request_id: result.CheckoutRequestID, payment_id: pid });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to initiate payment', error: err.response?.data || err.message }); }
});

router.post('/mpesa/callback', (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return res.status(200).json({ ResultCode: 0 });
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = body;
    const payment = db.prepare('SELECT * FROM payments WHERE checkout_request_id=?').get(CheckoutRequestID);
    if (!payment) return res.status(200).json({ ResultCode: 0 });
    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const mpesaCode = items.find(i=>i.Name==='MpesaReceiptNumber')?.Value;
      const paidAmt   = items.find(i=>i.Name==='Amount')?.Value;
      db.prepare("UPDATE payments SET status='completed',mpesa_code=?,paid_at=CURRENT_TIMESTAMP WHERE checkout_request_id=?").run(mpesaCode, CheckoutRequestID);
      const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(payment.invoice_id);
      const newPaid = (inv.paid_amount||0) + (paidAmt||payment.amount);
      db.prepare("UPDATE invoices SET paid_amount=?,status=? WHERE id=?").run(newPaid, newPaid>=inv.total_amount?'paid':'partial', payment.invoice_id);
    } else {
      db.prepare("UPDATE payments SET status='failed' WHERE checkout_request_id=?").run(CheckoutRequestID);
    }
  } catch (err) { console.error('Callback error:', err.message); }
  res.status(200).json({ ResultCode: 0 });
});

router.post('/cash', auth, (req, res) => {
  try {
    const { invoice_id, amount } = req.body;
    if (!invoice_id||!amount) return res.status(400).json({ success: false, message: 'invoice_id and amount required' });
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoice_id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const pid = uuidv4();
    db.prepare("INSERT INTO payments (id,invoice_id,student_id,amount,method,status,paid_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)")
      .run(pid, invoice_id, inv.student_id, amount, 'cash', 'completed');
    const newPaid = (inv.paid_amount||0) + Number(amount);
    db.prepare("UPDATE invoices SET paid_amount=?,status=? WHERE id=?").run(newPaid, newPaid>=inv.total_amount?'paid':'partial', invoice_id);
    res.json({ success: true, message: 'Cash payment recorded', payment_id: pid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/status/:checkoutId', async (req, res) => {
  try { res.json({ success: true, data: await stkQuery(req.params.checkoutId) }); }
  catch (err) { res.status(500).json({ success: false, message: 'Query failed' }); }
});

router.get('/', auth, (req, res) => {
  try {
    const payments = db.prepare(`SELECT p.*,s.name as student_name,i.month FROM payments p JOIN students s ON p.student_id=s.id JOIN invoices i ON p.invoice_id=i.id ORDER BY p.created_at DESC LIMIT 200`).all();
    res.json({ success: true, data: payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
