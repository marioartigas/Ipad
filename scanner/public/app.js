/* ── State ── */
let currentItems = [];
let selectedFile = null;

/* ── Screen navigation ── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(elId) {
  document.getElementById(elId).style.display = 'none';
}

/* ── File handling ── */
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showError('errorMsg', 'Por favor seleccioná una imagen válida (JPEG, PNG, WEBP).');
    return;
  }
  selectedFile = file;
  hideError('errorMsg');

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('imagePreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

/* ── Upload screen ── */
document.getElementById('btnCamera').addEventListener('click', () => {
  const input = document.getElementById('fileInput');
  input.setAttribute('capture', 'environment');
  input.click();
});

document.getElementById('btnUpload').addEventListener('click', () => {
  const input = document.getElementById('fileInput');
  input.removeAttribute('capture');
  input.click();
});

document.getElementById('fileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) {
    handleFile(e.target.files[0]);
    scanImage();
  }
});

const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('click', () => document.getElementById('fileInput').click());
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
    scanImage();
  }
});

/* ── Demo data ── */
document.getElementById('btnDemo').addEventListener('click', () => {
  currentItems = [
    { name: 'Leche Conaprole Entera 1L', quantity: 2, unit_price: 89, total: 178 },
    { name: 'Pan Bimbo Lactal 500g', quantity: 1, unit_price: 125, total: 125 },
    { name: 'Aceite Cocinero Girasol 900ml', quantity: 1, unit_price: 215, total: 215 },
    { name: 'Arroz Saman Largo Fino 1kg', quantity: 2, unit_price: 98, total: 196 },
    { name: 'Yerba Canarias 1kg', quantity: 1, unit_price: 320, total: 320 },
  ];
  renderProductsScreen('Demo Supermercado');
});

/* ── Scan image ── */
async function scanImage() {
  if (!selectedFile) {
    showError('errorMsg', 'Primero seleccioná una imagen.');
    return;
  }

  showScreen('screen-loading');
  document.getElementById('loadingTitle').textContent = 'Analizando ticket...';
  document.getElementById('loadingStep').textContent = 'Claude está leyendo los productos y precios';

  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al procesar el ticket');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('No se detectaron productos en la imagen. Asegurate de que sea un ticket claro.');
    }

    currentItems = data.items;
    renderProductsScreen(data.store);
  } catch (err) {
    showScreen('screen-upload');
    showError('errorMsg', err.message);
  }
}

/* ── Products screen ── */
function renderProductsScreen(storeName) {
  const list = document.getElementById('productsList');
  list.innerHTML = '';

  currentItems.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'product-item';
    div.innerHTML = `
      <div style="flex:1">
        <input type="text" value="${escapeHtml(item.name)}" data-idx="${i}" class="product-name-input" />
        <div style="margin-top:4px; display:flex; gap:8px">
          <span class="product-qty">×${item.quantity}</span>
          ${item.unit_price ? `<span class="product-price">$${formatPrice(item.unit_price)}</span>` : ''}
        </div>
      </div>
      <button class="btn-remove" data-idx="${i}" title="Quitar">✕</button>
    `;
    list.appendChild(div);
  });

  // Update item names on edit
  list.querySelectorAll('.product-name-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      currentItems[idx].name = e.target.value;
    });
  });

  // Remove items
  list.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      currentItems.splice(idx, 1);
      renderProductsScreen(storeName);
    });
  });

  const storeEl = document.getElementById('storeDetected');
  storeEl.textContent = storeName
    ? `Ticket de: ${storeName} — ${currentItems.length} producto(s) detectado(s)`
    : `${currentItems.length} producto(s) detectado(s)`;

  hideError('errorMsgProducts');
  showScreen('screen-products');
}

document.getElementById('btnBackUpload').addEventListener('click', () => showScreen('screen-upload'));

/* ── Compare prices ── */
document.getElementById('btnCompare').addEventListener('click', async () => {
  if (currentItems.length === 0) {
    showError('errorMsgProducts', 'No hay productos para comparar.');
    return;
  }

  const validItems = currentItems.filter((item) => item.name.trim().length > 2);
  if (validItems.length === 0) {
    showError('errorMsgProducts', 'Revisá los nombres de los productos.');
    return;
  }

  showScreen('screen-loading');
  document.getElementById('loadingTitle').textContent = 'Comparando precios...';
  document.getElementById('loadingStep').textContent = `Buscando en Devoto, Géant, Tienda Inglesa, Disco y Ta-Ta`;

  try {
    const response = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: validItems }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al comparar precios');
    }

    renderResults(data.results, validItems.length);
  } catch (err) {
    showScreen('screen-products');
    showError('errorMsgProducts', err.message);
  }
});

/* ── Results screen ── */
function renderResults(results, totalProducts) {
  const list = document.getElementById('resultsList');
  list.innerHTML = '';

  let totalSavings = 0;
  let productsWithResults = 0;

  results.forEach((result, i) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const originalItem = currentItems[i];
    const originalPrice = originalItem?.unit_price
      ? `Precio en tu ticket: $${formatPrice(originalItem.unit_price)}`
      : '';

    card.innerHTML = `
      <div class="result-card-header">
        ${escapeHtml(result.product)}
        ${originalPrice ? `<div class="original-price">${originalPrice}</div>` : ''}
      </div>
    `;

    if (!result.prices || result.prices.length === 0) {
      card.innerHTML += `<div class="no-results">Sin resultados en los supermercados consultados</div>`;
    } else {
      productsWithResults++;
      const cheapest = result.prices[0];
      const mostExpensive = result.prices[result.prices.length - 1];

      if (result.prices.length > 1) {
        totalSavings += mostExpensive.price - cheapest.price;
      }

      result.prices.forEach((p) => {
        const row = document.createElement('div');
        row.className = `price-row${p.is_cheapest ? ' cheapest' : ''}${p.is_most_expensive ? ' expensive' : ''}`;
        row.innerHTML = `
          <div class="store-name">
            ${p.url
              ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.store)}</a>`
              : escapeHtml(p.store)
            }
            ${p.product_name && p.product_name !== result.product
              ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${escapeHtml(p.product_name)}</div>`
              : ''
            }
          </div>
          <div>
            ${p.is_cheapest ? '<span class="badge badge-green">Más barato</span>' : ''}
            ${p.is_most_expensive ? '<span class="badge badge-red">Más caro</span>' : ''}
          </div>
          <div class="price-badge">$${formatPrice(p.price)}</div>
        `;
        card.appendChild(row);
      });
    }

    list.appendChild(card);
  });

  // Savings summary
  const summaryEl = document.getElementById('savingsSummary');
  if (totalSavings > 0) {
    document.getElementById('savingsAmount').textContent = `$${formatPrice(totalSavings)}`;
    summaryEl.style.display = 'block';
  } else {
    summaryEl.style.display = 'none';
  }

  document.getElementById('resultsSubtitle').textContent =
    `${productsWithResults} de ${totalProducts} producto(s) encontrados en supermercados`;

  showScreen('screen-results');
}

document.getElementById('btnBackProducts').addEventListener('click', () => showScreen('screen-products'));
document.getElementById('btnNewScan').addEventListener('click', () => {
  selectedFile = null;
  currentItems = [];
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('imagePreview').src = '';
  document.getElementById('fileInput').value = '';
  hideError('errorMsg');
  showScreen('screen-upload');
});

/* ── Helpers ── */
function formatPrice(n) {
  return Number(n).toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
