// test-socket.js
// Ce script joue le rôle d'Awa, connectée en temps réel,
// en attente de recevoir la position de Roan

const { io } = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImlhdCI6MTc4ODgxMDczMywiZXhwIjoxNzg5NDE1NTMzfQ.0hJvWd8UlYDrF-16jGZBp3J4JKXwc6zPaGW9DUxNiAs';

const socket = io('http://localhost:3000', {
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('Awa est connectée et attend une mise à jour de position');
});

socket.on('positionUpdate', (data) => {
  console.log('Nouvelle position reçue :', data);
});

socket.on('connect_error', (error) => {
  console.log('Erreur de connexion :', error.message);
});