require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { scanReceipt } = require('./src/ocr');
const { compareAll } = require('./src/scrapers/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer: imagen en memoria, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se aceptan imágenes JPEG, PNG, WEBP o GIF'));
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/scan — Escanea imagen con Claude Vision
app.post('/api/scan', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere una imagen' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  }

  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;
    const result = await scanReceipt(imageBase64, mediaType);
    res.json(result);
  } catch (err) {
    console.error('Error en OCR:', err.message);
    res.status(500).json({ error: `Error al procesar imagen: ${err.message}` });
  }
});

// POST /api/compare — Compara precios de una lista de productos
app.post('/api/compare', async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere una lista de productos' });
  }

  if (items.length > 30) {
    return res.status(400).json({ error: 'Máximo 30 productos por consulta' });
  }

  try {
    const results = await compareAll(items);
    res.json({ results });
  } catch (err) {
    console.error('Error en comparación:', err.message);
    res.status(500).json({ error: `Error al comparar precios: ${err.message}` });
  }
});

// Sirve el frontend para cualquier ruta no API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Scanner de tickets corriendo en http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ADVERTENCIA: ANTHROPIC_API_KEY no configurada. Copia .env.example a .env y agrega tu clave.');
  }
});
