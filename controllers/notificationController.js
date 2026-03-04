const pool = require('../config/db');

exports.createNotification = async (req, res) => {
  try {
    const { to_user_id, title, message, meta } = req.body || {};
    if (!to_user_id || !title || !message) {
      return res.status(400).json({ error: 'to_user_id, title and message are required' });
    }

    const insertQuery = `INSERT INTO notifications
      (to_user_id, title, message, meta, read, created_at)
      VALUES ($1,$2,$3,$4,false,NOW())
      RETURNING *`;
    const values = [to_user_id, title, message, meta ? JSON.stringify(meta) : null];
    const result = await pool.query(insertQuery, values);
    const saved = result.rows[0];

    // Emit real-time notification to connected user(s) if any
    try {
      const socketLib = require('../lib/socket');
      socketLib.emitToUser(saved.to_user_id, 'notification', saved);
    } catch (emitErr) {
      // don't block on socket errors
      console.warn('emitToUser error', emitErr.message);
    }

    return res.status(201).json(saved);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Broadcast notification to multiple users and/or to a role
exports.broadcastNotification = async (req, res) => {
  try {
    const { to_user_ids, to_role, title, message, meta } = req.body || {};
    if ((!to_user_ids || !Array.isArray(to_user_ids) || to_user_ids.length === 0) && !to_role) {
      return res.status(400).json({ error: 'to_user_ids (array) or to_role is required' });
    }
    if (!title || !message) return res.status(400).json({ error: 'title and message are required' });

    const savedNotifications = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (Array.isArray(to_user_ids) && to_user_ids.length) {
        const insertQ = `INSERT INTO notifications (to_user_id, title, message, meta, read, created_at)
          VALUES ($1,$2,$3,$4,false,NOW()) RETURNING *`;
        for (const uid of to_user_ids) {
          const vals = [uid, title, message, meta ? JSON.stringify(meta) : null];
          const r = await client.query(insertQ, vals);
          savedNotifications.push(r.rows[0]);
        }
      }

      if (to_role) {
        // Create a notification row targeting the role sentinel so it appears in admin inbox if you use 'admin' as to_user_id
        const insertQ = `INSERT INTO notifications (to_user_id, title, message, meta, read, created_at)
          VALUES ($1,$2,$3,$4,false,NOW()) RETURNING *`;
        const r = await client.query(insertQ, [to_role, title, message, meta ? JSON.stringify(meta) : null]);
        savedNotifications.push(r.rows[0]);
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Emit via sockets
    try {
      const socketLib = require('../lib/socket');
      if (Array.isArray(to_user_ids) && to_user_ids.length) {
        for (const n of savedNotifications.filter(s => to_user_ids.includes(s.to_user_id))) {
          socketLib.emitToUser(n.to_user_id, 'notification', n);
        }
      }
      if (to_role) {
        const roleNotif = savedNotifications.find(s => s.to_user_id === to_role);
        if (roleNotif) socketLib.emitToRole(to_role, 'notification', roleNotif);
      }
    } catch (emitErr) {
      console.warn('broadcast emit error', emitErr.message);
    }

    return res.status(201).json({ notifications: savedNotifications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getNotificationsForUser = async (req, res) => {
  try {
    const { userId } = req.params || {};
    if (!userId) return res.status(400).json({ error: 'userId param is required' });
    const q = 'SELECT * FROM notifications WHERE to_user_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(q, [userId]);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
