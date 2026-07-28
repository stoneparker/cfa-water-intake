const { Router } = require('express');
const ctrl = require('../controllers/waterController');
const { deviceId } = require('../middleware');

const router = Router();


router.use(deviceId);


router.get('/goal',           ctrl.getGoal);            
router.put('/goal',           ctrl.updateGoal);         


router.post('/intake',        ctrl.createIntake);       
router.get('/intake',         ctrl.getIntakes);         
router.delete('/intake/:id',  ctrl.removeIntake);       


router.get('/stats/daily',    ctrl.getDailyStats);      
router.get('/stats/period',   ctrl.getPeriodStats);     
router.get('/stats/hourly',   ctrl.getHourlyDistribution); 

module.exports = router;