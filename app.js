const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./db'); // Conexión a la base de datos
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const verifyToken = require('./authMiddleware');
const verifyRole = require('./roleMiddleware');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());


app.use(cors({
    origin: 'http://localhost:3000' // Cambia a 'localhost:3000' si el frontend corre en otro puerto
}));

// CRUD Producción
// Crear Producción (solo galponero)
app.post('/produccion', verifyToken, async (req, res) => {
    const { produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario,galpon_id } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO produccion (produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario, galpon_id, fecha) VALUES (?, ?, ?, ?,?, NOW())',
            [produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario, galpon_id]
        );
        res.status(201).json("registro exitoso");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener producción por id_usuario
app.get('/produccion/:id_usuario', verifyToken, async (req, res) => {
    const { id_usuario } = req.params; // Obtener el id_usuario de los parámetros de la URL

    try {
        // Consulta para obtener toda la producción del usuario específico
        const [result] = await pool.query(
            'SELECT * FROM produccion WHERE id_usuario = ?', 
            [id_usuario]
        );

        if (result.length === 0) {
            return res.status(404).json({ error: 'No se encontró producción para este usuario' });
        }

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/produccion', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                p.produccion_huevos, 
                p.cantidad_bultos, 
                p.mortalidad_gallinas, 
                p.fecha, 
                u.id AS usuario_id, 
                u.nombre AS usuario_nombre,
                g.numero_galpon AS galpon_numero
            FROM produccion p
            JOIN usuarios u ON p.id_usuario = u.id
            JOIN galpon g ON p.galpon_id = g.id
        `;
        
        const [result] = await pool.query(query);
        
        // Transformar los resultados a la estructura deseada
        const formattedResult = result.map(item => ({
            id: item.id,
            produccion_huevos: item.produccion_huevos,
            cantidad_bultos: item.cantidad_bultos,
            mortalidad_gallinas: item.mortalidad_gallinas,
            fecha: item.fecha,
            usuario: {
                id: item.usuario_id,
                nombre: item.usuario_nombre,
            },
            galpon: {
                numero: item.galpon_numero,
            },
        }));
        
        res.status(200).json(formattedResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





app.put('/produccion/:id', verifyToken, verifyRole('administrador'), async (req, res) => {
    const { id } = req.params;
    const { produccion_huevos, cantidad_bultos, mortalidad_gallinas } = req.body;

    try {
        const [result] = await pool.query(
            'UPDATE produccion SET produccion_huevos = ?, cantidad_bultos = ?, mortalidad_gallinas = ? WHERE id = ?',
            [produccion_huevos, cantidad_bultos, mortalidad_gallinas, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producción no encontrada' });
        }

        res.status(200).json({ message: 'Producción actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/produccion/:id', verifyToken, verifyRole('administrador'), async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM produccion WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producción no encontrada' });
        }

        res.status(200).json({ message: 'Producción eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// para registrar los usuarios

// Ruta de registro de usuario
app.post('/register', async (req, res) => {
    const { nombre, cedula, edad, id_galpon, id_rol, password } = req.body;

    try {
        // Cifrar la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Guardar el usuario en la base de datos
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, cedula, edad, id_galpon, id_rol, password) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, cedula, edad, id_galpon, id_rol, hashedPassword]
        );

        res.status(201).json({ message: 'Usuario registrado con éxito', userId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});




app.post('/login', async (req, res) => {
    const { cedula, password } = req.body;

    try {
     
        const [result] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', [cedula]);
        const user = result[0]; 
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

       
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Contraseña incorrecta' });
        }


        //TOKEN
        const token = jwt.sign(
            { id_usuario: user.id, nombre: user.nombre, rol: user.id_rol,galpon_id: user.id_galpon }, // Información a codificar en el token
            'secret_key', // Clave secreta para firmar el token
            { expiresIn: '1h' } // Tiempo de expiración del token
        );

        // Enviar el token al cliente
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.use(cors()); // Permite todas las solicitudes CORS

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});