// backend/src/middleware/errorHandler.js

// Wrap async route handlers so thrown errors reach the error handler.
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function errorHandler(err, req, res, next) {
  if (err.code === 'P2002') return res.status(409).json({ error: 'A record with that value already exists.' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
  if (err.code === 'P2003') return res.status(409).json({ error: 'This record is linked to other records and cannot be removed.' });
  if (err.name === 'PrismaClientValidationError') {
    const m = String(err.message).match(/Invalid value for argument `(\w+)`|Argument `(\w+)`/);
    return res.status(422).json({ error: `Invalid value${m ? ` for ${m[1] || m[2]}` : ''}` });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

module.exports = { ah, HttpError, errorHandler };
