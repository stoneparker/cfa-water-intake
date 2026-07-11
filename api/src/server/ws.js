const { Server } = require('socket.io');

const io = new Server({ cors: { origin: '*' } });
const PORT = process.env.WS_PORT || 4001;
global.users = {};

// vai ser preciso criar alguma associação entre id do dispositivo e id da interface p enviar os lembretes
// exibir id no led para configurar no front-end?
io.on('connection', (socket) => {
  const deviceId = socket.handshake.query.device_id;

  global.users[deviceId] = socket;
  socket.data.deviceId = deviceId;

  console.log(`[socket] ${socket.id} registrado no device ${deviceId}`);

  socket.on('disconnect', () => {
    const socket = global.users[deviceId];
    if (!socket) return;
    delete global.users[deviceId];
  });
});

function run () {
  io.listen(PORT);
  console.log(`\n   Water Intake WebSocket Server rodando em ws://localhost:${PORT}`);
}

module.exports = { run };
