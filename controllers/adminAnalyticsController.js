const pool = require('../config/db');

// Simple in-memory cache to reduce DB load for short-lived analytics queries
const cache = {
  // key -> { expiresAt: epochMs, data: {} }
};

const CACHE_TTL_MS = parseInt(process.env.ANALYTICS_CACHE_TTL_MS || '30000', 10);

function setCache(key, data) {
  cache[key] = { expiresAt: Date.now() + CACHE_TTL_MS, data };
}

function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

exports.getGraphs = async (req, res) => {
  try {
    const rangeDays = Math.max(1, Math.min(365, parseInt(req.query.rangeDays || '7', 10) || 7));
    const cacheKey = `graphs:${rangeDays}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const client = await pool.connect();
    try {
      // Time-series: appointments per day in range
      const tsQ = `
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM appointments
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY day
        ORDER BY day ASC
      `;
      const tsRes = await client.query(tsQ, [rangeDays]);

      // Breakdown: appointments by status
      const statusQ = `
        SELECT COALESCE(status, 'unknown') AS status, COUNT(*)::int AS count
        FROM appointments
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY status
        ORDER BY count DESC
      `;
      const statusRes = await client.query(statusQ, [rangeDays]);

      const result = {
        meta: { rangeDays },
        timeseries: tsRes.rows.map(r => ({ day: r.day, count: r.count })),
        breakdowns: {
          byStatus: statusRes.rows.map(r => ({ status: r.status, count: r.count }))
        }
      };

      setCache(cacheKey, result);
      return res.json(result);
    } finally {
      client.release();
    }
  } catch (err) {
    return res.status(500).json({ error: 'analytics_error', details: err.message });
  }
};
