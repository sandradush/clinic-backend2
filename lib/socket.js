let io = null;
const userSockets = new Map(); // userId -> Set(socket.id)
const roleSockets = new Map(); // role -> Set(socket.id)

function init(server, options = {}) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: options.corsOrigin || true }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query && (socket.handshake.query.userId || socket.handshake.query.user_id);
    const role = socket.handshake.query && (socket.handshake.query.role || socket.handshake.query.user_role);
    if (userId) {
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
      socket.data.userId = userId;
    }
    if (role) {
      if (!roleSockets.has(role)) roleSockets.set(role, new Set());
      roleSockets.get(role).add(socket.id);
      socket.data.role = role;
    }

    socket.on('disconnect', () => {
      const uid = socket.data.userId;
      if (uid && userSockets.has(uid)) {
        userSockets.get(uid).delete(socket.id);
        if (userSockets.get(uid).size === 0) userSockets.delete(uid);
      }
      const r = socket.data.role;
      if (r && roleSockets.has(r)) {
        roleSockets.get(r).delete(socket.id);
        if (roleSockets.get(r).size === 0) roleSockets.delete(r);
      }
    });
  });

  return io;
}

function emitToUser(userId, event, payload) {
  if (!io) return false;
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
  return true;
}

function emitToRole(role, event, payload) {
  if (!io) return false;
  const sockets = roleSockets.get(role);
  if (!sockets || sockets.size === 0) return false;
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
  return true;
}

function getIo() { return io; }

module.exports = { init, emitToUser, getIo };
