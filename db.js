const mysql = require('mysql2/promise'); 

const pool = mysql.createPool({
    host: '127.0.0.1',           // Cambia esto si tu MySQL no está en localhost
    user: 'root',          // Cambia esto a tu usuario de MySQL
    password: 'root',   // Cambia esto a tu contraseña de MySQL
    database: 'avicultura',// Cambia esto al nombre de tu base de datos
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verifica la conexión
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.stack);
        return;
    }
    console.log('Conexión a la base de datos exitosa');
    connection.release(); // Libera la conexión de vuelta al pool
});

module.exports = pool;
