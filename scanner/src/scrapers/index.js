const devoto = require('./devoto');
const geant = require('./geant');
const tiendainglesa = require('./tiendainglesa');
const disco = require('./disco');
const tata = require('./tata');

const scrapers = [devoto, geant, tiendainglesa, disco, tata];

async function comparePrices(productName) {
  const results = await Promise.allSettled(
    scrapers.map((scraper) =>
      scraper.searchPrice(productName).catch((err) => {
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
