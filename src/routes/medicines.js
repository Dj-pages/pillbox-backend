const router = require('express').Router();
const { listMedicines, addMedicine, updateMedicine, deleteMedicine } = require('../controllers/medicines');

router.get('/',       listMedicines);
router.post('/',      addMedicine);
router.put('/:id',    updateMedicine);
router.delete('/:id', deleteMedicine);

module.exports = router;
