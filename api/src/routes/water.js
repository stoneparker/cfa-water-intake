const { Router } = require('express');
const ctrl = require('../controllers/waterController');
const { deviceId } = require('../middleware');

const router = Router();

// Todas as rotas /api exigem o header X-Device-Id → req.deviceId
router.use(deviceId);

// ─── Meta diária ───────────────────────────────────────────────────────────
router.get('/goal',           ctrl.getGoal);            // Visualiza a meta do device
router.put('/goal',           ctrl.updateGoal);         // Atualiza a meta do device

// ─── Ingestão ──────────────────────────────────────────────────────────────
router.post('/intake',        ctrl.createIntake);       // Arduino envia aqui
router.get('/intake',         ctrl.getIntakes);         // Lista registros do device
router.delete('/intake/:id',  ctrl.removeIntake);       // Remove um registro do device

// ─── Estatísticas ──────────────────────────────────────────────────────────
router.get('/stats/daily',    ctrl.getDailyStats);      // Resumo do dia (do device)
router.get('/stats/period',   ctrl.getPeriodStats);     // Período (padrão: últimos 7 dias)
router.get('/stats/hourly',   ctrl.getHourlyDistribution); // Distribuição por hora

module.exports = router;