require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const initDB  = require('./db/init');

const medicinesRouter = require('./routes/medicines');
const remindersRouter = require('./routes/reminders');
const miscRouter      = require('./routes/misc');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/medicines', medicinesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api',           miscRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
