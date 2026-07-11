const { getDb, persist } = require('../models/db');

const DEFAULT_GOAL_ML = Number(process.env.DAILY_GOAL_ML || 2000);

// ─── helpers ───────────────────────────────────────────────────────────────

/** Executa SELECT e retorna array de objetos */
function query(sql, params = []) {
  const db = getDb();
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

/** Executa INSERT/UPDATE/DELETE e persiste */
function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  const rowid   = query('SELECT last_insert_rowid() AS r')[0]?.r ?? null;
  const changes = query('SELECT changes() AS c')[0]?.c ?? 0;
  persist();
  return { lastInsertRowid: rowid, changes };
}

// ─── Meta diária (por device, com fallback para 'default' e depois env) ─────

function getDailyGoal(device_id) {
  // Prefere a meta do próprio device; se não existir, usa a do 'default'
  const row = query(
    `SELECT value, updated_at, device_id FROM config
     WHERE key = 'daily_goal_ml' AND device_id IN (?, 'default')
     ORDER BY CASE device_id WHEN ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [device_id, device_id]
  )[0];

  if (row) {
    return {
      device_id,
      daily_goal_ml: Number(row.value),
      updated_at: row.updated_at,
      source: row.device_id === device_id ? 'device' : 'default',
    };
  }

  return { device_id, daily_goal_ml: DEFAULT_GOAL_ML, updated_at: null, source: 'fallback' };
}

function setDailyGoal(device_id, goal_ml) {
  run(
    `INSERT INTO config (key, device_id, value, updated_at)
     VALUES ('daily_goal_ml', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(key, device_id) DO UPDATE SET
       value      = excluded.value,
       updated_at = excluded.updated_at`,
    [device_id, goal_ml]
  );
  return getDailyGoal(device_id);
}

// ─── Inserção ──────────────────────────────────────────────────────────────

function registerIntake({ amount_ml, device_id }) {
  const { lastInsertRowid } = run(
    'INSERT INTO water_intake (amount_ml, device_id) VALUES (?, ?)',
    [amount_ml, device_id]
  );

  const record = query('SELECT * FROM water_intake WHERE id = ?', [lastInsertRowid])[0];

  // Envia as estatísticas do dia atualizadas para o front do device
  global.users[device_id]?.emit('intake', getDailyStats(device_id));

  createReminder(device_id);

  return record;
}

// talvezzz faça sentido que a pessoa personalize os alertas. fica 30min por enquanto
function createReminder(device_id) {
  console.log(`Criando lembrete para ingestão de água em 30 minutos para o dispositivo ${device_id}...`);

  console.log('Clients connected:', global.clients.size);

  setTimeout(() => {
    const lastIntake = getLastIntakeDate(device_id);

    const now = new Date();
    const diff = now - new Date(lastIntake);
    const diffMinutes = Math.floor(diff / 1000 / 60);

    if (diffMinutes >= 30) {
      console.log(`Lembrete ao dispositivo ${device_id}: ${diffMinutes} minutos desde a última ingestão de água.`);
      global.users[device_id]?.emit('reminder', { diffMinutes });
    } else {
      console.log(`Nenhum lembrete necessário. A última ingestão foi há ${diffMinutes} minutos.`);
    }

  }, 1000 * 10); // 10 seconds
}

// ─── Listagem ──────────────────────────────────────────────────────────────

function listIntakes({ device_id, date, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM water_intake WHERE device_id = ?';
  const params = [device_id];

  if (date) {
    sql += ' AND DATE(recorded_at) = DATE(?)';
    params.push(date);
  }

  sql += ' ORDER BY recorded_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return query(sql, params);
}

// ─── Estatísticas do dia ────────────────────────────────────────────────────

function getDailyStats(device_id, date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const { daily_goal_ml: GOAL } = getDailyGoal(device_id);

  const rows = query(`
    SELECT
      DATE(recorded_at)              AS date,
      COUNT(*)                       AS total_records,
      ROUND(SUM(amount_ml), 2)       AS total_ml,
      ROUND(AVG(amount_ml), 2)       AS avg_ml_per_record,
      ROUND(MAX(amount_ml), 2)       AS max_single_ml,
      ROUND(MIN(amount_ml), 2)       AS min_single_ml,
      MIN(recorded_at)               AS first_intake,
      MAX(recorded_at)               AS last_intake
    FROM water_intake
    WHERE device_id = ? AND DATE(recorded_at) = DATE(?)
    GROUP BY DATE(recorded_at)
  `, [device_id, targetDate]);

  const stats = rows[0];

  if (!stats) {
    return {
      date: targetDate,
      total_records: 0, total_ml: 0, avg_ml_per_record: 0,
      max_single_ml: 0, min_single_ml: 0,
      first_intake: null, last_intake: null,
      goal_ml: GOAL, goal_percent: 0,
      goal_reached: false, remaining_ml: GOAL,
    };
  }

  const goalPercent = Math.min(100, Math.round((stats.total_ml / GOAL) * 100));
  return {
    ...stats,
    goal_ml: GOAL,
    goal_percent: goalPercent,
    goal_reached: stats.total_ml >= GOAL,
    remaining_ml: Math.max(0, Math.round(GOAL - stats.total_ml)),
  };
}

function getLastIntakeDate(device_id) {
  const rows = query(`
    SELECT recorded_at
    FROM water_intake
    WHERE device_id = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `, [device_id]);

  return rows[0]?.recorded_at ?? null;
}

// ─── Histórico por período ──────────────────────────────────────────────────

function getPeriodStats({ device_id, start_date, end_date } = {}) {
  const { daily_goal_ml: GOAL } = getDailyGoal(device_id);
  const today = new Date().toISOString().slice(0, 10);
  const from = start_date || (() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10);
  })();
  const to = end_date || today;

  const rows = query(`
    SELECT
      DATE(recorded_at)        AS date,
      COUNT(*)                 AS total_records,
      ROUND(SUM(amount_ml), 2) AS total_ml,
      ROUND(AVG(amount_ml), 2) AS avg_ml_per_record
    FROM water_intake
    WHERE device_id = ? AND DATE(recorded_at) BETWEEN DATE(?) AND DATE(?)
    GROUP BY DATE(recorded_at)
    ORDER BY date ASC
  `, [device_id, from, to]);

  const totals = rows.reduce(
    (acc, r) => ({ ml: acc.ml + r.total_ml, records: acc.records + r.total_records }),
    { ml: 0, records: 0 }
  );

  return {
    period: { start_date: from, end_date: to },
    days_with_data: rows.length,
    overall_total_ml: Math.round(totals.ml),
    overall_avg_daily_ml: rows.length ? Math.round(totals.ml / rows.length) : 0,
    overall_total_records: totals.records,
    daily: rows.map(r => ({
      ...r,
      goal_ml: GOAL,
      goal_percent: Math.min(100, Math.round((r.total_ml / GOAL) * 100)),
      goal_reached: r.total_ml >= GOAL,
    })),
  };
}

// ─── Distribuição por hora ──────────────────────────────────────────────────

function getHourlyDistribution(device_id, date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const rows = query(`
    SELECT
      CAST(strftime('%H', recorded_at) AS INTEGER) AS hour,
      COUNT(*)                                      AS records,
      ROUND(SUM(amount_ml), 2)                      AS total_ml
    FROM water_intake
    WHERE device_id = ? AND DATE(recorded_at) = DATE(?)
    GROUP BY hour
    ORDER BY hour ASC
  `, [device_id, targetDate]);

  const full = Array.from({ length: 24 }, (_, h) => {
    const found = rows.find(r => r.hour === h);
    return found || { hour: h, records: 0, total_ml: 0 };
  });

  return { date: targetDate, hourly: full };
}

// ─── Deleção (escopada por device) ──────────────────────────────────────────

function deleteIntake(id, device_id) {
  const rows = query('SELECT * FROM water_intake WHERE id = ? AND device_id = ?', [id, device_id]);
  if (!rows.length) return null;
  run('DELETE FROM water_intake WHERE id = ? AND device_id = ?', [id, device_id]);
  return rows[0];
}

module.exports = {
  getDailyGoal,
  setDailyGoal,
  registerIntake,
  listIntakes,
  getDailyStats,
  getPeriodStats,
  getHourlyDistribution,
  deleteIntake,
  getLastIntakeDate,
};