const axios = require('axios');

const AT_BASE = 'https://api.africastalking.com/version1';
const AT_SANDBOX = 'https://api.sandbox.africastalking.com/version1';

const getBase = () => process.env.NODE_ENV === 'production' ? AT_BASE : AT_SANDBOX;

const headers = () => ({
  apiKey: process.env.AT_API_KEY,
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
});

// Send SMS
const sendSMS = async (to, message) => {
  const params = new URLSearchParams({
    username: process.env.AT_USERNAME,
    to,
    message,
    from: process.env.AT_SENDER_ID || 'RENTAL'
  });

  const response = await axios.post(`${getBase()}/messaging`, params.toString(), { headers: headers() });
  return response.data;
};

// Send WhatsApp message
const sendWhatsApp = async (to, message) => {
  const params = new URLSearchParams({
    username: process.env.AT_USERNAME,
    productName: process.env.AT_WHATSAPP_PRODUCT || 'rental',
    to: `+${to}`,
    message
  });

  const response = await axios.post(`${getBase()}/messaging/whatsapp`, params.toString(), { headers: headers() });
  return response.data;
};

module.exports = { sendSMS, sendWhatsApp };
