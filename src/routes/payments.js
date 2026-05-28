const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { stkPush, stkQuery } = require('../services/daraja');
const { v4: uuidv4 } = require('uuid');

const formatPhone = (phone) => {
  phone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  return phone;
};

router.post('/mpesa/stk', async (req, res) => {
  const { invoice_id, phone } = req.body;
  if (!invoice_id || !phone) return res.status(400).json({ success: false, message: 'invoice_id and phone required' });
  try {
    const invoice = await db('invoices as i').join('students as s', 'i.student_id', 's.id')
      .select('i.*', 's.name as student_name').where('i.id', invoice_id).first();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ success: false, message: 'Invoice already paid' });
    const normalizedPhone = formatPhone(phone);
    const balance = invoice.total_amount - invoice.paid_amount;
    const result = await stkPush({ phone: normalizedPhone, amount: balance, invoiceId: invoice.id, studentName: invoice.student_name });
    const paymentId = uuidv4();
    await db('payments').insert({
      id: paymentId, invoice_id, student_id: invoice.student_id, amount: balance,
      method: 'mpesa', mpesa_phone: normalizedPhone, status: 'pending',
      checkout_request_id: result.CheckoutRequestID, merchant_request_id: result.MerchantRequestID
    });
    res.json({ success: true, message: 'STK Push sent. Check your phone to complete payment.', checkout_request_id: result.CheckoutRequestID, payment_id: paymentId });
  } catch (err) {
    console.error('STK Push error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'Failed to initiate payment', error: err.response?.data });
  }
});

router.post('/mpesa/callback', async (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (!body) return res.status(200).json({ ResultCode: 0 });
  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
  try {
    const payment = await db('payments').where('checkout_request_id', CheckoutRequestID).first();
    if (!payment) return res.status(200).json({ ResultCode: 0 });
    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const mpesaCode = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const paidAmount = items.find(i => i.Name === 'Amount')?.Value;
      await db('payments').where('checkout_request_id', CheckoutRequestID).update({ status: 'completed', mpesa_code: mpesaCode, paid_at: new Date().toISOString() });
      const invoice = await db('invoices').where('id', payment.invoice_id).first();
      const newPaid = (invoice.paid_amount || 0) + (paidAmount || payment.amount);
      const newStatus = newPaid >= invoice.total_amount ? 'paid' : 'partial';
      await db('invoices').where('id', payment.invoice_id).update({ paid_amount: newPaid, status: newStatus });
    } else {
      await db('payments').where('checkout_request_id', CheckoutRequestID).update({ status: 'failed' });
    }
  } catch (err) { console.error('Callback error:', err.message); }
  res.status(200).json({ ResultCode: 0 });
});

router.post('/cash', auth, async (req, res) => {
  const { invoice_id, amount } = req.body;
  if (!invoice_id || !amount) return res.status(400).json({ success: false, message: 'invoice_id and amount required' });
  try {
    const invoice = await db('invoices').where('id', invoice_id).first();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const paymentId = uuidv4();
    await db('payments').insert({ id: paymentId, invoice_id, student_id: invoice.student_id, amount, method: 'cash', status: 'completed', paid_at: new Date().toISOString() });
    const newPaid = (invoice.paid_amount || 0) + Number(amount);
    const newStatus = newPaid >= invoice.total_amount ? 'paid' : 'partial';
    await db('invoices').where('id', invoice_id).update({ paid_amount: newPaid, status: newStatus });
    res.json({ success: true, message: 'Cash payment recorded', payment_id: paymentId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/status/:checkoutId', async (req, res) => {
  try {
    const result = await stkQuery(req.params.checkoutId);
    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: 'Query failed' }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const payments = await db('payments as p')
      .join('students as s', 'p.student_id', 's.id')
      .join('invoices as i', 'p.invoice_id', 'i.id')
      .select('p.*', 's.name as student_name', 'i.month')
      .orderBy('p.created_at', 'desc').limit(200);
    res.json({ success: true, data: payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
