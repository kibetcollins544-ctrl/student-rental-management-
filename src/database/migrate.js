require('dotenv').config();
const db = require('./db');

async function migrate() {
  console.log('🔧 Running migrations...');

  await db.schema.createTableIfNotExists('admins', t => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('email').unique().notNullable();
    t.string('phone').unique().notNullable();
    t.string('password').notNullable();
    t.string('role').defaultTo('caretaker');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('properties', t => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('address').notNullable();
    t.string('admin_id').notNullable().references('id').inTable('admins');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('rooms', t => {
    t.string('id').primary();
    t.string('property_id').notNullable().references('id').inTable('properties');
    t.string('room_number').notNullable();
    t.integer('floor').defaultTo(1);
    t.string('type').defaultTo('single');
    t.float('monthly_rent').notNullable();
    t.string('status').defaultTo('vacant');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('students', t => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('phone').unique().notNullable();
    t.string('email');
    t.string('id_number').unique();
    t.string('institution');
    t.string('room_id').references('id').inTable('rooms');
    t.date('lease_start');
    t.date('lease_end');
    t.string('status').defaultTo('active');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('utility_types', t => {
    t.string('id').primary();
    t.string('name').notNullable();
    t.string('unit').defaultTo('KWh');
  });

  await db.schema.createTableIfNotExists('utility_readings', t => {
    t.string('id').primary();
    t.string('room_id').notNullable().references('id').inTable('rooms');
    t.string('utility_type_id').notNullable().references('id').inTable('utility_types');
    t.float('previous_reading').defaultTo(0);
    t.float('current_reading').notNullable();
    t.float('rate_per_unit').notNullable();
    t.float('amount');
    t.date('reading_date').notNullable();
    t.string('month').notNullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('invoices', t => {
    t.string('id').primary();
    t.string('student_id').notNullable().references('id').inTable('students');
    t.string('room_id').notNullable().references('id').inTable('rooms');
    t.string('month').notNullable();
    t.float('rent_amount').notNullable();
    t.float('utility_amount').defaultTo(0);
    t.float('total_amount').notNullable();
    t.float('paid_amount').defaultTo(0);
    t.string('status').defaultTo('unpaid');
    t.date('due_date').notNullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('payments', t => {
    t.string('id').primary();
    t.string('invoice_id').notNullable().references('id').inTable('invoices');
    t.string('student_id').notNullable().references('id').inTable('students');
    t.float('amount').notNullable();
    t.string('method').defaultTo('mpesa');
    t.string('mpesa_code');
    t.string('mpesa_phone');
    t.string('status').defaultTo('pending');
    t.string('checkout_request_id');
    t.string('merchant_request_id');
    t.timestamp('paid_at');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('ussd_sessions', t => {
    t.string('id').primary();
    t.string('session_id').unique().notNullable();
    t.string('phone').notNullable();
    t.string('student_id');
    t.string('state').defaultTo('start');
    t.text('data').defaultTo('{}');
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.timestamp('updated_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('notifications', t => {
    t.string('id').primary();
    t.string('student_id');
    t.string('phone').notNullable();
    t.string('channel');
    t.text('message').notNullable();
    t.string('status').defaultTo('sent');
    t.timestamp('sent_at').defaultTo(db.fn.now());
  });

  // Seed utility types
  const existing = await db('utility_types').where('id', 'ut1').first();
  if (!existing) {
    await db('utility_types').insert([
      { id: 'ut1', name: 'Electricity', unit: 'KWh' },
      { id: 'ut2', name: 'Water', unit: 'Units' },
      { id: 'ut3', name: 'Internet', unit: 'Month' }
    ]);
  }

  console.log('✅ Migration complete');
  await db.destroy();
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
