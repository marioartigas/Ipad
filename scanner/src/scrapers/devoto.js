const { vtexSearch } = require('./_vtex');
const STORE_NAME = 'Devoto';
const STORE_URL = 'https://www.devoto.com.uy';

async function searchPrice(productName) {
  return vtexSearch('www.devoto.com.uy', 'devoto', STORE_URL, STORE_NAME, productName);
}

module.exports = { searchPrice, STORE_NAME };
