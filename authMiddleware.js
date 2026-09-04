// authMiddleware.js
// Ce middleware vérifie que la requête contient un jeton JWT valide
// avant de laisser passer vers la route protégée

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // On récupère le header "Authorization" de la requête
  const authHeader = req.headers.authorization;

  // Si le header est absent, on refuse immédiatement
  if (!authHeader) {
    return res.status(401).json({ error: 'Jeton d\'authentification manquant' });
  }

  // Le header a la forme "Bearer le-jeton-ici"
  // On sépare le mot "Bearer" du vrai jeton
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Format du jeton invalide' });
  }

  const token = parts[1];

  try {
    // On vérifie que le jeton est valide et n'a pas été modifié
    // jwt.verify renvoie le contenu du jeton s'il est valide,
    // ou lève une erreur s'il est invalide ou expiré
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // On attache l'id de l'utilisateur à la requête,
    // pour que les routes suivantes puissent savoir qui fait la demande
    req.userId = decoded.userId;

    // "next()" veut dire "laisse passer, continue vers la route demandée"
    next();

  } catch (error) {
    return res.status(401).json({ error: 'Jeton invalide ou expiré' });
  }
}

module.exports = authMiddleware;