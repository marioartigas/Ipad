const google = require('./google');
const mercadolibre = require('./mercadolibre');

// Normaliza nombre del producto: expande abreviaciones del ticket,
// elimina códigos de barra, recorta a 4 palabras clave
function normalizeForSearch(name) {
  const expansions = {
    'LCH': 'Leche', 'ACE': 'Aceite', 'YRB': 'Yerba', 'ARR': 'Arroz',
    'AZU': 'Azucar', 'HAR': 'Harina', 'FID': 'Fideos', 'GLL': 'Galletitas',
    'JGO': 'Jugo', 'GAS': 'Gaseosa', 'CRV': 'Cerveza', 'VIN': 'Vino',
    'QSO': 'Queso', 'JAM': 'Jamon', 'POL': 'Pollo', 'CRN': 'Carne',
  };

  let result = name.trim();
  for (const [abbr, full] of Object.entries(expansions)) {
    result = result.replace(new RegExp(`^${abbr}\\b`, 'i'), full);
  }
  result = result.replace(/\b[A-Z]{1,3}\d{4,}\b/g, '').replace(/\b\d{5,}\b/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  const words = result.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 4).join(' ');
}

async function comparePrices(productName) {
  const searchTerm = normalizeForSearch(productName);
  console.log(`[Buscar] "${productName}" → "${searchTerm}"`);

  // Intentar Google primero, luego ML como fallback
  const result = await google.searchPrice(searchTerm)
    ?? await mercadolibre.searchPrice(searchTerm);

  if (!result) return { product: productName, prices: [] };

  return {
    product: productName,
    prices: [{
      ...result,
      is_cheapest: true,
      is_most_expensive: false,
      savings: 0,
    }],
  };
}

// Procesa en serie con pausa para no ser bloqueado por rate limiting
async function compareAll(items) {
  const results = [];
  for (const item of items) {
    results.push(await comparePrices(item.name));
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}

module.exports = { comparePrices, compareAll };
