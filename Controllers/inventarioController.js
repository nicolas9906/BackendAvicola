// controllers/produccionController.js
const Produccion = require('../Models/Produccion');

const getProduccionByUserId = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const produccionData = await Produccion.getProduccionByUserId(id_usuario);
        if (!produccionData.length) {
            return res.status(404).json({ error: 'No se encontró producción para este usuario' });
        }
        res.status(200).json(produccionData);
    } catch (err) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

module.exports = { getProduccionByUserId };
