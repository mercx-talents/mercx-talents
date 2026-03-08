const errorHandler = (err, req, res, next) => {
  let message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') message = 'Resource not found';
  if (err.code === 11000) message = `${Object.keys(err.keyValue)[0]} already exists`;
  if (err.name === 'ValidationError') message = Object.values(err.errors).map(e => e.message).join(', ');
  if (err.name === 'JsonWebTokenError') message = 'Invalid token';
  if (err.name === 'TokenExpiredError') message = 'Token expired, please login again';

  res.status(err.statusCode || 500).json({ success: false, message });
};

module.exports = errorHandler;
