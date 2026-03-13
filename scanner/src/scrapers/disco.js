const axios = require('axios');
const cheerio = require('cheerio');

const STORE_NAME = 'Disco';
const STORE_URL = 'https://www.disco.com.uy';

async function searchPrice(productName) {
  const query = encodeURIComponent(productName);

  // Disco puede usar VTEX
  const apiUrl = `https://disco.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search?query=${query}&count=3&locale=es-UY`;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'application/json',
      },
      timeout: 8000,
    });

    const products = response.data?.products;
    if (products && products.length > 0) {
      const first = products[0];
      const price = first?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
      if (price) {
        return {
          store: STORE_NAME,
          store_url: STORE_URL,
          product_name: first.productName,
          price: price,
          currency: 'UYU',
          url: `${STORE_URL}/${first.linkText}/p`,
        };
      }
    }
  } catch (_vtexErr) {
    // Fallback HTML
  }

  // Fallback HTML scraping
  const searchUrl = `${STORE_URL}/busca/?ft=${query}`;
  const htmlResponse = await axios.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(htmlResponse.data);

  const priceEl = $('.bestPrice, .price, [class*="price"] .sellingPrice').first();
  const nameEl = $('.productName, [class*="product-name"]').first();
  const linkEl = $('a[href*="/p"]').first();

  const priceText = priceEl.text().trim().replace(/[^\d,.]/g, '').replace(',', '.');
  const price = parseFloat(priceText);

  if (!price || isNaN(price)) return null;

  return {
    store: STORE_NAME,
    store_url: STORE_URL,
    product_name: nameEl.text().trim() || productName,
    price: price,
    currency: 'UYU',
    url: linkEl.attr('href') ? `${STORE_URL}${linkEl.attr('href')}` : searchUrl,
  };
}

module.exports = { searchPrice, STORE_NAME };
