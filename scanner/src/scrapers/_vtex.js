const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept-Language': 'es-UY,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

// Uruguay: "1.234,50" → 1234.50
function parseUruguayanPrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/[^\d,.]/g, '')   // quita todo excepto dígitos, punto y coma
    .replace(/\.(?=\d{3})/g, '') // quita punto si es separador de miles
    .replace(',', '.');          // cambia coma decimal a punto
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Jaccard similarity entre dos strings (por palabras)
function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Selecciona el producto con mayor similitud al término buscado
function bestMatch(products, query) {
  if (!products || products.length === 0) return null;
  return products.reduce((best, p) => {
    const score = jaccardSimilarity(p.productName || '', query);
    return score > (best._score || 0) ? { ...p, _score: score } : best;
  }, { _score: -1 });
}

// Intenta VTEX Intelligent Search API, con fallback a HTML scraping
async function vtexSearch(domain, storeUrl, storeName, query) {
  const encoded = encodeURIComponent(query);

  // Intento 1: VTEX Intelligent Search JSON API
  try {
    const apiUrl = `https://${domain}/api/io/_v/api/intelligent-search/product_search?query=${encoded}&count=5&locale=es-UY`;
    const { data } = await axios.get(apiUrl, {
      headers: { ...HEADERS, Accept: 'application/json' },
      timeout: 8000,
      maxRedirects: 5,
    });

    const products = data?.products ?? [];
    if (products.length > 0) {
      const match = bestMatch(products, query);
      const price =
        match?.priceRange?.sellingPrice?.lowPrice ??
        match?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;

      if (price) {
        return {
          store: storeName,
          store_url: storeUrl,
          product_name: match.productName,
          price,
          currency: 'UYU',
          url: `${storeUrl}/${match.linkText}/p`,
        };
      }
    }
  } catch (_) { /* caer al fallback */ }

  // Intento 2: HTML scraping legado VTEX
  try {
    const htmlUrl = `${storeUrl}/busca/?ft=${encoded}&_from=0&_to=4`;
    const { data: html } = await axios.get(htmlUrl, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(html);
    const priceEl = $('.bestPrice, .price-best-price, [class*="sellingPrice"]').first();
    const nameEl = $('.productName, [class*="product-name"]').first();
    const linkEl = $('a[href*="/p"]').first();

    const price = parseUruguayanPrice(priceEl.text());
    if (!price) return null;

    const href = linkEl.attr('href') || '';
    return {
      store: storeName,
      store_url: storeUrl,
      product_name: nameEl.text().trim() || query,
      price,
      currency: 'UYU',
      url: href.startsWith('http') ? href : `${storeUrl}${href}`,
    };
  } catch (_) {
    return null;
  }
}

module.exports = { vtexSearch, parseUruguayanPrice, jaccardSimilarity };
