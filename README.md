# 🏠 RentEase — Student Rental & Utility Management System

A complete rental management system built for Kenyan student housing:
- **Web Dashboard** for landlords/caretakers
- **USSD Interface** for students (no app needed)
- **WhatsApp Bot** for students
- **M-Pesa STK Push** payments via Safaricom Daraja
- **Africa's Talking** for USSD + WhatsApp + SMS

---

## 📁 Project Structure

```
student-rental-system/
├── src/
│   ├── server.js              # Express app entry point
│   ├── database/
│   │   ├── db.js              # SQLite connection
│   │   ├── migrate.js         # Schema creation
│   │   └── seed.js            # Demo data
│   ├── middleware/
│   │   └── auth.js            # JWT authentication
│   ├── routes/
│   │   ├── auth.js            # Login/register
│   │   ├── dashboard.js       # Stats & analytics
│   │   ├── properties.js      # Properties & rooms
│   │   ├── students.js        # Tenant management
│   │   ├── invoices.js        # Billing & utilities
│   │   ├── payments.js        # M-Pesa & cash payments
│   │   ├── ussd.js            # Africa's Talking USSD
│   │   └── whatsapp.js        # WhatsApp bot
│   ├── services/
│   │   ├── daraja.js          # Safaricom M-Pesa API
│   │   └── africastalking.js  # AT SMS/WhatsApp
│   └── utils/
│       └── helpers.js         # Utility functions
└── public/                    # Admin Dashboard (HTML/CSS/JS)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js
        ├── app.js
        ├── dashboard.js
        ├── properties.js
        ├── students.js
        ├── invoices.js
        ├── payments.js
        └── utilities.js
```

---

## 🚀 Setup Instructions

### Step 1: Install Node.js
Download and install Node.js (v18+) from: https://nodejs.org/en/download

### Step 2: Install Dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### Step 3: Configure Environment
Edit the `.env` file with your actual API keys:
- **Daraja keys**: https://developer.safaricom.co.ke (create sandbox app)
- **Africa's Talking keys**: https://africastalking.com (create account)

### Step 4: Set Up Database
```bash
npm run migrate
npm run seed
```

### Step 5: Start the Server
```bash
npm run dev
```

Open your browser: **http://localhost:3000**

**Default login:** `admin@rental.com` / `Admin@1234`

---

## 📱 USSD Setup (Africa's Talking)

1. Log in to [Africa's Talking](https://africastalking.com)
2. Go to **USSD** → Create a new service
3. Set the callback URL to: `https://yourdomain.com/api/ussd`
4. Note your USSD code (e.g. `*384*57108#`)
5. Update `AT_USSD_CODE` in `.env`

**Student USSD Menu:**
```
*384*57108#
1. Check Balance
2. Pay Rent (M-Pesa STK Push)
3. Payment History
4. My Room Details
5. Contact Caretaker
```

---

## 💬 WhatsApp Setup (Africa's Talking)

1. In Africa's Talking dashboard → **WhatsApp**
2. Set webhook URL to: `https://yourdomain.com/api/whatsapp`
3. Students message your WhatsApp number with:
   - `hi` / `menu` — Main menu
   - `balance` — Check outstanding balance
   - `pay` — Trigger M-Pesa STK Push
   - `history` — Last 5 payments
   - `room` — Room details
   - `contact` — Caretaker contact

---

## 💳 M-Pesa Daraja Setup

1. Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke)
2. Create an app → get Consumer Key & Secret
3. For sandbox: use shortcode `174379`, passkey from portal
4. Set callback URL (needs public HTTPS — use [ngrok](https://ngrok.com) for testing):
   ```bash
   ngrok http 3000
   # Copy the https URL → set as DARAJA_CALLBACK_URL
   ```
5. For production: change `DARAJA_ENV=production` and use your real paybill

---

## 🌐 Deployment (Production)

### Option A: Railway (Recommended — Free tier)
```bash
npm install -g railway
railway login
railway init
railway up
```

### Option B: Render
1. Push code to GitHub
2. Create new Web Service on render.com
3. Set environment variables from `.env`
4. Build command: `npm install && npm run migrate`
5. Start command: `npm start`

### Option C: VPS (DigitalOcean/Linode)
```bash
# Install PM2 for process management
npm install -g pm2
npm run migrate
pm2 start src/server.js --name rentease
pm2 save
pm2 startup
```

---

## 📊 Admin Dashboard Features

| Feature | Description |
|---------|-------------|
| Dashboard | Occupancy rate, revenue charts, overdue alerts |
| Properties | Add buildings, manage rooms |
| Students | Register tenants, assign rooms, view invoices |
| Invoices | Auto-generate monthly bills, track payments |
| Payments | M-Pesa STK Push, cash recording, history |
| Utilities | Record electricity/water readings per room |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/dashboard/stats` | Dashboard data |
| GET/POST | `/api/properties` | Manage properties |
| GET/POST | `/api/students` | Manage students |
| GET/POST | `/api/invoices` | Manage invoices |
| POST | `/api/invoices/generate` | Bulk generate invoices |
| POST | `/api/payments/mpesa/stk` | Initiate M-Pesa payment |
| POST | `/api/payments/mpesa/callback` | M-Pesa callback (Safaricom) |
| POST | `/api/ussd` | USSD handler (Africa's Talking) |
| POST | `/api/whatsapp` | WhatsApp handler (Africa's Talking) |
