// src/server.js
/**
 * Microtask Platform — Express Application Entry Point
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/database');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const offersRoutes = require('./routes/offers.routes');
const completionsRoutes = require('./routes/completions.routes');
const webhookRoutes = require('./routes/webhook.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentsRoutes = require('./routes/payments.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const { antiCheatFilter } = require('./middleware/antiCheat');

// ─── Cron Jobs ────────────────────────────────────────────────────────────────
require('./services/autoApprove.cron');

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

const corsOptions = {
  origin: process.env.CLIENT_URL || 'https://vboost-platform.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle all preflight requests

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  message: { status: 'fail', message: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/', limiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/api/health',
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// NOTE: Webhook routes need raw body for HMAC verification.
// They use express.raw() internally — do NOT mount express.json() before them.
app.use('/api/v1/webhooks', webhookRoutes);

// JSON parsing for all other routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Anti-Cheat & Maintenance Filter ──────────────────────────────────────────
app.use(antiCheatFilter);

// ─── Static Files (proof screenshots) ────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/offers', offersRoutes);
app.use('/api/v1/completions', completionsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
const healthPayload = (req, res) =>
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });

app.get('/api/health', healthPayload);
app.get('/api/v1/health', healthPayload); // versioned alias

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: `Route ${req.originalUrl} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Unhandled Rejections / Exceptions ───────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Microtask Platform running on http://localhost:${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   API Base:    http://localhost:${PORT}/api/v1`);
  });
});

module.exports = app;
