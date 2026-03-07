-- SCB Payment PDF Reader - Database Schema

-- reports table (เก็บข้อมูล report แต่ละไฟล์)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  total_records INTEGER,
  total_amount REAL,
  success_count INTEGER,
  fail_count INTEGER,
  pages_processed INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- transactions table (เก็บรายการจ่ายเงินแต่ละรายการ)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  seq_no TEXT,
  recipient_name TEXT,
  account TEXT,
  bank_branch TEXT,
  total_amount REAL,
  invoice_amount REAL,
  vat REAL,
  withholding_tax REAL,
  paid_amount REAL,
  fee REAL,
  status TEXT,
  reason TEXT,
  page_num INTEGER,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- users table (ระบบ login)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- login_logs table (เก็บ log การ login)
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
