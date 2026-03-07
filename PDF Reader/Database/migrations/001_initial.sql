-- Migration 001: Initial schema

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
