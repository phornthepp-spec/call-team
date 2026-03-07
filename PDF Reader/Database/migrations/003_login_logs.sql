-- Migration 003: Add login_logs table + role column to users
CREATE TABLE IF NOT EXISTS login_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add role column to users (ignore if already exists)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, handled in db.js
