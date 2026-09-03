// server.js
// Point d'entrée du serveur backend WakaTrack

// Charge les variables définies dans le fichier .env (ex: PORT, clés secrètes)
// Doit être appelé tout en haut, avant d'utiliser process.env
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Crée l'application Express : c'est l'objet central qui va gérer
// toutes les requêtes HTTP entrantes (GET, POST, etc.)
const app = express();

// Middleware CORS : autorise les requêtes provenant d'une autre origine
// (par exemple notre future app Flutter qui tournera sur un autre port/domaine)
// Sans ça, le navigateur ou le client bloquerait les requêtes par sécurité par défaut
app.use(cors());

// Middleware qui permet à Express de comprendre le JSON envoyé dans le corps
// des requêtes (ex: { "email": "...", "password": "..." })
app.use(express.json());

// Route de test : GET / renvoie un message simple
// Utile pour vérifier rapidement que le serveur tourne bien
app.get('/', (req, res) => {
  res.json({
    message: 'WakaTrack API en ligne',
    status: 'ok'
  });
});

// Le port est lu depuis .env ; si non défini, on utilise 3000 par défaut
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur WakaTrack démarré sur http://localhost:${PORT}`);
});