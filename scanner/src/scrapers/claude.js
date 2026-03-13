// Usa Claude para estimar precios en supermercados de Uruguay
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getPriceEstimates(items) {
  const productList = items
    .map((item, i) => `${i + 1}. ${item.name}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Sos un experto en precios de supermercados de Uruguay (2024-2025).
Para cada producto de esta lista, estimá el precio promedio en pesos uruguayos (UYU) en supermercados como Devoto, Disco, Tienda Inglesa, Géant y Ta-Ta.

Productos:
${productList}

Respondé SOLO con JSON válido, sin texto adicional:
{
  "prices": [
    {
      "name": "nombre del producto",
      "estimated_price": 150,
      "range": "130-170",
      "notes": "varía según marca/presentación"
    }
  ]
}

Si no conocés el precio de algún producto, poné null en estimated_price.
Los precios deben ser realistas para Uruguay en pesos uruguayos.`,
    }],
  });

  const text = response.content[0].text.trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No se pudo parsear respuesta de Claude');
  return JSON.parse(match[0]);
}

module.exports = { getPriceEstimates };
