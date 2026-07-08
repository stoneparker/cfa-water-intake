const { Router } = require('express');
const ctrl = require('../controllers/waterController');

const router = Router();

// ─── Meta diária ───────────────────────────────────────────────────────────
router.get('/goal',           ctrl.getGoal);            // Visualiza a meta
router.put('/goal',           ctrl.updateGoal);         // Atualiza a meta

// ─── Ingestão ──────────────────────────────────────────────────────────────
router.post('/intake',        ctrl.createIntake);       // Arduino envia aqui
router.get('/intake',         ctrl.getIntakes);         // Lista registros
router.delete('/intake/:id',  ctrl.removeIntake);       // Remove um registro

// ─── Estatísticas ──────────────────────────────────────────────────────────
router.get('/stats/daily',    ctrl.getDailyStats);      // Resumo do dia
router.get('/stats/period',   ctrl.getPeriodStats);     // Período (padrão: últimos 7 dias)
router.get('/stats/hourly',   ctrl.getHourlyDistribution); // Distribuição por hora

module.exports = router;