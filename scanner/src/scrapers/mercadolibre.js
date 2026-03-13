// Mercado Libre Uruguay — API pública, sin autenticación
const axios = require('axios');

const ML_SITE = 'MLU';
const ML_API = 'https://api.mercadolibre.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-UY,es;q=0.9',
  'Origin': 'https://www.mercadolibre.com.uy',
  'Referer': 'https://www.mercadolibre.com.uy/',
};

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
      `${ML_API}/sites/${ML_SITE}/search?q=${query}&limit=8`,
      { headers: HEADERS, timeout: 12000 }
    );

    const results = data?.results ?? [];
    if (results.length === 0) {
      console.log(`[MercadoLibre] Sin resultados para: ${productName}`);
      return null;
    }

    const available = results.filter((r) => r.price > 0);
    if (available.length === 0) return null;

    const best = available.reduce((prev, curr) =>
      jaccardSimilarity(curr.title || '', productName) >
      jaccardSimilarity(prev.title || '', productName) ? curr : prev
    );

    console.log(`[MercadoLibre] Encontrado: "${best.title}" $${best.price}`);
    return {
      store: 'Mercado Libre UY',
      store_url: 'https://www.mercadolibre.com.uy',
      product_name: best.title,
      price: best.price,
      currency: 'UYU',
      url: best.permalink,
    };
  } catch (err) {
    console.log(`[MercadoLibre] Error ${err.response?.status ?? err.message}`);
    return null;
  }
}

module.exports = { searchPrice, STORE_NAME: 'Mercado Libre UY' };
