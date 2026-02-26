require('dotenv').config();
const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');
const pool = require('./config/db');

// Logging
const morgan = require('morgan');

// Routes
const paymentRouter = require('./routes/payment');

const app = express();

// Parse simple CLI args for --host and --port (e.g. `node server.js --host 0.0.0.0 --port 8001`)
const argv = process.argv.slice(2);
const argMap = argv.reduce((acc, cur, idx, arr) => {
  if (cur.startsWith('--')) {
    const key = cur.replace(/^--/, '');
    const next = arr[idx + 1];
    if (next && !next.startsWith('--')) acc[key] = next;
  }
  return acc;
}, {});

const PORT = argMap.port || process.env.PORT || 3001;
const HOST = argMap.host || process.env.HOST || '0.0.0.0';

// Middleware
// Allow all origins and enable credentials (reflect origin)
app.use(cors({ origin: true, credentials: true }));
// Enable pre-flight for all routes
app.options('*', cors({ origin: true, credentials: true }));
app.use(express.json());
// Request logging
app.use(morgan('dev'));

// Swagger configuration
// Allow setting hosted URL(s) via env var `SERVER_URLS` or single `SERVER_URL`.
// `SERVER_URLS` can be a comma-separated list (e.g. "https://api.prod.com,https://api.staging.com").
// If not provided, leave servers empty and let the dynamic `/api-docs.json`
// handler inject the request host as the server URL at runtime.
const rawServerUrls = process.env.SERVER_URLS || process.env.SERVER_URL || '';
const urlList = rawServerUrls ? rawServerUrls.split(',').map(s => s.trim()).filter(Boolean) : [];

const swaggerServers = urlList.length ? urlList.map((url) => {
  let desc = 'Server';
  if (process.env.SERVER_ENV_DESC) desc = process.env.SERVER_ENV_DESC;
  else if (url.includes('localhost')) desc = 'Local server';
  else if (process.env.NODE_ENV === 'production') desc = 'Production server';
  else desc = 'Staging/Dev server';
  return { url, description: desc };
}) : [];

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clinic Management API',
      version: '1.0.0',
      description: 'API for clinic management system',
    },
    // Only include static servers when explicitly provided via env.
    ...(swaggerServers.length ? { servers: swaggerServers } : {}),
  },
  apis: ['./routes/*.js', './server.js'],
};

const specsTemplate = swaggerJsdoc(swaggerOptions);

// Serve a dynamic swagger JSON that uses either SERVER_URL(S) env or the
// actual host from the incoming request so the UI won't always show localhost.
app.get('/api-docs.json', (req, res) => {
  try {
    const hostFromReq = `${req.protocol}://${req.get('host')}`;
    const serverUrls = (process.env.SERVER_URLS || process.env.SERVER_URL)
      ? (process.env.SERVER_URLS || process.env.SERVER_URL).split(',').map(s => s.trim()).filter(Boolean)
      : [hostFromReq];

    const servers = serverUrls.map(url => ({ url, description: url.includes('localhost') ? 'Local server' : 'Server' }));

    // Build dynamic spec from template but do NOT include `servers`.
    const dynamicSpec = Object.assign({}, specsTemplate);
    // Ensure any servers field is removed so Swagger UI does not display Servers list
    if (dynamicSpec.servers) delete dynamicSpec.servers;
    res.json(dynamicSpec);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(null, { swaggerUrl: '/api-docs.json' }));













/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   example: 2024-01-01T00:00:00.000Z
 */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});


/**
 * POST /api/payment/auth
 * Proxies client_id and client_secret to PayPack and returns tokens
 */
app.use('/api/payment', paymentRouter);

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Swagger UI available at http://${HOST}:${PORT}/api-docs`);
});
