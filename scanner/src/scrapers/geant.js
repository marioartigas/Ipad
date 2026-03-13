const { vtexSearch } = require('./_vtex');
const STORE_NAME = 'Géant';
const STORE_URL = 'https://www.geant.com.uy';

async function searchPrice(productName) {
  return vtexSearch('www.geant.com.uy', 'geant', STORE_URL, STORE_NAME, productName);
}

module.exports = { searchPrice, STORE_NAME };
