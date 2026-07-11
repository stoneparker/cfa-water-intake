const express = require('express');
const cors = require('cors');

const waterRouter = require('../routes/water');
const { requestLogger, errorHandler, notFound } = require('../middleware');

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

function run() {
  app.listen(PORT, () => {
    console.log(`   Water Intake API rodando em http://localhost:${PORT}`);
  });
}

module.exports = { run };
