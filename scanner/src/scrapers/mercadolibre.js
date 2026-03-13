// Mercado Libre Uruguay — API con OAuth client credentials (gratis)
const axios = require('axios');

const ML_SITE = 'MLU';
const ML_API = 'https://api.mercadolibre.com';

// Cache del token de acceso (expira cada 6 horas)
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const appId = process.env.ML_APP_ID;
  const secret = process.env.ML_SECRET_KEY;

  if (!appId || !secret) {
    console.log('[MercadoLibre] ML_APP_ID o ML_SECRET_KEY no configurados en .env');
    return null;
  }

  try {
    const { data } = await axios.post(
      `${ML_API}/oauth/token`,
      `grant_type=client_credentials&client_id=${appId}&client_secret=${secret}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }
    );

    tokenCache.token = data.access_token;
    // Expira en (expires_in - 60) segundos para renovar con margen
    tokenCache.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    console.log('[MercadoLibre] Token de acceso obtenido correctamente');
    return tokenCache.token;
  } catch (err) {
    console.log(`[MercadoLibre] Error obteniendo token: ${err.response?.data?.message ?? err.message}`);
    return null;
  }
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

async function searchPrice(productName) {
  const token = await getAccessToken();
  if (!token) return null;

  const query = encodeURIComponent(productName);

  try {
    const { data } = await axios.get(
      `${ML_API}/sites/${ML_SITE}/search?q=${query}&limit=8`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        timeout: 12000,
      }
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
