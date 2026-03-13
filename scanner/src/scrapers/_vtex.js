const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept-Language': 'es-UY,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

// Uruguay: "1.234,50" → 1234.50
function parseUruguayanPrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/[^\d,.]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.');
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

function bestMatch(products, query) {
  if (!products || products.length === 0) return null;
  return products.reduce((best, p) => {
    const score = jaccardSimilarity(p.productName || p.name || '', query);
    return score > (best._score || 0) ? { ...p, _score: score } : best;
  }, { _score: -1 });
}

function buildResult(storeName, storeUrl, productName, price, linkText) {
  const url = linkText
    ? (linkText.startsWith('http') ? linkText : `${storeUrl}/${linkText}/p`)
    : storeUrl;
  return { store: storeName, store_url: storeUrl, product_name: productName, price, currency: 'UYU', url };
}

async function vtexSearch(domain, vtexAccount, storeUrl, storeName, query) {
  const encoded = encodeURIComponent(query);

  // Intento 1: VTEX Catalog API legacy via subdominio vtexcommercestable (el más compatible)
  try {
    const url = `https://${vtexAccount}.vtexcommercestable.com.br/api/catalog_system/pub/products/search?ft=${encoded}&_from=0&_to=4`;
    const { data } = await axios.get(url, {
      headers: { ...HEADERS, Accept: 'application/json' },
      timeout: 8000,
    });
    if (Array.isArray(data) && data.length > 0) {
      const match = bestMatch(data, query);
      const price = match?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
      if (price) {
        console.log(`[${storeName}] Encontrado via VTEX Catalog: ${match.productName} $${price}`);
        return buildResult(storeName, storeUrl, match.productName, price, match.linkText);
      }
    }
  } catch (e) {
    console.log(`[${storeName}] VTEX Catalog falló: ${e.message}`);
  }

  // Intento 2: VTEX Intelligent Search via dominio propio
  try {
    const url = `https://${domain}/_v/api/intelligent-search/product_search?query=${encoded}&count=5&locale=es-UY`;
    const { data } = await axios.get(url, {
      headers: { ...HEADERS, Accept: 'application/json' },
      timeout: 8000,
    });
    const products = data?.products ?? [];
    if (products.length > 0) {
      const match = bestMatch(products, query);
      const price = match?.priceRange?.sellingPrice?.lowPrice
        ?? match?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
      if (price) {
        console.log(`[${storeName}] Encontrado via IS API: ${match.productName} $${price}`);
        return buildResult(storeName, storeUrl, match.productName, price, match.linkText);
      }
    }
  } catch (e) {
    console.log(`[${storeName}] IS API falló: ${e.message}`);
  }

  // Intento 3: VTEX Intelligent Search via subdominio vtexcommercestable
  try {
    const url = `https://${vtexAccount}.vtexcommercestable.com.br/_v/api/intelligent-search/product_search?query=${encoded}&count=5&locale=es-UY`;
    const { data } = await axios.get(url, {
      headers: { ...HEADERS, Accept: 'application/json' },
      timeout: 8000,
    });
    const products = data?.products ?? [];
    if (products.length > 0) {
      const match = bestMatch(products, query);
      const price = match?.priceRange?.sellingPrice?.lowPrice
        ?? match?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
      if (price) {
        console.log(`[${storeName}] Encontrado via IS subdominio: ${match.productName} $${price}`);
        return buildResult(storeName, storeUrl, match.productName, price, match.linkText);
      }
    }
  } catch (e) {
    console.log(`[${storeName}] IS subdominio falló: ${e.message}`);
  }

  // Intento 4: HTML scraping
  try {
    const htmlUrl = `${storeUrl}/busca/?ft=${encoded}&_from=0&_to=4`;
    const { data: html } = await axios.get(htmlUrl, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
      maxRedirects: 5,
    });
    const $ = cheerio.load(html);
    const priceEl = $('.bestPrice, .price-best-price, [class*="sellingPrice"], .priceContainer').first();
    const nameEl = $('.productName, [class*="product-name"]').first();
    const linkEl = $('a[href*="/p"]').first();
    const price = parseUruguayanPrice(priceEl.text());
    if (!price) {
      console.log(`[${storeName}] HTML scraping: no se encontró precio`);
      return null;
    }
    const href = linkEl.attr('href') || '';
    console.log(`[${storeName}] Encontrado via HTML: $${price}`);
    return buildResult(storeName, storeUrl, nameEl.text().trim() || query, price,
      href.startsWith('http') ? href : `${storeUrl}${href}`);
  } catch (e) {
    console.log(`[${storeName}] HTML falló: ${e.message}`);
    return null;
  }
}

module.exports = { vtexSearch, parseUruguayanPrice, jaccardSimilarity };
