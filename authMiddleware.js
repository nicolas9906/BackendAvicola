const jwt = require('jsonwebtoken');

// Middleware para verificar el token JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ error: 'Token no proporcionado' });
    }

    // Verificar el token
    jwt.verify(token.replace('Bearer ', ''), 'secret_key', (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido' });
        }
        req.user = decoded; // Guardamos los datos decodificados en req.user
        next();
    });
};

module.exports = verifyToken;
