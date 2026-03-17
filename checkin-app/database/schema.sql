-- =============================================
-- Check-in App Database Schema
-- Google Sheets: Summary sheet
-- Sheet ID: 11WHnqFbA1Us2dNSIkucYEd-pgbSyPEb4u39YNtor6jY
-- =============================================

-- ตาราง attendees (ผู้เข้าร่วมงาน)
-- แมปกับ Google Sheet "Summary" คอลัมน์ A-P

CREATE TABLE attendees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    order_no        INT NOT NULL,                           -- A: ลำดับ
    member_id       VARCHAR(20) DEFAULT '',                 -- B: รหัสสมาชิก
    channel         VARCHAR(50) DEFAULT '',                 -- C: ช่องทาง (Facebook, Walk-in, etc.)
    name            VARCHAR(100) NOT NULL,                  -- D: ชื่อ-นามสกุล
    phone           VARCHAR(20) DEFAULT '',                 -- E: เบอร์โทร
    type            VARCHAR(30) DEFAULT 'ผู้สมัคร',          -- F: ผู้สมัคร / ผู้ติดตาม
    call_status     VARCHAR(30) DEFAULT '',                 -- G: สถานะการโทร (ส่งแล้ว, etc.)
    confirmed       VARCHAR(30) DEFAULT '',                 -- H: ยืนยัน (โทรแล้ว, etc.)
    shirt_size      VARCHAR(30) DEFAULT '',                 -- I: ไซส์เสื้อ / สถานะสิทธิ์
    col_j           VARCHAR(50) DEFAULT '',                 -- J: (reserved)
    visited         VARCHAR(30) DEFAULT '',                 -- K: เคยมา/ไม่เคยมา
    note            TEXT DEFAULT '',                        -- L: หมายเหตุ
    col_m           VARCHAR(50) DEFAULT '',                 -- M: (reserved)
    checkin_status  VARCHAR(30) DEFAULT '',                 -- N: สถานะเช็คอิน (เช็คอินแล้ว)
    checkin_time    DATETIME DEFAULT NULL,                  -- O: เวลาเช็คอิน
    table_no        VARCHAR(10) DEFAULT '',                 -- P: หมายเลขโต๊ะ
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Column Mapping: Google Sheet → Database
-- =============================================
-- A (col 1)  → order_no        ลำดับ
-- B (col 2)  → member_id       รหัสสมาชิก
-- C (col 3)  → channel         ช่องทาง
-- D (col 4)  → name            ชื่อ-นามสกุล
-- E (col 5)  → phone           เบอร์โทร
-- F (col 6)  → type            ผู้สมัคร/ผู้ติดตาม
-- G (col 7)  → call_status     สถานะการโทร
-- H (col 8)  → confirmed       ยืนยัน
-- I (col 9)  → shirt_size      ไซส์เสื้อ/สถานะสิทธิ์
-- J (col 10) → col_j           (reserved)
-- K (col 11) → visited         เคยมา/ไม่เคยมา
-- L (col 12) → note            หมายเหตุ
-- M (col 13) → col_m           (reserved)
-- N (col 14) → checkin_status  สถานะเช็คอิน
-- O (col 15) → checkin_time    เวลาเช็คอิน
-- P (col 16) → table_no        หมายเลขโต๊ะ

-- =============================================
-- Data Validation Rules (from Google Sheet)
-- =============================================
-- channel:  Facebook, Line, Walk-in, อื่นๆ
-- type:     ผู้สมัคร, ผู้ติดตาม
-- visited:  เคยมา, ไม่เคยมา
-- checkin_status: เช็คอินแล้ว, (empty = ยังไม่เช็คอิน)
