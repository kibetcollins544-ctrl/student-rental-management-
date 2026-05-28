const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const generateId = () => uuidv4();

const currentMonth = () => moment().format('YYYY-MM');

const formatCurrency = (amount) => `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const formatPhone = (phone) => {
  // Normalize to 254XXXXXXXXX format
  phone = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (phone.startsWith('7') || phone.startsWith('1')) phone = '254' + phone;
  return phone;
};

const getDueDate = (month) => {
  // Due on 5th of the month
  return moment(month, 'YYYY-MM').date(5).format('YYYY-MM-DD');
};

const isOverdue = (dueDate) => moment().isAfter(moment(dueDate));

module.exports = { generateId, currentMonth, formatCurrency, formatPhone, getDueDate, isOverdue };
