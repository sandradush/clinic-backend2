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
    const { amount, number, patient_id, appointment_id } = req.body || {};
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
    if (appointment_id) payload.appointment_id = appointment_id;

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
      // Ensure payments table has appointment_id column
      await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS appointment_id TEXT");
      const statusFromProvider = providerData.status || 'pending';
      const ref = providerData.ref || providerData.reference || null;
      const kind = providerData.kind || null;
      const provider_ref = ref;
      const createdAt = providerData.created_at || null;

      const insertQuery = `INSERT INTO payments
        (amount, number, patient_id, appointment_id, status, provider_ref, provider_kind, provider_response, ref, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`;
      const insertValues = [amount, number, patient_id || null, appointment_id || null, statusFromProvider, provider_ref, kind, JSON.stringify(providerData), ref || null, createdAt];
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

// Admin payments listing removed — use other admin tools or queries as needed.

// Get payments for a patient
// (removed) getPatientPayments endpoint - route deleted

// Add a payment for a patient if not already present
exports.addPatientPayment = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { amount, number, provider_ref, ref } = req.body || {};
    if (!patientId) return res.status(400).json({ error: 'patient id is required' });
    if (!amount || !number) return res.status(400).json({ error: 'amount and number are required' });

    // Check for existing by provider_ref/ref first
    if (provider_ref || ref) {
      const checkQ = `SELECT * FROM payments WHERE (provider_ref = $1 OR ref = $2) AND patient_id = $3 LIMIT 1`;
      const chk = await pool.query(checkQ, [provider_ref || null, ref || null, patientId]);
      if (chk.rowCount > 0) return res.json({ ok: true, existing: chk.rows[0] });
    }

    // Fallback: avoid duplicates by matching amount+number+patient within last 5 minutes
    const dupQ = `SELECT * FROM payments WHERE patient_id = $1 AND amount = $2 AND number = $3 AND created_at >= NOW() - INTERVAL '5 minutes' LIMIT 1`;
    const dup = await pool.query(dupQ, [patientId, amount, number]);
    if (dup.rowCount > 0) return res.json({ ok: true, existing: dup.rows[0] });

    const insertQ = `INSERT INTO payments (amount, number, patient_id, status, provider_ref, ref, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`;
    const vals = [amount, number, patientId, 'pending', provider_ref || null, ref || null];
    const ins = await pool.query(insertQ, vals);
    return res.json({ ok: true, payment: ins.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Admin approves a payment and updates related appointment(s)
exports.approvePayment = async (req, res) => {
  const { paymentId } = req.params || {};
  const { note } = req.body || {};
  // admin id should be provided by requireAdmin middleware
  const admin_id = req.admin_id;
  if (!paymentId) return res.status(400).json({ error: 'paymentId param is required' });
  if (!admin_id) return res.status(403).json({ error: 'admin identity not available' });

  const client = await pool.connect();
  try {
    console.log('approvePayment called for paymentId=', paymentId, 'admin_id=', admin_id);
    await client.query('BEGIN');

    // Ensure columns exist to record approval info (safe to run repeatedly)
    await client.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_by TEXT");
    await client.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ");
    await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT");
    await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ");

    // Update payments
    const updatePaymentQ = `UPDATE payments SET status = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`;
    const paymentRes = await client.query(updatePaymentQ, [paymentId, 'approved', admin_id]);
    console.log('payment update result rowCount=', paymentRes.rowCount);
    if (paymentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = paymentRes.rows[0];

    // Update related appointment(s) by payment_id if that column exists
    let appointment = null;
    try {
      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'payment_id' LIMIT 1`
      );
      if (colCheck.rowCount > 0) {
        const updateAppQ = `UPDATE appointments SET payment_status = $2, payment_approved_at = NOW() WHERE payment_id = $1 RETURNING *`;
        const appRes = await client.query(updateAppQ, [paymentId, 'approved']);
        appointment = appRes.rows && appRes.rows[0] ? appRes.rows[0] : null;
      }
    } catch (appErr) {
      // If appointments table or column doesn't exist or update fails, continue without blocking approval
      appointment = null;
    }

    // If an appointment was updated, create a notification for the patient
    try {
      if (appointment) {
        const toUserId = appointment.patient_id || appointment.user_id || payment.patient_id || null;
        if (toUserId) {
          const noteText = note || 'Your payment was approved and appointment is confirmed.';
          const notifQ = `INSERT INTO notifications (to_user_id, title, message, meta, read, created_at)
            VALUES ($1,$2,$3,$4,false,NOW()) RETURNING *`;
          const notifVals = [toUserId, 'Payment Approved', noteText, JSON.stringify({ payment_id: paymentId })];
          const notifRes = await client.query(notifQ, notifVals);
          const notifSaved = notifRes.rows[0];
          try {
            const socketLib = require('../lib/socket');
            socketLib.emitToUser(toUserId, 'notification', notifSaved);
          } catch (emitErr) {
            console.warn('emit notification error', emitErr.message);
          }
        }
      }
    } catch (notifErr) {
      // log and continue
      console.warn('failed to create/emit appointment notification', notifErr.message);
    }

    // Optionally record admin note in a simple approvals table (create if not exists)
    await client.query(`CREATE TABLE IF NOT EXISTS payment_approvals (
      id BIGSERIAL PRIMARY KEY,
      payment_id BIGINT NOT NULL,
      admin_id TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);
    await client.query('INSERT INTO payment_approvals(payment_id, admin_id, note) VALUES ($1,$2,$3)', [paymentId, admin_id, note || null]);

    await client.query('COMMIT');
    return res.json({ ok: true, payment, appointment });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
