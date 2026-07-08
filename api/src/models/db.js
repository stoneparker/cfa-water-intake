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

  _db.run(`
    CREATE TABLE IF NOT EXISTS water_intake (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_ml   REAL    NOT NULL CHECK (amount_ml > 0),
      recorded_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      device_id   TEXT    DEFAULT 'arduino-01',
      notes       TEXT
    )
  `);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_recorded_at ON water_intake (recorded_at)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_device_id ON water_intake (device_id)`);

  _db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  // Insere meta padrão apenas se ainda não existir
  const defaultGoal = process.env.DAILY_GOAL_ML || '2000';
  _db.run(
    `INSERT OR IGNORE INTO config (key, value) VALUES ('daily_goal_ml', ?)`,
    [defaultGoal]
  );

  persist();
}

module.exports = { initDb, getDb, persist };