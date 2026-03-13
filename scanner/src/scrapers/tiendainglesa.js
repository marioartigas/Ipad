const { vtexSearch } = require('./_vtex');

const STORE_NAME = 'Tienda Inglesa';
const STORE_URL = 'https://www.tiendainglesa.com.uy';

async function searchPrice(productName) {
  return vtexSearch('www.tiendainglesa.com.uy', STORE_URL, STORE_NAME, productName);
}

module.exports = { searchPrice, STORE_NAME };
