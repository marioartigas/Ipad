// Mercado Libre Uruguay — API pública, sin autenticación
// Documentación: https://developers.mercadolibre.com.uy/
const axios = require('axios');

const ML_SITE = 'MLU'; // Uruguay
const ML_API = 'https://api.mercadolibre.com';

// Categorías de supermercado en ML Uruguay
const SUPERMARKET_CATEGORIES = [
  'MLU1246', // Alimentos y Bebidas
  'MLU1367', // Limpieza y Hogar
];

function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

async function searchPrice(productName) {
  const query = encodeURIComponent(productName);

  try {
    const { data } = await axios.get(
      `${ML_API}/sites/${ML_SITE}/search?q=${query}&limit=10`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );

    const results = data?.results ?? [];
    if (results.length === 0) return null;

    // Filtrar solo productos en stock con precio
    const available = results.filter(
      (r) => r.price > 0 && r.available_quantity > 0
    );
    if (available.length === 0) return null;

    // Elegir el más similar al nombre buscado
    const best = available.reduce((prev, curr) => {
      const scoreA = jaccardSimilarity(prev.title || '', productName);
      const scoreB = jaccardSimilarity(curr.title || '', productName);
      return scoreB > scoreA ? curr : prev;
    });

    return {
      store: 'Mercado Libre UY',
      store_url: 'https://www.mercadolibre.com.uy',
      product_name: best.title,
      price: best.price,
      currency: 'UYU',
      url: best.permalink,
    };
  } catch (err) {
    console.log(`[MercadoLibre] Error: ${err.message}`);
    return null;
  }
}

module.exports = { searchPrice, STORE_NAME: 'Mercado Libre UY' };
