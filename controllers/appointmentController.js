const pool = require('../config/db');

// Admin assigns a doctor to an appointment and notifies the patient
exports.assignDoctor = async (req, res) => {
  const { appointmentId } = req.params || {};
  const { doctor_id, note } = req.body || {};
  const admin_id = req.admin_id || (req.body && req.body.admin_id);
  if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });
  if (!doctor_id) return res.status(400).json({ error: 'doctor_id is required' });
  if (!admin_id) return res.status(403).json({ error: 'admin identity required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure appointment has doctor_id and assigned_at columns
    await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_id TEXT");
    await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ");
    await client.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT");

    const updateQ = `UPDATE appointments SET doctor_id = $2, status = $3, assigned_at = NOW() WHERE id = $1 RETURNING *`;
    const updateRes = await client.query(updateQ, [appointmentId, doctor_id, 'assigned']);
    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const appointment = updateRes.rows[0];

    // Create notification to patient
    const toUserId = appointment.patient_id || appointment.user_id || null;
    let savedNotif = null;
    if (toUserId) {
      const notifQ = `INSERT INTO notifications (to_user_id, title, message, meta, read, created_at)
        VALUES ($1,$2,$3,$4,false,NOW()) RETURNING *`;
      const msg = note || `A doctor has been assigned to your appointment.`;
      const notifVals = [toUserId, 'Doctor Assigned', msg, JSON.stringify({ appointment_id: appointmentId, doctor_id })];
      const notifRes = await client.query(notifQ, notifVals);
      savedNotif = notifRes.rows[0];
      try {
        const socketLib = require('../lib/socket');
        socketLib.emitToUser(toUserId, 'notification', savedNotif);
      } catch (emitErr) {
        console.warn('emitToUser error', emitErr.message);
      }
    }

    await client.query('COMMIT');
    return res.json({ ok: true, appointment, notification: savedNotif });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Patient books an appointment (creates appointment) and notifies admins
// createAppointment removed — use existing booking endpoint
