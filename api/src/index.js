require('dotenv').config();

const { initDb } = require('./models/db');
const httpServer = require('./server/http');
const wsServer = require('./server/ws');

(async () => {
  try {
    global.clients = new Set();

    await initDb();
    httpServer.run();
    wsServer.run();
  } catch (err) {
    console.error('[FATAL] Falha ao inicializar o banco:', err);
    process.exit(1);
  }
})();
