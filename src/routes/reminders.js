const router = require('express').Router();
const { listReminders, getDueReminders, addReminder, updateReminder, deleteReminder } = require('../controllers/reminders');

router.get('/due',    getDueReminders);  // ← must be before /:id
router.get('/',       listReminders);
router.post('/',      addReminder);
router.put('/:id',    updateReminder);
router.delete('/:id', deleteReminder);

module.exports = router;
