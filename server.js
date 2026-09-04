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

// Route de connexion : POST /auth/login
// Vérifie l'email et le mot de passe, puis renvoie un jeton JWT si tout est correct
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérification simple : on refuse si un champ obligatoire manque
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe sont obligatoires' });
    }

    // On cherche un utilisateur avec cet email dans la base
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Si aucun utilisateur trouvé, on refuse la connexion
    // On donne volontairement un message vague ("email ou mot de passe incorrect")
    // plutôt que de préciser "email inconnu", pour ne pas donner d'indice
    // à quelqu'un qui essaierait de deviner des comptes existants
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // On compare le mot de passe tapé avec le mot de passe haché stocké en base
    // bcrypt.compare fait le hachage du mot de passe tapé, puis compare les deux résultats hachés
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Si tout correspond, on crée un jeton JWT
    // Ce jeton contient l'id de l'utilisateur, signé avec notre clé secrète
    // Il expire après 7 jours, après quoi l'utilisateur devra se reconnecter
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Le port est lu depuis .env ; si non défini, on utilise 3000 par défaut
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur WakaTrack démarré sur http://localhost:${PORT}`);
});