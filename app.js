const express = require('express');
const bodyParser = require('body-parser');
const pool = require('./Config/db'); // Conexión a la base de datos
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const verifyToken = require('./middlewares/authMiddleware');
const verifyRole = require('./middlewares/roleMiddleware');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());


app.use(cors({
    origin: 'http://localhost:3000' // Cambia a 'localhost:3000' si el frontend corre en otro puerto
}));









// Obtener producción por id_usuario
app.get('/produccion/:id_usuario', verifyToken, async (req, res) => {
    const { id_usuario } = req.params; // Obtener el id_usuario de los parámetros de la URL

    try {
        // Consulta para obtener toda la producción del usuario específico junto con el saldo_aves del galpón
        const query = `
                SELECT 
                p.id, 
                p.produccion_huevos, 
                p.cantidad_bultos, 
                p.mortalidad_gallinas, 
                p.fecha, 
                g.numero_galpon, 
                 p.porcentaje, 
                 p.color,
                g.saldo_aves 
            FROM produccion p
            JOIN galpon g ON p.galpon_id = g.id
            WHERE p.id_usuario = ?
            `;

        const [result] = await pool.query(query, [id_usuario]);
        const formattedResult = result.map(item => ({
            id: item.id,
            produccion_huevos: item.produccion_huevos,
            cantidad_bultos: item.cantidad_bultos,
            mortalidad_gallinas: item.mortalidad_gallinas,
            fecha: item.fecha,
            porcentaje:item.porcentaje,
            color: item.color,
            usuario: {
                id: item.usuario_id,
                nombre: item.usuario_nombre,
            },
            galpon: {
                numero: item.galpon_numero,
                saldo_aves: item.saldo_aves,
            },
        }));
      
        

        if (result.length === 0) {
            return res.status(404).json({ error: 'No se encontró producción para este usuario' });
        }
        res.status(200).json(formattedResult);

       
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//sumar todo el saldo_aves


app.get('/saldo_aves', verifyToken, async (req, res) => {
    try {
        const query = 'SELECT SUM(saldo_aves) AS total_saldo_aves FROM galpon';
        const [result] = await pool.query(query);

        res.status(200).json({ total_saldo_aves: result[0].total_saldo_aves });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});





// mostrar produccion
app.get('/produccion', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id, 
                p.produccion_huevos, 
                p.cantidad_bultos, 
                p.mortalidad_gallinas, 
                p.fecha, 
                p.porcentaje, 
                 p.color,
                u.id AS usuario_id, 
                u.nombre AS usuario_nombre,
                g.numero_galpon AS galpon_numero,
                g.saldo_aves AS galpon_saldo_aves
            FROM produccion p
            JOIN usuarios u ON p.id_usuario = u.id
            JOIN galpon g ON p.galpon_id = g.id
            ORDER BY p.fecha DESC;  -- Ordena por fecha de menor a mayor
        `;
        
        const [result] = await pool.query(query);
        
        // Transformar los resultados a la estructura deseada
        const formattedResult = result.map(item => ({
            id: item.id,
            produccion_huevos: item.produccion_huevos,
            cantidad_bultos: item.cantidad_bultos,
            mortalidad_gallinas: item.mortalidad_gallinas,
            porcentaje:item.porcentaje,
            color: item.color,
            fecha: item.fecha,
            usuario: {
                id: item.usuario_id,
                nombre: item.usuario_nombre,
            },
            galpon: {
                numero: item.galpon_numero,
                saldo_aves: item.galpon_saldo_aves,
            },
        }));
        
        res.status(200).json(formattedResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



    app.post('/produccion', verifyToken, async (req, res) => {
        const { produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario, galpon_id, entrada_inventario = 0 } = req.body;

        // Validación de entrada
        if (!produccion_huevos || !cantidad_bultos || !mortalidad_gallinas || !id_usuario || !galpon_id) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        try {
            // Insertar en la tabla produccion con la fecha actual
            const insertProduccionQuery = `
                INSERT INTO produccion (produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario, galpon_id, fecha)
                VALUES (?, ?, ?, ?, ?, NOW())
            `;

            
            const [produccionResult] = await pool.query(insertProduccionQuery, [produccion_huevos, cantidad_bultos, mortalidad_gallinas, id_usuario, galpon_id]);

            
            
            // Obtener el último saldo del inventario
            const [ultimoSaldo] = await pool.query('SELECT saldo FROM consumo_inventario ORDER BY id DESC LIMIT 1');
            
            const saldoAnterior = ultimoSaldo.length ? ultimoSaldo[0].saldo : 0; // Obtener el saldo anterior, o 0 si no existe

            const salidaInventario = cantidad_bultos;
            const nuevoSaldo = saldoAnterior + entrada_inventario - salidaInventario;

            // Registro de logs para depuración
            console.log('Saldo anterior:', saldoAnterior);
            console.log('Entrada de inventario:', entrada_inventario);
            console.log('Salida de inventario:', salidaInventario);
            console.log('Nuevo saldo:', nuevoSaldo);

    // Validar que el saldo sea suficiente para cubrir la cantidad de bultos
    if (saldoAnterior < cantidad_bultos) {
        return res.status(400).json({ error: 'El saldo de inventario es insuficiente para la cantidad de bultos.' });
    }

            // Insertar en la tabla consumo_inventario con la fecha actual
            const insertInventarioQuery = `
                INSERT INTO consumo_inventario (fecha, inventario_inicial, entrada_inventario, salida_inventario, saldo, id_produccion)
                VALUES (NOW(), ?, ?, ?, ?, ?)
            `;
            await pool.query(insertInventarioQuery, [saldoAnterior, entrada_inventario, salidaInventario, nuevoSaldo, produccionResult.insertId]);




    // actualizar saldo de aves tabla galpon
            const [saldoAvesData] = await pool.query('SELECT saldo_aves FROM galpon WHERE id = ?', [galpon_id]);
            if (saldoAvesData.length === 0) {
                // Si no se encuentra el galpón, deshacer la transacción
                await pool.query('ROLLBACK');
                return res.status(404).json({ error: 'Galpón no encontrado' });
            }

            const saldoAvesActual = saldoAvesData[0].saldo_aves;

            // Restar la mortalidad de gallinas del saldo actual de aves
            const nuevoSaldoAves = saldoAvesActual - mortalidad_gallinas;
            if (nuevoSaldoAves < 0) {
                // Deshacer la transacción si el saldo es negativo
                await pool.query('ROLLBACK');
                return res.status(400).json({ error: 'La mortalidad de gallinas excede el saldo actual de aves' });
            }

            // Actualizar el saldo_aves en la tabla galpon
            const updateSaldoAvesQuery = `
                UPDATE galpon SET saldo_aves = ? WHERE id = ?
            `;
            await pool.query(updateSaldoAvesQuery, [nuevoSaldoAves, galpon_id]);

            // Calcular el porcentaje
            let porcentaje = (produccion_huevos / nuevoSaldoAves) * 100;
            if (porcentaje > 10000) { // Límite arbitrario, ajustable según el contexto
                porcentaje = 10000;
            }
            // Actualizar el campo porcentaje en la tabla produccion
           
            // Obtener el rango_pro para la fecha actual
                const [rangoProData] = await pool.query('SELECT rango_pro FROM porcentaje WHERE fecha = CURDATE() LIMIT 1');

                let color = 'red'; // Color por defecto en rojo
                if (rangoProData.length > 0 && porcentaje >= rangoProData[0].rango_pro) {
                    color = 'green'; // Cambiar a verde si el porcentaje es mayor o igual al rango_pro
                }

                // Actualizar el campo porcentaje y color en la tabla produccion
                const updatePorcentajeQuery = `
                    UPDATE produccion SET porcentaje = ?, color = ? WHERE id = ?
                `;
                await pool.query(updatePorcentajeQuery, [porcentaje, color, produccionResult.insertId]);


            res.status(201).json({ message: 'Producción e inventario creados con éxito',
                porcentaje,
            rango_pro: rangoProData.length > 0 ? rangoProData[0].rango_pro : null,
            color
             });
        } catch (err) {
            console.error('Error en la operación:', err); // Log más detalles para depuración
            res.status(500).json({ error: 'Error en el servidor, intente nuevamente más tarde', details: err.message });
        }
    });


//igreso de los bultos y el calculo del kardex

app.post('/consumo_inventario', async (req, res) => {
    const { entrada_inventario, salida_inventario = 0, id_produccion = null } = req.body;
    try {
        // Obtener el saldo anterior del inventario
        const [ultimoSaldo] = await pool.query('SELECT saldo FROM consumo_inventario ORDER BY id DESC LIMIT 1');
        const saldoAnterior = parseFloat(ultimoSaldo.length ? ultimoSaldo[0].saldo : 0); // Convertir a número
        const entradaInventarioNum = parseFloat(entrada_inventario);

        console.log(ultimoSaldo);
        console.log(saldoAnterior);
        
        // Calcular el nuevo saldo
        const nuevoSaldo = saldoAnterior + entrada_inventario - salida_inventario;


     // Registro de logs para depuración
     console.log('Saldo anterior:', saldoAnterior);
     console.log('Entrada de inventario:', entrada_inventario);
     console.log('Nuevo saldo:', nuevoSaldo);
        // Insertar el nuevo registro en la tabla consumo_inventario
        const query = `
            INSERT INTO consumo_inventario (fecha, inventario_inicial, entrada_inventario, salida_inventario, saldo, id_produccion)
            VALUES (NOW(), ?, ?, ?, ?, ?)
        `;
        await pool.query(query, [saldoAnterior, entrada_inventario, salida_inventario, nuevoSaldo, id_produccion]);

        res.status(201).json({ message: 'Entrada de inventario agregada con éxito' });
    } catch (err) {
        console.error('Error en la operación:', err); // Registro de errores para depuración
        res.status(500).json({ error: 'Error en el servidor, intente nuevamente más tarde', details: err.message });
    }
});




///inventario concentrado
app.get('/consumo_inventario', async (req, res) => {
    try {
        const query = `
            SELECT ci.fecha, ci.inventario_inicial, ci.entrada_inventario, ci.salida_inventario, ci.saldo, p.galpon_id
            FROM consumo_inventario ci
            LEFT JOIN produccion p ON ci.id_produccion = p.id
            ORDER BY ci.id DESC
        `;
        const [result] = await pool.query(query);
        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});









//actualizacion de produccion por id



app.put('/produccion/:id', verifyToken, verifyRole('administrador'), async (req, res) => {
    const { id } = req.params;
    const { produccion_huevos, cantidad_bultos, mortalidad_gallinas } = req.body;

    try {
        // Obtener los valores actuales de la producción
        const [currentData] = await pool.query(
            'SELECT mortalidad_gallinas FROM produccion WHERE id = ?',
            [id]
        );

        if (currentData.length === 0) {
            return res.status(404).json({ error: 'Producción no encontrada' });
        }

        const currentMortalidadGallinas = parseFloat(currentData[0].mortalidad_gallinas);

        // Actualizar la producción
        const [result] = await pool.query(
            'UPDATE produccion SET produccion_huevos = ?, cantidad_bultos = ?, mortalidad_gallinas = ? WHERE id = ?',
            [produccion_huevos, cantidad_bultos, mortalidad_gallinas, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producción no encontrada' });
        }

        // Obtener galpon_id y saldo_aves actual desde la tabla galpon relacionada con el id de produccion
        const [galponData] = await pool.query(
            `SELECT g.saldo_aves, p.galpon_id 
             FROM galpon g 
             INNER JOIN produccion p ON g.id = p.galpon_id 
             WHERE p.id = ?`,
            [id]
        );

        if (galponData.length === 0) {
            return res.status(404).json({ error: 'Galpón no encontrado para la producción especificada' });
        }

        const { galpon_id, saldo_aves: saldoAvesActual } = galponData[0];

        // Calcular el nuevo saldo de aves
        let nuevoSaldoAves = saldoAvesActual;

        if (mortalidad_gallinas < currentMortalidadGallinas) {
            // Si la nueva mortalidad es menor que la anterior, sumamos la diferencia al saldo de aves
            const excedente = currentMortalidadGallinas - mortalidad_gallinas;
            nuevoSaldoAves += excedente;
        } else {
            // Si la nueva mortalidad es mayor o igual que la anterior, restamos la diferencia
            nuevoSaldoAves -= (mortalidad_gallinas - currentMortalidadGallinas);
        }

        if (nuevoSaldoAves < 0) {
            return res.status(400).json({ error: 'La mortalidad de gallinas excede el saldo actual de aves' });
        }

        // Actualizar el saldo_aves en la tabla galpon
        await pool.query(
            'UPDATE galpon SET saldo_aves = ? WHERE id = ?',
            [nuevoSaldoAves, galpon_id]
        );

        // Calcular el porcentaje de producción de huevos sobre saldo de aves y actualizar en la tabla produccion
        let porcentaje = (produccion_huevos / nuevoSaldoAves) * 100;
        if (porcentaje > 10000) {
            porcentaje = 10000; // Límite máximo arbitrario
        }

        // Obtener el rango_pro para la fecha actual
        const [rangoProData] = await pool.query(
            'SELECT rango_pro FROM porcentaje WHERE fecha = CURDATE()'
        );

        // Determinar el color según el rango
        let color = 'red';
        if (rangoProData.length > 0 && porcentaje >= rangoProData[0].rango_pro) {
            color = 'green';
        }

        // Actualizar el porcentaje y color en la tabla produccion
        await pool.query(
            'UPDATE produccion SET porcentaje = ?, color = ? WHERE id = ?',
            [porcentaje, color, id]
        );

        res.status(200).json({
            message: 'Producción, inventario y saldo de aves actualizados correctamente',
            color: color
        });
    } catch (err) {
        console.error('Error en la operación:', err); // Log para depuración
        res.status(500).json({ error: 'Error en el servidor, intente nuevamente más tarde' });
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
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Guarda en memoria



app.post('/register', upload.single('imagen'), async (req, res) => {
    const { nombre, cedula, edad, id_galpon, id_rol, password } = req.body;


    try {
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insertar datos
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, cedula, edad, id_galpon, id_rol, password, imagen) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nombre, cedula, edad, id_galpon, id_rol, hashedPassword, imagen]
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
            { id_usuario: user.id, nombre: user.nombre, rol: user.id_rol,galpon_id: user.id_galpon,cedula:user.cedula,edad:user.edad,imagen:user.imagen}, // Información a codificar en el token
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