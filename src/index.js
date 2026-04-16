require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const initDB  = require('./db/init');

const medicinesRouter = require('./routes/medicines');
const remindersRouter = require('./routes/reminders');
const miscRouter      = require('./routes/misc');

const app  = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'https://pillbox-frontend-phi.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return;
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use((req, res, next) => {
  applyCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/medicines', medicinesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api',           miscRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((req, res) => {
  applyCorsHeaders(req, res);
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, _next) => {
  applyCorsHeaders(req, res);
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
