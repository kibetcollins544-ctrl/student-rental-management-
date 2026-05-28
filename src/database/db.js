require('dotenv').config();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.env.DB_PATH || './src/database/rental.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const knex = require('knex')({
  client: 'sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    }
  }
});

module.exports = knex;
