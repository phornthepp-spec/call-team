-- =============================================
-- CRM Performance - Lottery Plus
-- Database Schema
-- Google Sheets based - multiple sheets
-- =============================================

-- ตาราง Users (ผู้ใช้งานระบบ)
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password        VARCHAR(100) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    team            VARCHAR(30) NOT NULL,               -- phonecall, lineoa, lineopc, socialmedia, approve
    role            VARCHAR(20) NOT NULL DEFAULT 'user', -- admin, user
    status          VARCHAR(20) DEFAULT 'active',       -- active, inactive
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง PhoneCall (ทีมโทรศัพท์)
CREATE TABLE phone_call (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    period          VARCHAR(20) NOT NULL,               -- รอบงวด
    agent           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    format_type     VARCHAR(50),
    quantity        INT DEFAULT 0,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง LineOA (ทีม Line OA)
CREATE TABLE line_oa (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    period          VARCHAR(20) NOT NULL,
    agent           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    format_type     VARCHAR(50),
    quantity        INT DEFAULT 0,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง LineOPC (ทีม Line OPC)
CREATE TABLE line_opc (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    period          VARCHAR(20) NOT NULL,
    agent           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    format_type     VARCHAR(50),
    quantity        INT DEFAULT 0,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง SocialMedia (ทีม Social Media)
CREATE TABLE social_media (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    period          VARCHAR(20) NOT NULL,
    agent           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    format_type     VARCHAR(50),
    quantity        INT DEFAULT 0,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Approve (ทีมอนุมัติ)
CREATE TABLE approve (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    period          VARCHAR(20) NOT NULL,
    agent           VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    format_type     VARCHAR(50),
    quantity        INT DEFAULT 0,
    note            TEXT DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง Category (หมวดหมู่งาน)
CREATE TABLE category (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    team            VARCHAR(30) NOT NULL,
    status          VARCHAR(20) DEFAULT 'active'
);

-- ตาราง Format (รูปแบบงาน)
CREATE TABLE format (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    category_id     INT,
    status          VARCHAR(20) DEFAULT 'active'
);

-- ตาราง PasswordResets (คำขอรีเซ็ตรหัสผ่าน)
CREATE TABLE password_resets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',      -- pending, approved, rejected
    requested_at    DATETIME NOT NULL,
    processed_at    DATETIME DEFAULT NULL
);

-- ตาราง LoginLogs (ประวัติการเข้าสู่ระบบ)
CREATE TABLE login_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    username        VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL                -- success, failed
);

-- =============================================
-- Sheet Mapping
-- =============================================
-- Sheet "Users"          → users
-- Sheet "PhoneCall"      → phone_call
-- Sheet "LineOA"         → line_oa
-- Sheet "LineOPC"        → line_opc
-- Sheet "SocialMedia"    → social_media
-- Sheet "Approve"        → approve
-- Sheet "Category"       → category
-- Sheet "Format"         → format
-- Sheet "PasswordResets" → password_resets
-- Sheet "LoginLogs"      → login_logs
