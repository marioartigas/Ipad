const axios = require('axios');

const STORE_NAME = 'Devoto';
const STORE_URL = 'https://www.devoto.com.uy';
const VTEX_ACCOUNT = 'devoto';

async function searchPrice(productName) {
  const query = encodeURIComponent(productName);
  const url = `https://${VTEX_ACCOUNT}.vtexcommercestable.com.br/api/io/_v/api/intelligent-search/product_search?query=${query}&count=3&locale=es-UY`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'application/json',
    },
    timeout: 8000,
  });

  const products = response.data?.products;
  if (!products || products.length === 0) return null;

  const first = products[0];
  const price = first?.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
  const name = first?.productName;

  if (!price) return null;

  return {
    store: STORE_NAME,
    store_url: STORE_URL,
    product_name: name,
    price: price,
    currency: 'UYU',
    url: `${STORE_URL}/${first.linkText}/p`,
  };
}

module.exports = { searchPrice, STORE_NAME };
