// Flexible admin check middleware.
// Accepts either:
// - authenticated user on req.user with role==='admin' (preferred)
// - headers: 'x-user-role: admin' and 'x-admin-id: <id>' (for testing)
// - fallback to body.admin_id (least secure)
module.exports = function requireAdmin(req, res, next) {
  try {
    if (req.user && (req.user.role === 'admin' || req.user.roles && req.user.roles.includes('admin'))) {
      req.admin_id = req.user.id || req.user.userId || req.user.sub || req.user.admin_id;
      return next();
    }

    const headerRole = (req.headers['x-user-role'] || '').toLowerCase();
    const headerAdminId = req.headers['x-admin-id'] || req.headers['x-user-id'];
    if (headerRole === 'admin' && headerAdminId) {
      req.admin_id = headerAdminId;
      return next();
    }

    if (req.body && req.body.admin_id) {
      // permit but mark that this is a fallback (no role check)
      req.admin_id = req.body.admin_id;
      req.admin_id_unverified = true;
      return next();
    }

    return res.status(403).json({ error: 'admin role required' });
  } catch (err) {
    return res.status(500).json({ error: 'admin middleware error', details: err.message });
  }
};
