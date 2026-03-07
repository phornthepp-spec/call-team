const path = require('path');
const fs = require('fs');
// Resolve deps from Back/node_modules since deps are installed there
const backDir = path.join(__dirname, '..', 'Back');
const Database = require(require.resolve('better-sqlite3', { paths: [backDir] }));
const bcrypt = require(require.resolve('bcrypt', { paths: [backDir] }));

const DB_PATH = path.join(__dirname, 'pdf-reader.db');

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables from schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// ---- Helper Functions ----

function insertReport({ filename, total_records, total_amount, success_count, fail_count, pages_processed }) {
  const stmt = db.prepare(`
    INSERT INTO reports (filename, total_records, total_amount, success_count, fail_count, pages_processed)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(filename, total_records, total_amount, success_count, fail_count, pages_processed);
  return result.lastInsertRowid;
}

function insertTransactions(reportId, transactions) {
  const stmt = db.prepare(`
    INSERT INTO transactions (report_id, seq_no, recipient_name, account, bank_branch, total_amount, invoice_amount, vat, withholding_tax, paid_amount, fee, status, reason, page_num)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((txns) => {
    for (const t of txns) {
      stmt.run(
        reportId,
        t.seq_no || null,
        t.recipient_name || null,
        t.account || null,
        t.bank_branch || null,
        t.total_amount || null,
        t.invoice_amount || null,
        t.vat || null,
        t.withholding_tax || null,
        t.paid_amount || null,
        t.fee || null,
        t.status || null,
        t.reason || null,
        t.page_num || null
      );
    }
  });

  insertMany(transactions);
}

function getReports() {
  return db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
}

function getReportById(id) {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

function getTransactionsByReportId(reportId) {
  return db.prepare('SELECT * FROM transactions WHERE report_id = ? ORDER BY id').all(reportId);
}

function deleteReport(id) {
  const result = db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  return result.changes;
}

// ---- User Functions ----

// Migrate: add role column if not exists (for existing DBs)
try {
  db.prepare("SELECT role FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin'").run();
}

function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getAllUsers() {
  return db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY id').all();
}

function createUser({ username, password, display_name, role }) {
  const password_hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
  const result = stmt.run(username, password_hash, display_name || null, role || 'user');
  return result.lastInsertRowid;
}

function resetUserPassword(userId, newPassword) {
  const password_hash = bcrypt.hashSync(newPassword, 10);
  return db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, userId);
}

function seedDefaultUser() {
  const existing = getUserByUsername('admin');
  if (!existing) {
    createUser({ username: 'admin', password: 'admin', display_name: 'Administrator', role: 'admin' });
    console.log('Default user "admin" created (password: admin)');
  }
}

// ---- Login Log Functions ----

function insertLoginLog({ username, success, ip_address, user_agent }) {
  const stmt = db.prepare('INSERT INTO login_logs (username, success, ip_address, user_agent) VALUES (?, ?, ?, ?)');
  return stmt.run(username, success ? 1 : 0, ip_address || null, user_agent || null);
}

function getLoginLogs({ limit = 100, offset = 0 } = {}) {
  return db.prepare('SELECT * FROM login_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

function getLoginLogCount() {
  return db.prepare('SELECT COUNT(*) as count FROM login_logs').get().count;
}

module.exports = {
  db,
  insertReport,
  insertTransactions,
  getReports,
  getReportById,
  getTransactionsByReportId,
  deleteReport,
  getUserByUsername,
  getAllUsers,
  createUser,
  resetUserPassword,
  seedDefaultUser,
  insertLoginLog,
  getLoginLogs,
  getLoginLogCount
};
