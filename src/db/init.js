const pool = require('./pool');

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(100) NOT NULL,
        dosage              VARCHAR(50),
        stock               INT NOT NULL DEFAULT 0,
        low_stock_threshold INT NOT NULL DEFAULT 5,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id          SERIAL PRIMARY KEY,
        medicine_id INT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
        remind_time TIME NOT NULL,
        days        TEXT[] NOT NULL DEFAULT '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}',
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS logs (
        id            SERIAL PRIMARY KEY,
        reminder_id   INT REFERENCES reminders(id) ON DELETE SET NULL,
        medicine_id   INT REFERENCES medicines(id) ON DELETE SET NULL,
        medicine_name VARCHAR(100),
        status        VARCHAR(20) NOT NULL,
        triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        acked_at      TIMESTAMPTZ,
        note          TEXT
      );
    `);

    await client.query(`
      ALTER TABLE medicines
        ADD COLUMN IF NOT EXISTS name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS dosage VARCHAR(50),
        ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE reminders
        ADD COLUMN IF NOT EXISTS medicine_id INT,
        ADD COLUMN IF NOT EXISTS remind_time TIME,
        ADD COLUMN IF NOT EXISTS days TEXT[] DEFAULT '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}',
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE logs
        ADD COLUMN IF NOT EXISTS reminder_id INT,
        ADD COLUMN IF NOT EXISTS medicine_id INT,
        ADD COLUMN IF NOT EXISTS medicine_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS note TEXT;
    `);

    await client.query(`
      UPDATE medicines
      SET low_stock_threshold = 5
      WHERE low_stock_threshold IS NULL;

      UPDATE medicines
      SET stock = 0
      WHERE stock IS NULL;

      UPDATE reminders
      SET days = '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}'
      WHERE days IS NULL OR cardinality(days) = 0;

      UPDATE reminders
      SET active = TRUE
      WHERE active IS NULL;

      UPDATE logs
      SET triggered_at = NOW()
      WHERE triggered_at IS NULL;
    `);

    await client.query(`
      ALTER TABLE medicines
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN stock SET NOT NULL,
        ALTER COLUMN stock SET DEFAULT 0,
        ALTER COLUMN low_stock_threshold SET NOT NULL,
        ALTER COLUMN low_stock_threshold SET DEFAULT 5,
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT NOW();

      ALTER TABLE reminders
        ALTER COLUMN medicine_id SET NOT NULL,
        ALTER COLUMN remind_time SET NOT NULL,
        ALTER COLUMN days SET NOT NULL,
        ALTER COLUMN days SET DEFAULT '{Mon,Tue,Wed,Thu,Fri,Sat,Sun}',
        ALTER COLUMN active SET NOT NULL,
        ALTER COLUMN active SET DEFAULT TRUE,
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT NOW();

      ALTER TABLE logs
        ALTER COLUMN status SET NOT NULL,
        ALTER COLUMN triggered_at SET NOT NULL,
        ALTER COLUMN triggered_at SET DEFAULT NOW();
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'medicines_stock_nonnegative'
        ) THEN
          ALTER TABLE medicines
          ADD CONSTRAINT medicines_stock_nonnegative CHECK (stock >= 0);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'medicines_low_stock_threshold_nonnegative'
        ) THEN
          ALTER TABLE medicines
          ADD CONSTRAINT medicines_low_stock_threshold_nonnegative CHECK (low_stock_threshold >= 0);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'medicines_name_not_blank'
        ) THEN
          ALTER TABLE medicines
          ADD CONSTRAINT medicines_name_not_blank CHECK (btrim(name) <> '');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'reminders_days_valid'
        ) THEN
          ALTER TABLE reminders
          ADD CONSTRAINT reminders_days_valid
          CHECK (
            cardinality(days) > 0
            AND days <@ ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::TEXT[]
          );
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'logs_status_valid'
        ) THEN
          ALTER TABLE logs
          ADD CONSTRAINT logs_status_valid
          CHECK (status IN ('taken','missed','snoozed'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'logs_acked_after_triggered'
        ) THEN
          ALTER TABLE logs
          ADD CONSTRAINT logs_acked_after_triggered
          CHECK (acked_at IS NULL OR acked_at >= triggered_at);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'reminders_medicine_id_fkey'
        ) THEN
          ALTER TABLE reminders
          ADD CONSTRAINT reminders_medicine_id_fkey
          FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'logs_reminder_id_fkey'
        ) THEN
          ALTER TABLE logs
          ADD CONSTRAINT logs_reminder_id_fkey
          FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'logs_medicine_id_fkey'
        ) THEN
          ALTER TABLE logs
          ADD CONSTRAINT logs_medicine_id_fkey
          FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medicines_created_at
        ON medicines (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_medicines_low_stock
        ON medicines (stock, low_stock_threshold);
      CREATE INDEX IF NOT EXISTS idx_reminders_medicine_id
        ON reminders (medicine_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_active_time
        ON reminders (active, remind_time);
      CREATE INDEX IF NOT EXISTS idx_logs_triggered_at
        ON logs (triggered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_medicine_id_triggered_at
        ON logs (medicine_id, triggered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_status_triggered_at
        ON logs (status, triggered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_reminder_id
        ON logs (reminder_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables ready');
    console.log('✅ Database constraints and indexes ready');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = initDB;
