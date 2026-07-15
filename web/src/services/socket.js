import { io } from 'socket.io-client';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, '');

let socket = null;
let currentDeviceId = null;

const reminderListeners = new Set();
const intakeListeners = new Set();

export function onReminder(cb) {
  reminderListeners.add(cb);
  return () => reminderListeners.delete(cb);
}

export function onIntake(cb) {
  intakeListeners.add(cb);
  return () => intakeListeners.delete(cb);
}

export function connectDevice(deviceId) {
  const id = (deviceId || '').trim();

  if (!id) {
    disconnect();
    return null;
  }

  if (socket && currentDeviceId === id) return socket;

  disconnect();
  currentDeviceId = id;

  socket = io(SOCKET_URL, {
    query: { device_id: id },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log(`Connected to socket server for device ${id}`);
  });
  socket.on('disconnect', () => {
    console.log(`Disconnected from socket server for device ${id}`);
  });
  socket.on('connect_error', (error) => {
    console.error(`Socket connection error for device ${id}:`, error);
  });

  socket.on('intake', (data) => {
    console.log(`Intake received for device ${id}:`, data);
    intakeListeners.forEach((cb) => cb(data));
  });

  socket.on('reminder', (data) => {
    console.log(`Reminder received for device ${id}:`, data);
    reminderListeners.forEach((cb) => cb(data));
  });

  return socket;
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentDeviceId = null;
}

export function getSocket() {
  return socket;
}