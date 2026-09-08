// server.js
// Point d'entrée du serveur backend WakaTrack

// Charge les variables définies dans le fichier .env (ex: PORT, clés secrètes)
// Doit être appelé tout en haut, avant d'utiliser process.env
// Calcule la distance en mètres entre deux points GPS
// grâce à la formule de Haversine, qui tient compte de la courbure de la Terre
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon moyen de la Terre, en mètres
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
}
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authMiddleware = require('./authMiddleware');

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

// Route protégée de test : GET /profile
// Le middleware authMiddleware s'exécute avant cette route
// Si le jeton est invalide, la requête est bloquée avant même d'arriver ici
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    // Grâce au middleware, on connaît déjà l'id de l'utilisateur connecté
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour envoyer une demande d'ami : POST /friends/request
// L'utilisateur connecté envoie une demande à quelqu'un, identifié par son email
app.post('/friends/request', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'L\'email de la personne à ajouter est obligatoire' });
    }

    // On cherche l'utilisateur cible grâce à son email
    const targetUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Aucun utilisateur trouvé avec cet email' });
    }

    // On empêche un utilisateur de s'ajouter lui-même en ami
    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même en ami' });
    }

    // On vérifie qu'une demande n'existe pas déjà entre ces deux personnes,
    // peu importe qui a envoyé la demande en premier
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: req.userId, receiverId: targetUser.id },
          { requesterId: targetUser.id, receiverId: req.userId }
        ]
      }
    });

    if (existingFriendship) {
      return res.status(409).json({ error: 'Une relation existe déjà avec cet utilisateur' });
    }

    // On crée la nouvelle demande d'ami, avec le statut par défaut "pending"
    const friendship = await prisma.friendship.create({
      data: {
        requesterId: req.userId,
        receiverId: targetUser.id
      }
    });

    res.status(201).json({
      message: 'Demande d\'ami envoyée',
      friendship
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour répondre à une demande d'ami : POST /friends/respond
// Permet d'accepter ou de refuser une demande reçue
app.post('/friends/respond', authMiddleware, async (req, res) => {
  try {
    const { friendshipId, accept } = req.body;

    // "accept" doit être un booléen : true pour accepter, false pour refuser
    if (!friendshipId || typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'friendshipId et accept (true/false) sont obligatoires' });
    }

    // On cherche la demande d'ami concernée
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });

    if (!friendship) {
      return res.status(404).json({ error: 'Demande d\'ami introuvable' });
    }

    // Sécurité : seule la personne qui a reçu la demande peut y répondre
    if (friendship.receiverId !== req.userId) {
      return res.status(403).json({ error: 'Tu n\'es pas autorisé à répondre à cette demande' });
    }

    // On vérifie que la demande est bien encore en attente
    if (friendship.status !== 'pending') {
      return res.status(409).json({ error: 'Cette demande a déjà été traitée' });
    }

    // On met à jour le statut selon la réponse de l'utilisateur
    const updatedFriendship = await prisma.friendship.update({
      where: { id: friendshipId },
      data: {
        status: accept ? 'accepted' : 'refused'
      }
    });

    res.json({
      message: accept ? 'Demande acceptée' : 'Demande refusée',
      friendship: updatedFriendship
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour lister ses amis : GET /friends
// Renvoie la liste des relations acceptées, avec les infos de l'ami
app.get('/friends', authMiddleware, async (req, res) => {
  try {
    // On cherche toutes les relations acceptées où l'utilisateur connecté
    // est soit le demandeur, soit le destinataire
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: req.userId },
          { receiverId: req.userId }
        ]
      },
      include: {
        requester: true,
        receiver: true
      }
    });

    // Pour chaque relation, on affiche les infos de "l'autre personne",
    // pas celles de l'utilisateur connecté lui-même
    const friendsList = friendships.map(friendship => {
      const friend = friendship.requesterId === req.userId
        ? friendship.receiver
        : friendship.requester;

      return {
        friendshipId: friendship.id,
        id: friend.id,
        name: friend.name,
        email: friend.email
      };
    });

    res.json({
      count: friendsList.length,
      friends: friendsList
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour démarrer un partage de position : POST /sharing/start
// L'utilisateur connecté autorise un ami précis à voir sa position,
// pendant une durée donnée en minutes
app.post('/sharing/start', authMiddleware, async (req, res) => {
  try {
    const { friendId, durationMinutes } = req.body;

    if (!friendId || !durationMinutes) {
      return res.status(400).json({ error: 'friendId et durationMinutes sont obligatoires' });
    }

    // On vérifie qu'une amitié acceptée existe bien entre les deux personnes,
    // peu importe qui avait envoyé la demande à l'origine
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: req.userId, receiverId: friendId },
          { requesterId: friendId, receiverId: req.userId }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ error: 'Vous devez être amis pour partager votre position' });
    }

    // On calcule la date de fin du partage
    // Date.now() donne l'heure actuelle en millisecondes
    // On ajoute la durée demandée, convertie elle aussi en millisecondes
    const endDate = new Date(Date.now() + durationMinutes * 60 * 1000);

    // On crée la session de partage
    const session = await prisma.sharingSession.create({
      data: {
        userId: req.userId,
        friendId: friendId,
        endDate: endDate,
        isActive: true
      }
    });

    res.status(201).json({
      message: 'Partage de position activé',
      session
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour arrêter un partage de position : POST /sharing/stop
// Permet une révocation immédiate, comme prévu par F12
app.post('/sharing/stop', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId est obligatoire' });
    }

    const session = await prisma.sharingSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session de partage introuvable' });
    }

    // Sécurité : seul le propriétaire de cette session peut l'arrêter
    if (session.userId !== req.userId) {
      return res.status(403).json({ error: 'Tu n\'es pas autorisé à arrêter cette session' });
    }

    const updatedSession = await prisma.sharingSession.update({
      where: { id: sessionId },
      data: { isActive: false }
    });

    res.json({
      message: 'Partage de position arrêté',
      session: updatedSession
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Le téléphone de l'utilisateur connecté envoie sa position actuelle
app.post('/positions', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    // On vérifie que latitude et longitude sont bien présentes et numériques
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude et longitude doivent être des nombres' });
    }

    // Vérification basique de cohérence géographique
    // La latitude va de -90 à 90, la longitude de -180 à 180
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Coordonnées GPS invalides' });
    }

    const position = await prisma.position.create({
      data: {
        userId: req.userId,
        latitude,
        longitude,
        accuracy: accuracy || null
      }
    });

    // On cherche tous les amis qui ont actuellement un partage actif
    // et non expiré vers l'utilisateur qui vient d'envoyer sa position
    const activeSessions = await prisma.sharingSession.findMany({
      where: {
        userId: req.userId,
        isActive: true,
        endDate: {
          gt: new Date()
        }
      }
    });

    // Pour chaque ami autorisé, on envoie la nouvelle position
    // directement dans son salon personnel
    activeSessions.forEach((session) => {
      io.to(`user-${session.friendId}`).emit('positionUpdate', {
        userId: req.userId,
        latitude: position.latitude,
        longitude: position.longitude,
        recordedAt: position.recordedAt
      });
    });

// Vérification des zones de sécurité : on regarde si cette nouvelle position
// fait entrer ou sortir l'utilisateur d'une de ses zones enregistrées
const userSafeZones = await prisma.safeZone.findMany({
  where: { userId: req.userId }
});

// On récupère la position juste avant celle-ci, pour connaître l'état précédent
const previousPosition = await prisma.position.findFirst({
  where: {
    userId: req.userId,
    id: { not: position.id }
  },
  orderBy: { recordedAt: 'desc' }
});

for (const zone of userSafeZones) {
  const currentDistance = calculateDistance(
    latitude, longitude,
    zone.latitude, zone.longitude
  );
  const isInsideNow = currentDistance <= zone.radius;

  let wasInsideBefore = false;

  if (previousPosition) {
    const previousDistance = calculateDistance(
      previousPosition.latitude, previousPosition.longitude,
      zone.latitude, zone.longitude
    );
    wasInsideBefore = previousDistance <= zone.radius;
  }

  // On envoie une notification seulement si l'état a changé
  if (isInsideNow && !wasInsideBefore) {
    io.to(`user-${req.userId}`).emit('zoneEvent', {
      type: 'enter',
      zoneName: zone.name,
      zoneId: zone.id
    });
  } else if (!isInsideNow && wasInsideBefore) {
    io.to(`user-${req.userId}`).emit('zoneEvent', {
      type: 'exit',
      zoneName: zone.name,
      zoneId: zone.id
    });
  }
}

    res.status(201).json({
      message: 'Position enregistrée',
      position
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour créer une zone de sécurité : POST /safezones
app.post('/safezones', authMiddleware, async (req, res) => {
  try {
    const { name, latitude, longitude, radius } = req.body;

    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof radius !== 'number') {
      return res.status(400).json({ error: 'name, latitude, longitude et radius sont obligatoires' });
    }

    if (radius <= 0) {
      return res.status(400).json({ error: 'Le rayon doit être un nombre positif' });
    }

    const safeZone = await prisma.safeZone.create({
      data: {
        userId: req.userId,
        name,
        latitude,
        longitude,
        radius
      }
    });

    res.status(201).json({
      message: 'Zone de sécurité créée',
      safeZone
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour lister ses zones de sécurité : GET /safezones
app.get('/safezones', authMiddleware, async (req, res) => {
  try {
    const safeZones = await prisma.safeZone.findMany({
      where: { userId: req.userId }
    });

    res.json({ safeZones });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour supprimer une zone de sécurité : DELETE /safezones/:id
app.delete('/safezones/:id', authMiddleware, async (req, res) => {
  try {
    const zoneId = parseInt(req.params.id);

    if (isNaN(zoneId)) {
      return res.status(400).json({ error: 'Identifiant de zone invalide' });
    }

    const zone = await prisma.safeZone.findUnique({
      where: { id: zoneId }
    });

    if (!zone) {
      return res.status(404).json({ error: 'Zone de sécurité introuvable' });
    }

    // Sécurité : seul le propriétaire de la zone peut la supprimer
    if (zone.userId !== req.userId) {
      return res.status(403).json({ error: 'Tu n\'es pas autorisé à supprimer cette zone' });
    }

    await prisma.safeZone.delete({
      where: { id: zoneId }
    });

    res.json({ message: 'Zone de sécurité supprimée' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour déclencher une alerte SOS : POST /sos
// Envoie immédiatement la position et une notification à tous les amis
app.post('/sos', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude et longitude doivent être des nombres' });
    }

    // On enregistre l'alerte dans la base, avec le statut "active"
    const sosAlert = await prisma.sosAlert.create({
      data: {
        userId: req.userId,
        latitude,
        longitude
      }
    });

    // On récupère les informations de l'utilisateur, pour personnaliser la notification
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    // On cherche tous les amis de cet utilisateur, peu importe qui a partage actif ou non,
    // puisqu'une alerte SOS doit atteindre tout le cercle de confiance
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: req.userId },
          { receiverId: req.userId }
        ]
      }
    });

    // Pour chaque ami, on envoie immédiatement une notification dans son salon personnel
    friendships.forEach((friendship) => {
      const friendId = friendship.requesterId === req.userId
        ? friendship.receiverId
        : friendship.requesterId;

      io.to(`user-${friendId}`).emit('sosAlert', {
        alertId: sosAlert.id,
        fromUserId: user.id,
        fromUserName: user.name,
        latitude: sosAlert.latitude,
        longitude: sosAlert.longitude,
        triggeredAt: sosAlert.triggeredAt
      });
    });

    res.status(201).json({
      message: 'Alerte SOS envoyée à tes amis',
      sosAlert
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour marquer une alerte SOS comme résolue : POST /sos/resolve
app.post('/sos/resolve', authMiddleware, async (req, res) => {
  try {
    const { alertId } = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'alertId est obligatoire' });
    }

    const alert = await prisma.sosAlert.findUnique({
      where: { id: alertId }
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alerte introuvable' });
    }

    // Sécurité : seule la personne qui a déclenché l'alerte peut la résoudre
    if (alert.userId !== req.userId) {
      return res.status(403).json({ error: 'Tu n\'es pas autorisé à résoudre cette alerte' });
    }

    const updatedAlert = await prisma.sosAlert.update({
      where: { id: alertId },
      data: { status: 'resolved' }
    });

    res.json({
      message: 'Alerte marquée comme résolue',
      sosAlert: updatedAlert
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// Route pour voir la dernière position d'un ami : GET /positions/:friendId
// Ne fonctionne que si un partage actif et non expiré existe
app.get('/positions/:friendId', authMiddleware, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);

    if (isNaN(friendId)) {
      return res.status(400).json({ error: 'Identifiant d\'ami invalide' });
    }

    // On cherche une session de partage active de cet ami vers l'utilisateur connecté
    const session = await prisma.sharingSession.findFirst({
      where: {
        userId: friendId,
        friendId: req.userId,
        isActive: true,
        endDate: {
          gt: new Date()
          // "gt" veut dire "greater than", donc la date de fin doit être
          // dans le futur par rapport à maintenant
        }
      }
    });

    if (!session) {
      return res.status(403).json({ error: 'Cet utilisateur ne partage pas sa position avec toi actuellement' });
    }

    // On cherche la dernière position connue de cet ami
    const lastPosition = await prisma.position.findFirst({
      where: { userId: friendId },
      orderBy: { recordedAt: 'desc' }
      // "desc" veut dire décroissant, donc la position la plus récente en premier
    });

    if (!lastPosition) {
      return res.status(404).json({ error: 'Aucune position disponible pour cet utilisateur' });
    }

    res.json({ position: lastPosition });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur, réessaie plus tard' });
  }
});

// On importe le module HTTP natif de Node.js
const http = require('http');
// On crée un serveur HTTP, en lui donnant notre application Express
const server = http.createServer(app);

// On importe Socket.IO, et on l'attache à ce même serveur HTTP
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*'
    // On autorise toute origine pour l'instant, en développement
    // On restreindra cette valeur plus tard, une fois l'app Flutter connue
  }
});

// Middleware Socket.IO : vérifie le jeton JWT au moment de la connexion
io.use((socket, next) => {
  // Le client devra envoyer son jeton dans "socket.handshake.auth.token"
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Jeton d\'authentification manquant'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // On attache l'id de l'utilisateur directement à l'objet "socket",
    // pour pouvoir l'utiliser dans tous les événements suivants de cette connexion
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Jeton invalide ou expiré'));
  }
});

// Cette fonction s'exécute à chaque fois qu'un client se connecte avec succès
io.on('connection', (socket) => {
  console.log(`Utilisateur ${socket.userId} connecté en temps réel`);

  // On fait entrer cet utilisateur dans son salon personnel
  // Le nom du salon est construit à partir de son identifiant
  socket.join(`user-${socket.userId}`);

  socket.on('disconnect', () => {
    console.log(`Utilisateur ${socket.userId} déconnecté`);
  });
});

const PORT = process.env.PORT || 3000;

// C'est maintenant "server.listen" et non plus "app.listen"
// puisque c'est le serveur HTTP complet qu'on démarre, Express et Socket.IO ensemble
server.listen(PORT, () => {
  console.log(`Serveur WakaTrack démarré sur http://localhost:${PORT}`);
});