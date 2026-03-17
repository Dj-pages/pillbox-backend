const pool = require('../db/pool');

async function acknowledge(req, res) {
  const { reminderId } = req.params;
  const { status } = req.body;
  const resolvedStatus = status || 'taken';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rResult = await client.query(
      `SELECT r.medicine_id, m.name, m.stock FROM reminders r
       JOIN medicines m ON r.medicine_id = m.id WHERE r.id = $1`,
      [reminderId]
    );
    if (!rResult.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Reminder not found' }); }

    const { medicine_id, name, stock } = rResult.rows[0];
    if (resolvedStatus === 'taken' && stock > 0) {
      await client.query('UPDATE medicines SET stock = stock - 1 WHERE id = $1', [medicine_id]);
    }
    const logResult = await client.query(
      `INSERT INTO logs (reminder_id, medicine_id, medicine_name, status, triggered_at, acked_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING *`,
      [reminderId, medicine_id, name, resolvedStatus]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT stock FROM medicines WHERE id = $1', [medicine_id]);
    res.json({ message: `Acknowledged as ${resolvedStatus}`, log: logResult.rows[0], remaining_stock: updated.rows[0].stock });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function logMissed(req, res) {
  const { reminder_id, medicine_id, medicine_name } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO logs (reminder_id, medicine_id, medicine_name, status, triggered_at)
       VALUES ($1,$2,$3,'missed',NOW()) RETURNING *`,
      [reminder_id, medicine_id, medicine_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getLogs(req, res) {
  const { medicine_id, status, from, to, limit } = req.query;
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params = [];
  if (medicine_id) { params.push(medicine_id); query += ` AND medicine_id = $${params.length}`; }
  if (status)      { params.push(status);       query += ` AND status = $${params.length}`; }
  if (from)        { params.push(from);          query += ` AND triggered_at >= $${params.length}`; }
  if (to)          { params.push(to);            query += ` AND triggered_at <= $${params.length}`; }
  query += ` ORDER BY triggered_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit) || 100);
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getDashboard(req, res) {
  try {
    const [medicines, todayLogs, lowStock, upcoming] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM medicines'),
      pool.query(`SELECT status, COUNT(*) AS count FROM logs WHERE triggered_at::date = CURRENT_DATE GROUP BY status`),
      pool.query(`SELECT id, name, stock, low_stock_threshold FROM medicines WHERE stock <= low_stock_threshold ORDER BY stock ASC`),
      pool.query(`
        SELECT r.id, r.remind_time, m.name AS medicine_name, m.dosage
        FROM reminders r JOIN medicines m ON r.medicine_id = m.id
        WHERE r.active = TRUE AND to_char(r.remind_time,'HH24:MI') >= to_char(NOW(),'HH24:MI')
        ORDER BY r.remind_time ASC LIMIT 5
      `)
    ]);
    const todayStats = { taken: 0, missed: 0, snoozed: 0 };
    todayLogs.rows.forEach(r => { todayStats[r.status] = parseInt(r.count); });
    res.json({
      total_medicines: parseInt(medicines.rows[0].total),
      today: todayStats,
      low_stock_alerts: lowStock.rows,
      upcoming_reminders: upcoming.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { acknowledge, logMissed, getLogs, getDashboard };
