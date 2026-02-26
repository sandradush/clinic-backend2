// Step 2: Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, number } = req.body || {};
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
    const response = await axios.post(
      url,
      { amount, number },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${access_token}`
        },
        timeout: 10000
      }
    );
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status || 502).json(err.response.data || { error: 'Bad response from payment provider' });
    }
    return res.status(500).json({ error: err.message });
  }
};
const axios = require('axios');

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
