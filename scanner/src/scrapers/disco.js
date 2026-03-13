const { vtexSearch } = require('./_vtex');

const STORE_NAME = 'Disco';
const STORE_URL = 'https://www.disco.com.uy';

async function searchPrice(productName) {
  return vtexSearch('www.disco.com.uy', STORE_URL, STORE_NAME, productName);
}

module.exports = { searchPrice, STORE_NAME };
