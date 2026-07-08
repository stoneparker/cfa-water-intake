// Middleware de log de requisições
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
}

// Middleware de tratamento de erros globais
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Erro interno do servidor.', detail: err.message });
}

// Middleware para rotas não encontradas
function notFound(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

module.exports = { requestLogger, errorHandler, notFound };
