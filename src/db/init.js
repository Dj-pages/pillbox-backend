const pool = require('./pool');

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id                 SERIAL PRIMARY KEY,
        name               VARCHAR(100) NOT NULL,
        dosage             VARCHAR(50),
        stock              INT NOT NULL DEFAULT 0,
        low_stock_threshold INT NOT NULL DEFAULT 5,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id          SERIAL PRIMARY KEY,
        medicine_id INT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        remind_time TIME NOT NULL,
        days        TEXT[] NOT NULL DEFAULT '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}',
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS logs (
        id            SERIAL PRIMARY KEY,
        reminder_id   INT REFERENCES reminders(id) ON DELETE SET NULL,
        medicine_id   INT REFERENCES medicines(id) ON DELETE SET NULL,
        medicine_name VARCHAR(100),
        status        VARCHAR(20) NOT NULL CHECK (status IN ('taken','missed','snoozed')),
        triggered_at  TIMESTAMPTZ NOT NULL,
        acked_at      TIMESTAMPTZ,
        note          TEXT
      );
    `);
    console.log('✅ Database tables ready');
  } finally {
    client.release();
  }
}

module.exports = initDB;
