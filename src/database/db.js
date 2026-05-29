/**
 * Database using Node.js built-in sqlite module (node:sqlite)
 * Available in Node.js v22.5+ — zero dependencies, zero compilation.
 * Same synchronous API as better-sqlite3.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(
  process.env.DB_PATH || path.join(__dirname, 'rental.db')
);

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
