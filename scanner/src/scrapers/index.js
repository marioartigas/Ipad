const devoto = require('./devoto');
const geant = require('./geant');
const tiendainglesa = require('./tiendainglesa');
const disco = require('./disco');
const tata = require('./tata');

const scrapers = [devoto, geant, tiendainglesa, disco, tata];

// Normaliza el nombre del producto para mejorar resultados de búsqueda:
// - Expande abreviaciones comunes del ticket
// - Elimina unidades sueltas al final
// - Recorta a las primeras 4 palabras significativas
function normalizeForSearch(name) {
  const expansions = {
    'LCH': 'Leche', 'ACE': 'Aceite', 'YRB': 'Yerba', 'ARR': 'Arroz',
    'AZU': 'Azucar', 'HAR': 'Harina', 'FID': 'Fideos', 'GLL': 'Galletitas',
    'JGO': 'Jugo', 'GAS': 'Gaseosa', 'CRV': 'Cerveza', 'VIN': 'Vino',
    'QSO': 'Queso', 'JAM': 'Jamon', 'POL': 'Pollo', 'CRN': 'Carne',
  };

  let result = name.trim();

  // Reemplazar abreviaciones al inicio
  for (const [abbr, full] of Object.entries(expansions)) {
    result = result.replace(new RegExp(`^${abbr}\\b`, 'i'), full);
  }

  // Eliminar códigos tipo "X12345" o secuencias solo numéricas largas
  result = result.replace(/\b[A-Z]{1,3}\d{4,}\b/g, '').replace(/\b\d{5,}\b/g, '');

  // Normalizar espacios
  result = result.replace(/\s+/g, ' ').trim();

  // Limitar a las primeras 4 palabras significativas (mínimo 2 chars)
  const words = result.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 4).join(' ');
}

async function comparePrices(productName) {
  const searchTerm = normalizeForSearch(productName);
  const results = await Promise.allSettled(
    scrapers.map((scraper) =>
      scraper.searchPrice(searchTerm).catch((err) => {
        console.error(`[${scraper.STORE_NAME}] Error:`, err.message);
        return null;
      })
    )
  );

  const prices = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean);

  if (prices.length === 0) return { product: productName, prices: [] };

  const sorted = prices.sort((a, b) => a.price - b.price);
  const minPrice = sorted[0].price;
  const maxPrice = sorted[sorted.length - 1].price;

  return {
    product: productName,
    prices: sorted.map((p) => ({
      ...p,
      is_cheapest: p.price === minPrice,
      is_most_expensive: p.price === maxPrice && prices.length > 1,
      savings: maxPrice - p.price,
    })),
  };
}

async function compareAll(items) {
  const results = await Promise.all(
    items.map((item) => comparePrices(item.name))
  );
  return results;
}

module.exports = { comparePrices, compareAll };
