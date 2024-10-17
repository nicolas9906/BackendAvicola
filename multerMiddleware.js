const multer = require('multer');

// Configuración de multer
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Límite de 5 MB para el archivo
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Formato de archivo no soportado'), false);
        }
    }
});

module.exports = upload;
