require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initDb } = require('./models/db');
const waterRouter = require('./routes/water');
const { requestLogger, errorHandler, notFound } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', waterRouter);
app.use(notFound);
app.use(errorHandler);

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n   Water Intake API rodando em http://localhost:${PORT}`);
      console.log(`   Banco de dados: ${process.env.DB_PATH || './data/water.db'}\n`);
    });
  } catch (err) {
    console.error('[FATAL] Falha ao inicializar o banco:', err);
    process.exit(1);
  }
})();

module.exports = app;
