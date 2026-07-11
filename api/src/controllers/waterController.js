const service = require('../services/waterService');

// POST /api/intake
function createIntake(req, res) {
  const { amount_ml } = req.body;
  const device_id = req.deviceId;

  if (amount_ml === undefined || amount_ml === null) {
    return res.status(400).json({ error: 'O campo amount_ml é obrigatório.' });
  }
  const parsed = Number(amount_ml);
  if (isNaN(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'amount_ml deve ser um número positivo.' });
  }

  try {
    const record = service.registerIntake({ amount_ml: parsed, device_id });
    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar ingestão.', detail: err.message });
  }
}

// GET /api/intake
function getIntakes(req, res) {
  const { date, limit, offset } = req.query;
  try {
    const records = service.listIntakes({
      device_id: req.deviceId,
      date,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
    });
    return res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar registros.', detail: err.message });
  }
}

// DELETE /api/intake/:id
function removeIntake(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const deleted = service.deleteIntake(id, req.deviceId);
    if (!deleted) return res.status(404).json({ error: 'Registro não encontrado para este device.' });
    return res.json({ success: true, data: deleted });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao deletar registro.', detail: err.message });
  }
}

// GET /api/goal
function getGoal(req, res) {
  try {
    return res.json({ success: true, data: service.getDailyGoal(req.deviceId) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar meta.', detail: err.message });
  }
}

// PUT /api/goal
function updateGoal(req, res) {
  const { daily_goal_ml } = req.body;

  if (daily_goal_ml === undefined || daily_goal_ml === null) {
    return res.status(400).json({ error: 'O campo daily_goal_ml é obrigatório.' });
  }
  const parsed = Number(daily_goal_ml);
  if (isNaN(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'daily_goal_ml deve ser um número positivo.' });
  }

  try {
    const updated = service.setDailyGoal(req.deviceId, parsed);
    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao atualizar meta.', detail: err.message });
  }
}

// GET /api/stats/daily
function getDailyStats(req, res) {
  const { date } = req.query;
  try {
    return res.json({ success: true, data: service.getDailyStats(req.deviceId, date) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao calcular estatísticas diárias.', detail: err.message });
  }
}

// GET /api/stats/period
function getPeriodStats(req, res) {
  const { start_date, end_date } = req.query;
  try {
    return res.json({ success: true, data: service.getPeriodStats({ device_id: req.deviceId, start_date, end_date }) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao calcular estatísticas do período.', detail: err.message });
  }
}

// GET /api/stats/hourly
function getHourlyDistribution(req, res) {
  const { date } = req.query;
  try {
    return res.json({ success: true, data: service.getHourlyDistribution(req.deviceId, date) });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao calcular distribuição horária.', detail: err.message });
  }
}

module.exports = {
  createIntake, getIntakes, removeIntake,
  getGoal, updateGoal,
  getDailyStats, getPeriodStats, getHourlyDistribution,
};