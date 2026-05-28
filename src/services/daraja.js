const axios = require('axios');
const moment = require('moment');

const DARAJA_BASE = process.env.DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Get OAuth token
const getAccessToken = async () => {
  const credentials = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await axios.get(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });
  return response.data.access_token;
};

// Generate password for STK Push
const generatePassword = () => {
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const raw = `${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${timestamp}`;
  const password = Buffer.from(raw).toString('base64');
  return { password, timestamp };
};

// STK Push — prompt student to pay on their phone
const stkPush = async ({ phone, amount, invoiceId, studentName }) => {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const payload = {
    BusinessShortCode: process.env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount),
    PartyA: phone,
    PartyB: process.env.DARAJA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: process.env.DARAJA_CALLBACK_URL,
    AccountReference: invoiceId.slice(0, 12),
    TransactionDesc: `Rent payment - ${studentName}`
  };

  const response = await axios.post(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return response.data;
};

// Query STK Push status
const stkQuery = async (checkoutRequestId) => {
  const token = await getAccessToken();
  const { password, timestamp } = generatePassword();

  const response = await axios.post(`${DARAJA_BASE}/mpesa/stkpushquery/v1/query`, {
    BusinessShortCode: process.env.DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return response.data;
};

module.exports = { getAccessToken, stkPush, stkQuery };
