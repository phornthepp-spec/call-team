const express = require('express');
const bcrypt = require('bcrypt');
const { getUserByUsername, createUser, insertLoginLog, getLoginLogs, getLoginLogCount, getAllUsers, resetUserPassword } = require('../../Database/db');
const { generateToken, COOKIE_NAME } = require('../middleware/auth');

const router = express.Router();

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';

    const user = getUserByUsername(username);
    if (!user) {
      insertLoginLog({ username, success: false, ip_address: ip, user_agent: ua });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      insertLoginLog({ username, success: false, ip_address: ip, user_agent: ua });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    insertLoginLog({ username, success: true, ip_address: ip, user_agent: ua });

    const token = generateToken(user, !!remember);
    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge,
      path: '/'
    });

    res.json({
      ok: true,
      user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const existing = getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const id = createUser({ username, password, display_name: display_name || username });

    res.json({ ok: true, user: { id, username, display_name: display_name || username } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot — self-service reset, verified by admin password
router.post('/forgot', async (req, res) => {
  try {
    const { username, adminPassword, newPassword } = req.body;

    if (!username || !adminPassword || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    // Verify admin password as authorization
    const admin = getUserByUsername('admin');
    if (!admin) {
      return res.status(500).json({ error: 'Admin account not found' });
    }

    const adminValid = await bcrypt.compare(adminPassword, admin.password_hash);
    if (!adminValid) {
      return res.status(403).json({ error: 'Admin password is incorrect' });
    }

    // Find the target user
    const user = getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Username not found' });
    }

    resetUserPassword(user.id, newPassword);
    res.json({ ok: true, message: 'Password has been reset. You can now login.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    user: { id: req.user.id, username: req.user.username, display_name: req.user.display_name, role: req.user.role }
  });
});

// ---- Admin-only endpoints ----

// GET /api/auth/logs — view login history
router.get('/logs', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const logs = getLoginLogs({ limit, offset });
  const total = getLoginLogCount();
  res.json({ logs, total, limit, offset });
});

// GET /api/auth/users — list all users
router.get('/users', requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.json({ users });
});

// POST /api/auth/reset-password — admin resets a user's password
router.post('/reset-password', requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'userId and newPassword are required' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    resetUserPassword(userId, newPassword);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
