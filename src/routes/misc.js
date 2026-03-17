const router = require('express').Router();
const { acknowledge, logMissed, getLogs, getDashboard } = require('../controllers/logs');

router.get('/dashboard',              getDashboard);
router.get('/logs',                   getLogs);
router.post('/logs/missed',           logMissed);
router.post('/acknowledge/:reminderId', acknowledge);

module.exports = router;
