const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

// Route d'inscription : POST /auth/register
// Reçoit un nom, un email et un mot de passe, puis crée un nouvel utilisateur
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Vérification simple : on refuse si un champ obligatoire manque
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nom, email et mot de passe sont obligatoires' });
    }

    // On hache le mot de passe avant de le stocker
    // Le chiffre 10 correspond au "coût" du hachage : plus il est élevé,
    // plus c'est sécurisé, mais plus c'est lent. 10 est une valeur standard recommandée
    const hashedPassword = await bcrypt.hash(password, 10);

    // Création de l'utilisateur dans la base via Prisma
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    // On renvoie une réponse de succès
    // Attention : on ne renvoie jamais le mot de passe, même haché, dans la réponse
    res.status(201).json({
      message: 'Compte créé avec succès',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });

  } catch (error) {
    // Si l'email existe déjà, Prisma renvoie une erreur avec le code P2002
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Le port est lu depuis .env ; si non défini, on utilise 3000 par défaut
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur WakaTrack démarré sur http://localhost:${PORT}`);
});