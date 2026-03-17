const pool = require('../db/pool');

async function listMedicines(req, res) {
  try {
    const result = await pool.query('SELECT * FROM medicines ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addMedicine(req, res) {
  const { name, dosage, stock, low_stock_threshold } = req.body;
  if (!name || stock === undefined) return res.status(400).json({ error: 'name and stock are required' });
  try {
    const result = await pool.query(
      `INSERT INTO medicines (name, dosage, stock, low_stock_threshold) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, dosage || null, stock, low_stock_threshold || 5]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMedicine(req, res) {
  const { id } = req.params;
  const { name, dosage, stock, low_stock_threshold } = req.body;
  try {
    const result = await pool.query(
      `UPDATE medicines SET
        name = COALESCE($1, name),
        dosage = COALESCE($2, dosage),
        stock = COALESCE($3, stock),
        low_stock_threshold = COALESCE($4, low_stock_threshold)
       WHERE id = $5 RETURNING *`,
      [name, dosage, stock, low_stock_threshold, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteMedicine(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM medicines WHERE id = $1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', medicine: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listMedicines, addMedicine, updateMedicine, deleteMedicine };
