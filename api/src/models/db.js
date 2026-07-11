const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/water.db';
const resolvedPath = path.resolve(DB_PATH);

const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let _db = null;

function getDb() {
  if (!_db) throw new Error('Banco não inicializado.');
  return _db;
}

function persist() {
  const data = _db.export();
  fs.writeFileSync(resolvedPath, Buffer.from(data));
}

/** Verifica se uma coluna existe numa tabela (para migrações idempotentes) */
function columnExists(table, column) {
  const res = _db.exec(`PRAGMA table_info(${table})`);
  if (!res.length) return false;
  const { columns, values } = res[0];
  const nameIdx = columns.indexOf('name');
  return values.some(row => row[nameIdx] === column);
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(resolvedPath)) {
    const fileBuffer = fs.readFileSync(resolvedPath);
    _db = new SQL.Database(fileBuffer);
    console.log(`[DB] Banco carregado de ${resolvedPath}`);
  } else {
    _db = new SQL.Database();
    console.log(`[DB] Novo banco criado em ${resolvedPath}`);
  }

  // ── Schema (bancos novos já nascem no formato final, sem 'notes') ──────────
  _db.run(`
    CREATE TABLE IF NOT EXISTS water_intake (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_ml   REAL    NOT NULL CHECK (amount_ml > 0),
      recorded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      device_id   TEXT    NOT NULL DEFAULT 'arduino-01'
    )
  `);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_recorded_at ON water_intake (recorded_at)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_device_id ON water_intake (device_id)`);

  // config: meta por device → PK composta (key, device_id)
  _db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key        TEXT NOT NULL,
      device_id  TEXT NOT NULL DEFAULT 'default',
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      PRIMARY KEY (key, device_id)
    )
  `);

  // ── Migrações para bancos que já existiam ──────────────────────────────────

  // 1) Remove a coluna 'notes' de water_intake (SQLite antigo não tem DROP COLUMN)
  if (columnExists('water_intake', 'notes')) {
    _db.exec(`
      CREATE TABLE water_intake_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        amount_ml   REAL    NOT NULL CHECK (amount_ml > 0),
        recorded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        device_id   TEXT    NOT NULL DEFAULT 'arduino-01'
      );
      INSERT INTO water_intake_new (id, amount_ml, recorded_at, device_id)
        SELECT id, amount_ml, recorded_at, COALESCE(device_id, 'arduino-01')
        FROM water_intake;
      DROP TABLE water_intake;
      ALTER TABLE water_intake_new RENAME TO water_intake;
    `);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_recorded_at ON water_intake (recorded_at)`);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_device_id ON water_intake (device_id)`);
    console.log(`[DB] Migração: coluna 'notes' removida de water_intake`);
  }

  // 2) Adiciona device_id à config (goal global antiga vira o padrão 'default')
  if (!columnExists('config', 'device_id')) {
    _db.exec(`
      CREATE TABLE config_new (
        key        TEXT NOT NULL,
        device_id  TEXT NOT NULL DEFAULT 'default',
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        PRIMARY KEY (key, device_id)
      );
      INSERT INTO config_new (key, device_id, value, updated_at)
        SELECT key, 'default', value, updated_at FROM config;
      DROP TABLE config;
      ALTER TABLE config_new RENAME TO config;
    `);
    console.log(`[DB] Migração: config agora tem device_id (goal antiga migrada para 'default')`);
  }

  // Meta padrão global (device 'default'), usada como fallback quando o device
  // ainda não configurou a própria meta. Inserida só se ainda não existir.
  const defaultGoal = process.env.DAILY_GOAL_ML || '2000';
  _db.run(
    `INSERT OR IGNORE INTO config (key, device_id, value) VALUES ('daily_goal_ml', 'default', ?)`,
    [defaultGoal]
  );

  persist();
}

module.exports = { initDb, getDb, persist };