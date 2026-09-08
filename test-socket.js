// test-socket.js
// Ce script écoute les événements en temps réel pour Awa,
// notamment les alertes SOS de ses amis

const { io } = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImlhdCI6MTc4ODgzMjA1MCwiZXhwIjoxNzg5NDM2ODUwfQ.BY0_vvbykgLCZJmpJMJzCedugDhA88QHZFbo9Rpf3PM';

const socket = io('http://localhost:3000', {
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('Awa est connectée et attend des événements');
});

socket.on('sosAlert', (data) => {
  console.log('ALERTE SOS reçue :', data);
});

socket.on('connect_error', (error) => {
  console.log('Erreur de connexion :', error.message);
});