const axios = require('axios');
const cheerio = require('cheerio');
const { vtexSearch, parseUruguayanPrice } = require('./_vtex');
const STORE_NAME = 'Ta-Ta';
const STORE_URL = 'https://www.ta-ta.com.uy';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept-Language': 'es-UY,es;q=0.9',
};

async function searchPrice(productName) {
  // Intentar con distintos posibles nombres de cuenta VTEX
  for (const account of ['tata', 'superta', 'tatauruguay']) {
    const result = await vtexSearch(`www.ta-ta.com.uy`, account, STORE_URL, STORE_NAME, productName);
    if (result) return result;
  }

  // Fallback: distintas URLs de búsqueda
  const encoded = encodeURIComponent(productName);
  for (const searchUrl of [
    `${STORE_URL}/buscar?q=${encoded}`,
    `${STORE_URL}/search?q=${encoded}`,
    `${STORE_URL}/busca/?ft=${encoded}`,
  ]) {
    try {
      const { data: html } = await axios.get(searchUrl, {
        headers: { ...HEADERS, Accept: 'text/html' },
        timeout: 10000,
        maxRedirects: 5,
      });
      const $ = cheerio.load(html);
      const priceEl = $('.bestPrice, .price-best-price, [class*="sellingPrice"], [class*="price"]').first();
      const nameEl = $('.productName, [class*="product-name"]').first();
      const linkEl = $('a[href*="/p"]').first();
      const price = parseUruguayanPrice(priceEl.text());
      if (!price) continue;
      const href = linkEl.attr('href') || '';
      return {
        store: STORE_NAME, store_url: STORE_URL,
        product_name: nameEl.text().trim() || productName,
        price, currency: 'UYU',
        url: href.startsWith('http') ? href : `${STORE_URL}${href}`,
      };
    } catch (_) { continue; }
  }
  return null;
}

module.exports = { searchPrice, STORE_NAME };
