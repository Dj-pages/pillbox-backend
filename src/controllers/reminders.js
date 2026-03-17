const pool = require('../db/pool');

async function listReminders(req, res) {
  try {
    const result = await pool.query(`
      SELECT r.*, m.name AS medicine_name, m.dosage, m.stock
      FROM reminders r
      JOIN medicines m ON r.medicine_id = m.id
      ORDER BY r.remind_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getDueReminders(req, res) {
  try {
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const today = dayNames[now.getDay()];

    const result = await pool.query(`
      SELECT r.id, r.remind_time, r.medicine_id, m.name AS medicine_name, m.dosage, m.stock
      FROM reminders r
      JOIN medicines m ON r.medicine_id = m.id
      WHERE r.active = TRUE
        AND to_char(r.remind_time, 'HH24:MI') = $1
        AND $2 = ANY(r.days)
        AND m.stock > 0
    `, [hhmm, today]);

    res.json({ timestamp: now.toISOString(), due: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addReminder(req, res) {
  const { medicine_id, remind_time, days } = req.body;
  if (!medicine_id || !remind_time) return res.status(400).json({ error: 'medicine_id and remind_time are required' });
  try {
    const result = await pool.query(
      `INSERT INTO reminders (medicine_id, remind_time, days) VALUES ($1,$2,$3) RETURNING *`,
      [medicine_id, remind_time, days || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateReminder(req, res) {
  const { id } = req.params;
  const { remind_time, days, active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reminders SET
        remind_time = COALESCE($1, remind_time),
        days = COALESCE($2, days),
        active = COALESCE($3, active)
       WHERE id = $4 RETURNING *`,
      [remind_time, days, active, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteReminder(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM reminders WHERE id = $1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listReminders, getDueReminders, addReminder, updateReminder, deleteReminder };
