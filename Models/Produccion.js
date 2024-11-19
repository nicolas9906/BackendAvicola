// models/Produccion.js
const pool = require('../Config/db');

module.exports = {
    getProduccionByUserId: async (id_usuario) => {
        const query = `
            SELECT 
                p.id, p.produccion_huevos, p.cantidad_bultos, p.mortalidad_gallinas, p.fecha, 
                p.porcentaje, p.color, g.numero_galpon, g.saldo_aves
            FROM produccion p
            JOIN galpon g ON p.galpon_id = g.id
            WHERE p.id_usuario = ?;
        `;
        const [rows] = await pool.query(query, [id_usuario]);
        return rows;
    },
    // Otros métodos para las consultas específicas de Produccion
};
