const verifyRole = (requiredRole) => (req, res, next) => {
    const { rol } = req.user; // Asumiendo que 'id_rol' es un número en el token JWT
    
    // Mapear los roles a números
    const roles = {
        administrador: 1,
        galponero: 2
    };

    if (rol !== roles[requiredRole]) {
        return res.status(403).json({ error: 'Acceso denegado: rol no autorizado' });
    }
    
    next(); // Si el rol coincide, continúa con la petición
};

module.exports = verifyRole;
