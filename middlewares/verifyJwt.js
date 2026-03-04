const jwt = require('jsonwebtoken');

module.exports = function verifyJwt(req, res, next) {
  try {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = auth.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT secret not configured' });

    jwt.verify(token, secret, { algorithms: ['HS256', 'HS512', 'RS256'] }, (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Invalid token', details: err.message });
      req.user = decoded;
      return next();
    });
  } catch (err) {
    return res.status(500).json({ error: 'JWT verification error', details: err.message });
  }
};
