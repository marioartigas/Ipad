// Google Custom Search — gratis hasta 100 búsquedas/día
// Setup: https://programmablesearchengine.google.com
const axios = require('axios');

const GOOGLE_API = 'https://www.googleapis.com/customsearch/v1';

// Extrae precio en UYU de un snippet de texto de Google
function extractPrice(text) {
  if (!text) return null;
  // Patrones: "$1.234", "$ 1234", "1234 pesos", "$1234,50"
  const patterns = [
    /\$\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/,
    /(\d{1,3}(?:\.\d{3})+)(?:\s?(?:pesos|UYU))?/,
    /(\d{3,6})\s?(?:pesos|UYU)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const n = parseFloat(raw);
      if (n > 10 && n < 100000) return n; // rango razonable UYU
    }
  }
  return null;
}

async function searchPrice(productName) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    console.log('[Google] GOOGLE_API_KEY o GOOGLE_CX no configurados en .env');
    return null;
  }

  const query = `${productName} precio uruguay supermercado`;

  try {
    const { data } = await axios.get(GOOGLE_API, {
      params: { key: apiKey, cx, q: query, num: 5, gl: 'uy', hl: 'es' },
      timeout: 10000,
    });

    const items = data?.items ?? [];
    if (items.length === 0) {
      console.log(`[Google] Sin resultados para: ${productName}`);
      return null;
    }

    // Buscar precio en snippets/títulos
    for (const item of items) {
      const text = `${item.title} ${item.snippet}`;
      const price = extractPrice(text);
      if (price) {
        console.log(`[Google] Encontrado: "${item.title}" $${price}`);
        return {
          store: 'Búsqueda web',
          store_url: item.link,
          product_name: item.title.substring(0, 80),
          price,
          currency: 'UYU',
          url: item.link,
        };
      }
    }

    console.log(`[Google] No se encontró precio en los resultados de: ${productName}`);
    return null;
  } catch (err) {
    console.log(`[Google] Error: ${err.response?.status ?? err.message}`);
    return null;
  }
}

module.exports = { searchPrice, STORE_NAME: 'Búsqueda web' };
