const router = require('express').Router();
const { acknowledge, logMissed, getLogs, getDashboard } = require('../controllers/logs');

router.get('/dashboard',              getDashboard);
router.get('/logs',                   getLogs);
router.post('/logs/missed',           logMissed);
router.post('/acknowledge/:reminderId', acknowledge);
router.get('/time', (_req, res) => {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
  res.json({
    year:   ist.getFullYear(),
    month:  ist.getMonth() + 1,
    day:    ist.getDate(),
    hour:   ist.getHours(),
    minute: ist.getMinutes(),
    second: ist.getSeconds()
  });
});
module.exports = router;
