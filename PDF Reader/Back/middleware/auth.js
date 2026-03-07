const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pdf-reader-secret-key-change-in-production';
const TOKEN_EXPIRY = '8h';
const COOKIE_NAME = 'token';
const BASE = '/pdf-reader';

// Paths that don't require authentication (relative to base path)
const WHITELIST = ['/login.html', '/api/auth/login', '/api/auth/logout', '/api/auth/register', '/api/auth/forgot'];

function generateToken(user, remember) {
  return jwt.sign(
    { id: user.id, username: user.username, display_name: user.display_name, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: remember ? '30d' : TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authGate(req, res, next) {
  // Allow whitelisted paths (req.path is relative to mount point)
  if (WHITELIST.includes(req.path)) {
    return next();
  }

  const token = req.cookies && req.cookies[COOKIE_NAME];

  if (!token) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect(BASE + '/login.html');
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }
    return res.redirect(BASE + '/login.html');
  }
}

module.exports = { authGate, generateToken, verifyToken, COOKIE_NAME, BASE };
