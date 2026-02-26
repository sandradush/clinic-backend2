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
