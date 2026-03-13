const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function scanReceipt(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analiza esta foto de ticket/factura de supermercado uruguayo.
Extrae TODOS los productos con sus precios.
Responde SOLO con JSON válido, sin texto adicional, con este formato exacto:
{
  "items": [
    { "name": "Leche La Serenísima 1L", "quantity": 1, "unit_price": 89.50, "total": 89.50 }
  ],
  "currency": "UYU",
  "store": "nombre del supermercado si es visible o null"
}
Instrucciones importantes:
- Normaliza los nombres: escribe nombres completos y descriptivos, incluye marca y cantidad/unidad cuando sea posible
- Si no puedes leer el precio claramente, omite ese ítem
- quantity debe ser un número, no texto
- Los precios son en pesos uruguayos (UYU)
- No incluyas subtotales, impuestos ni el total final como ítems`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta del modelo');
  }
  return JSON.parse(jsonMatch[0]);
}

module.exports = { scanReceipt };
