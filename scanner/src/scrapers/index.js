const { getPriceEstimates } = require('./claude');

// Normaliza nombre del producto
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
  return result.replace(/\s+/g, ' ').trim();
}

async function compareAll(items) {
  console.log(`[Claude] Estimando precios para ${items.length} productos...`);

  const normalized = items.map((item) => ({
    ...item,
    name: normalizeForSearch(item.name),
  }));

  let estimates;
  try {
    estimates = await getPriceEstimates(normalized);
  } catch (err) {
    console.error('[Claude] Error:', err.message);
    return items.map((item) => ({ product: item.name, prices: [] }));
  }

  return normalized.map((item, i) => {
    const est = estimates.prices?.[i];
    if (!est || est.estimated_price == null) {
      return { product: item.name, prices: [] };
    }

    console.log(`[Claude] ${item.name} → $${est.estimated_price} UYU (rango: ${est.range ?? 'N/D'})`);

    return {
      product: item.name,
      prices: [{
        store: 'Estimado Claude IA',
        store_url: null,
        product_name: est.name,
        price: est.estimated_price,
        price_range: est.range,
        notes: est.notes,
        currency: 'UYU',
        url: null,
        is_cheapest: false,
        is_most_expensive: false,
        savings: 0,
        is_estimate: true,
      }],
    };
  });
}

module.exports = { compareAll };
