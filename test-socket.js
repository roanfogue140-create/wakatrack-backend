// test-socket.js
// Petit script de test, joue le rôle d'un client qui se connecte au WebSocket
// Ce fichier est temporaire, juste pour vérifier que la connexion fonctionne

const { io } = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc4ODU2MjA1MiwiZXhwIjoxNzg5MTY2ODUyfQ.OecPjLi0G6YWbwPzoSiEXL9EsdTph46Ktb5DG5SPJ_k';

const socket = io('http://localhost:3000', {
  auth: {
    token: TOKEN
  }
});

socket.on('connect', () => {
  console.log('Connecté avec succès au serveur WebSocket');
});

socket.on('connect_error', (error) => {
  console.log('Erreur de connexion :', error.message);
});