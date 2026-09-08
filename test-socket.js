// test-socket.js
// Ce script écoute les événements en temps réel pour Roan,
// notamment les entrées et sorties de zones de sécurité

const { io } = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc4ODgxMDk5NCwiZXhwIjoxNzg5NDE1Nzk0fQ.WgjRganOvmUADneoJOHW5E5jf_H23d1NSpnIT4_-LYs';

const socket = io('http://localhost:3000', {
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('Roan est connecté et attend des événements');
});

socket.on('zoneEvent', (data) => {
  console.log('Événement de zone reçu :', data);
});

socket.on('connect_error', (error) => {
  console.log('Erreur de connexion :', error.message);
});