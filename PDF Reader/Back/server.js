const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const reportsRouter = require('./routes/reports');
const authRouter = require('./routes/auth');
const { authGate } = require('./middleware/auth');
const { seedDefaultUser } = require('../Database/db');

const app = express();
const BASE = '/pdf-reader';
const PORT = process.env.PORT || 3000;

// Seed default admin user on first run
seedDefaultUser();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Redirect root to base path
app.get('/', (req, res) => res.redirect(BASE));

// Mount everything under /pdf-reader
const sub = express.Router();

// Auth gate — must be BEFORE express.static so static files are protected
sub.use(authGate);

// Serve frontend static files
sub.use(express.static(path.join(__dirname, '..', 'Front')));

// API routes
sub.use('/api/auth', authRouter);
sub.use('/api/reports', reportsRouter);

// Fallback to index.html
sub.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Front', 'index.html'));
});

app.use(BASE, sub);

app.listen(PORT, () => {
  console.log(`PDF Reader server running at http://localhost:${PORT}${BASE}`);
});
