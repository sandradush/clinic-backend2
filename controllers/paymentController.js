const axios = require('axios');
const pool = require('../config/db');

// Step 3: Query transaction event
exports.getTransactionEvent = async (req, res) => {
  try {
    const { ref, kind, client, status } = req.query;
    if (!ref || !kind || !client || !status) {
      return res.status(400).json({ error: 'ref, kind, client, and status are required query parameters' });
    }

    // Get credentials from env
    const client_id = process.env.PAYPACK_CLIENT_ID;
    const client_secret = process.env.PAYPACK_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'Paypack credentials not set in environment' });
    }

    // Step 1: Get access token
    const authUrl = 'https://payments.paypack.rw/api/auth/agents/authorize';
    let access_token;
    try {
      const authRes = await axios.post(authUrl, { client_id, client_secret }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      access_token = authRes.data && authRes.data.access;
      if (!access_token) {
        return res.status(502).json({ error: 'Failed to obtain access token from Paypack' });
      }
    } catch (authErr) {
      if (authErr.response) {
        return res.status(authErr.response.status || 502).json(authErr.response.data || { error: 'Auth error from payment provider' });
      }
      return res.status(500).json({ error: authErr.message });
    }

    // Step 2: Query transaction event
    const url = `https://payments.paypack.rw/api/events/transactions?ref=${encodeURIComponent(ref)}&kind=${encodeURIComponent(kind)}&client=${encodeURIComponent(client)}&status=${encodeURIComponent(status)}`;
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      timeout: 10000
    });
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Bad response from payment provider' });
    }
    return res.status(500).json({ error: err.message });
  }
};
// Step 2: Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, number, patient_id } = req.body || {};
    if (!amount || !number) {
      return res.status(400).json({ error: 'amount and number are required' });
    }

    // Get credentials from env
    const client_id = process.env.PAYPACK_CLIENT_ID;
    const client_secret = process.env.PAYPACK_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'Paypack credentials not set in environment' });
    }

    // Step 1: Get access token
    const authUrl = 'https://payments.paypack.rw/api/auth/agents/authorize';
    let access_token;
    try {
      const authRes = await axios.post(authUrl, { client_id, client_secret }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      access_token = authRes.data && authRes.data.access;
      if (!access_token) {
        return res.status(502).json({ error: 'Failed to obtain access token from Paypack' });
      }
    } catch (authErr) {
      if (authErr.response) {
        return res.status(authErr.response.status || 502).json(authErr.response.data || { error: 'Auth error from payment provider' });
      }
      return res.status(500).json({ error: authErr.message });
    }

    // Step 2: Initiate payment
    const url = 'https://payments.paypack.rw/api/transactions/cashin';
    const payload = { amount, number };
    if (patient_id) payload.patient_id = patient_id;

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${access_token}`
        },
        timeout: 10000
      }
    );
    // Include patient_id in the response that we return to the client for traceability
    const providerData = response.data || {};
    const out = Object.assign({}, providerData);
    if (patient_id) out.patient_id = patient_id;

    // Persist the initiated payment to the database
    try {
      const statusFromProvider = providerData.status || 'pending';
      const ref = providerData.ref || providerData.reference || null;
      const kind = providerData.kind || null;
      const provider_ref = ref;
      const createdAt = providerData.created_at || null;

      const insertQuery = `INSERT INTO payments
        (amount, number, patient_id, status, provider_ref, provider_kind, provider_response, ref, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *`;
      const insertValues = [amount, number, patient_id || null, statusFromProvider, provider_ref, kind, JSON.stringify(providerData), ref || null, createdAt];
      const insertRes = await pool.query(insertQuery, insertValues);
      const saved = insertRes.rows && insertRes.rows[0] ? insertRes.rows[0] : null;
      // Return the provider response merged with saved DB row for traceability
      return res.status(response.status).json({ provider: out, payment: saved });
    } catch (dbErr) {
      // If DB insert fails, return 500 with provider response and DB error
      return res.status(500).json({ error: 'Failed to persist payment', details: dbErr.message, provider: out });
    }
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Bad response from payment provider' });
    }
    return res.status(500).json({ error: err.message });
  }
};
exports.authorize = async (req, res) => {
  try {
    const { client_id, client_secret } = req.body || {};
    if (!client_id || !client_secret) {
      return res.status(400).json({ error: 'client_id and client_secret are required' });
    }

    const url = 'https://payments.paypack.rw/api/auth/agents/authorize';
    const response = await axios.post(url, { client_id, client_secret }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Bad response from payment provider' });
    }
    return res.status(500).json({ error: err.message });
  }
};

// Update payment status in the database
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { status, provider_ref } = req.body || {};
    if (!id) return res.status(400).json({ error: 'payment id is required as URL param' });
    if (!status) return res.status(400).json({ error: 'status is required in request body' });

    const query = `UPDATE payments SET status = $2, provider_ref = COALESCE($3, provider_ref), updated_at = NOW() WHERE id = $1 RETURNING *`;
    const values = [id, status, provider_ref || null];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
