const { randomUUID } = require('node:crypto');

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const suppliedId = req.get('X-Request-Id');
  req.id = suppliedId && suppliedId.trim() ? suppliedId.trim() : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(JSON.stringify({
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    }));
  });
  next();
}

module.exports = { requestLogger };
