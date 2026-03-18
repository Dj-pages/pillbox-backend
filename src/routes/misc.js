const router = require('express').Router();
const { acknowledge, logMissed, getLogs, getDashboard } = require('../controllers/logs');

router.get('/dashboard',              getDashboard);
router.get('/logs',                   getLogs);
router.post('/logs/missed',           logMissed);
router.post('/acknowledge/:reminderId', acknowledge);
router.get('/time', (_req, res) => {
  const now = new Date();
  res.json({
    year:   now.getFullYear(),
    month:  now.getMonth() + 1,
    day:    now.getDate(),
    hour:   now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds()
  });
});
module.exports = router;
