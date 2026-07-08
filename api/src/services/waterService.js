const { getDb, persist } = require('../models/db');

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

// ─── Meta diária ────────────────────────────────────────────────────────────

function getDailyGoal() {
  const row = query(`SELECT value, updated_at FROM config WHERE key = 'daily_goal_ml'`)[0];
  return {
    daily_goal_ml: row ? Number(row.value) : 2000,
    updated_at: row?.updated_at ?? null,
  };
}

function setDailyGoal(goal_ml) {
  run(
    `INSERT INTO config (key, value, updated_at)
     VALUES ('daily_goal_ml', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(key) DO UPDATE SET
       value      = excluded.value,
       updated_at = excluded.updated_at`,
    [goal_ml]
  );
  return getDailyGoal();
}

// ─── Inserção ──────────────────────────────────────────────────────────────

function registerIntake({ amount_ml, device_id = 'arduino-01', notes = null }) {
  const { lastInsertRowid } = run(
    'INSERT INTO water_intake (amount_ml, device_id, notes) VALUES (?, ?, ?)',
    [amount_ml, device_id, notes]
  );
  return query('SELECT * FROM water_intake WHERE id = ?', [lastInsertRowid])[0];
}

// ─── Listagem ──────────────────────────────────────────────────────────────

function listIntakes({ date, device_id, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM water_intake WHERE 1=1';
  const params = [];

  if (date) {
    sql += ' AND DATE(recorded_at) = DATE(?)';
    params.push(date);
  }
  if (device_id) {
    sql += ' AND device_id = ?';
    params.push(device_id);
  }

  sql += ' ORDER BY recorded_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return query(sql, params);
}

// ─── Estatísticas do dia ────────────────────────────────────────────────────

function getDailyStats(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const { daily_goal_ml: GOAL } = getDailyGoal();

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
    WHERE DATE(recorded_at) = DATE(?)
    GROUP BY DATE(recorded_at)
  `, [targetDate]);

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

// ─── Histórico por período ──────────────────────────────────────────────────

function getPeriodStats({ start_date, end_date } = {}) {
  const { daily_goal_ml: GOAL } = getDailyGoal();
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
    WHERE DATE(recorded_at) BETWEEN DATE(?) AND DATE(?)
    GROUP BY DATE(recorded_at)
    ORDER BY date ASC
  `, [from, to]);

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

function getHourlyDistribution(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const rows = query(`
    SELECT
      CAST(strftime('%H', recorded_at) AS INTEGER) AS hour,
      COUNT(*)                                      AS records,
      ROUND(SUM(amount_ml), 2)                      AS total_ml
    FROM water_intake
    WHERE DATE(recorded_at) = DATE(?)
    GROUP BY hour
    ORDER BY hour ASC
  `, [targetDate]);

  const full = Array.from({ length: 24 }, (_, h) => {
    const found = rows.find(r => r.hour === h);
    return found || { hour: h, records: 0, total_ml: 0 };
  });

  return { date: targetDate, hourly: full };
}

// ─── Deleção ───────────────────────────────────────────────────────────────

function deleteIntake(id) {
  const rows = query('SELECT * FROM water_intake WHERE id = ?', [id]);
  if (!rows.length) return null;
  run('DELETE FROM water_intake WHERE id = ?', [id]);
  return rows[0];
}

module.exports = {
  getDailyGoal, setDailyGoal,
  registerIntake, listIntakes, getDailyStats,
  getPeriodStats, getHourlyDistribution, deleteIntake,
};