// =====================================================
// 海市 EC サイト ショップ側ロジック
// =====================================================

let state = {
  category: 'all',
  search: '',
  sort: 'newest'
};

// ==== 初期化 ====
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  renderProducts();
  updateCartBadge();
  document.getElementById('searchInput')?.addEventListener('input', e => {
    state.search = e.target.value;
    renderProducts();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeCart(); }
  });
});

// ==== カテゴリ描画 ====
function renderCategories() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;
  const all = { id: 'all', name: 'すべて', emoji: '🌊', color: '#0a4d68' };
  const list = [all, ...CATEGORIES];
  const products = DataStore.getProducts({ onlyPublished: true });
  grid.innerHTML = list.map(c => {
    const count = c.id === 'all'
      ? products.length
      : products.filter(p => p.category === c.id).length;
    const active = state.category === c.id ? 'active' : '';
    return `
      <button class="category-card ${active}" onclick="selectCategory('${c.id}')">
        <div class="category-emoji" style="background:${c.color}22">${c.emoji}</div>
        <div class="category-label">
          <b>${c.name}</b>
          <small>${count}商品</small>
        </div>
      </button>
    `;
  }).join('');
}

function selectCategory(id) {
  state.category = id;
  renderCategories();
  renderProducts();
  const title = document.getElementById('productsTitle');
  if (id === 'all') title.textContent = 'すべての商品';
  else title.textContent = Format.categoryEmoji(id) + ' ' + Format.categoryName(id) + 'の商品';
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==== 商品グリッド描画 ====
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('emptyState');
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) state.sort = sortSel.value;
  const products = DataStore.getProducts({
    onlyPublished: true,
    category: state.category,
    search: state.search,
    sort: state.sort
  });
  if (!products.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = products.map(p => {
    const badge = p.badge ? `<div class="product-badge ${p.badge}">${p.badge}</div>` : '';
    const stockCls = p.stock <= 5 ? 'low' : '';
    const stockLabel = p.stock <= 0
      ? '<div class="stock-label low">売切</div>'
      : p.stock <= 5
        ? `<div class="stock-label ${stockCls}">残${p.stock}点</div>`
        : '';
    const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const original = p.originalPrice ? `<span class="product-price-original">${Format.price(p.originalPrice)}</span>` : '';
    const discountTag = discount ? `<span class="product-discount">${discount}%OFF</span>` : '';
    const tags = (p.tags || []).slice(0, 3).map(t => `<span class="product-tag">${t}</span>`).join('');
    return `
      <article class="product-card" onclick="openProduct('${p.id}')">
        <div class="product-thumb">
          <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22><rect fill=%22%23e6f2f5%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 font-size=%2280%22 text-anchor=%22middle%22>${Format.categoryEmoji(p.category)}</text></svg>'">
          ${badge}
          ${stockLabel}
        </div>
        <div class="product-info">
          <div class="product-tags">${tags}</div>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-price-row">
            <span class="product-price">${Format.price(p.price)}</span>
            ${original}
            ${discountTag}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function handleSearch() {
  state.search = document.getElementById('searchInput').value;
  renderProducts();
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
}

// ==== 商品詳細モーダル ====
function openProduct(id) {
  const p = DataStore.getProduct(id);
  if (!p) return;
  const badge = p.badge ? `<div class="product-badge ${p.badge}">${p.badge}</div>` : '';
  const original = p.originalPrice ? `<span class="pd-price-original">${Format.price(p.originalPrice)}</span>` : '';
  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const discountTag = discount ? `<span class="product-discount">${discount}%OFF</span>` : '';
  const tags = (p.tags || []).map(t => `<span class="product-tag">${t}</span>`).join('');
  const inStock = p.stock > 0;

  document.getElementById('productDetail').innerHTML = `
    <div class="pd-wrap">
      <div class="pd-image">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22500%22><rect fill=%22%23e6f2f5%22 width=%22500%22 height=%22500%22/><text x=%22250%22 y=%22280%22 font-size=%22160%22 text-anchor=%22middle%22>${Format.categoryEmoji(p.category)}</text></svg>'">
        ${badge}
      </div>
      <div class="pd-content">
        <span class="pd-category">${Format.categoryEmoji(p.category)} ${Format.categoryName(p.category)}</span>
        <h2 class="pd-title">${p.name}</h2>
        <div class="pd-price-row">
          <span class="pd-price">${Format.price(p.price)}</span>
          ${original}
          ${discountTag}
        </div>
        <p class="pd-tax">税込価格</p>
        <div class="pd-tags">${tags}</div>
        <p class="pd-desc">${p.description}</p>
        <p class="pd-stock">在庫: <b>${p.stock}点</b></p>
        ${inStock ? `
        <div class="pd-qty-row">
          <div class="pd-qty">
            <button onclick="changePdQty(-1)" aria-label="減">−</button>
            <input type="number" id="pdQty" value="1" min="1" max="${p.stock}">
            <button onclick="changePdQty(1)" aria-label="増">＋</button>
          </div>
          <span style="font-size:13px;color:var(--c-ink-3)">数量を選択</span>
        </div>
        <div class="pd-actions">
          <button class="btn-primary" onclick="addToCartFromDetail('${p.id}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            カートに入れる
          </button>
        </div>
        ` : `
        <div class="pd-actions">
          <button class="btn-primary" style="background:var(--c-ink-3);cursor:not-allowed" disabled>売り切れ</button>
        </div>
        `}
      </div>
    </div>
  `;
  document.getElementById('productModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function changePdQty(delta) {
  const input = document.getElementById('pdQty');
  let v = parseInt(input.value, 10) + delta;
  const max = parseInt(input.max, 10) || 99;
  v = Math.max(1, Math.min(max, v));
  input.value = v;
}

function addToCartFromDetail(pid) {
  const qty = parseInt(document.getElementById('pdQty').value, 10) || 1;
  DataStore.addToCart(pid, qty);
  updateCartBadge();
  closeModal();
  showToast('🛒 カートに追加しました');
  setTimeout(() => openCart(), 400);
}

function closeModal() {
  document.getElementById('productModal').hidden = true;
  document.body.style.overflow = '';
}

// ==== カート ====
function openCart() {
  renderCart();
  document.getElementById('cartDrawer').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartDrawer').hidden = true;
  document.body.style.overflow = '';
}

function renderCart() {
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  const cart = DataStore.getCart();
  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>カートは空です</p>
        <p style="font-size:12px">気になる海の幸を見つけて追加してください</p>
      </div>
    `;
    footer.innerHTML = '';
    return;
  }
  const items = cart.map(c => {
    const p = DataStore.getProduct(c.productId);
    if (!p) return '';
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23e6f2f5%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22>${Format.categoryEmoji(p.category)}</text></svg>'">
        <div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${Format.price(p.price)}</div>
          <div class="cart-item-qty">
            <button onclick="updateQty('${p.id}', ${c.qty - 1})">−</button>
            <span>${c.qty}</span>
            <button onclick="updateQty('${p.id}', ${c.qty + 1})">＋</button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeItem('${p.id}')">削除</button>
      </div>
    `;
  }).join('');
  body.innerHTML = items;

  const subtotal = cart.reduce((sum, c) => {
    const p = DataStore.getProduct(c.productId);
    return sum + (p ? p.price * c.qty : 0);
  }, 0);
  const shipping = subtotal >= 5000 ? 0 : 980;
  const total = subtotal + shipping;
  footer.innerHTML = `
    <div class="cart-summary"><span>小計</span><span>${Format.price(subtotal)}</span></div>
    <div class="cart-summary"><span>送料</span><span>${shipping === 0 ? '<b style=color:var(--c-primary)>無料</b>' : Format.price(shipping)}</span></div>
    <div class="cart-total">
      <span class="cart-total-label">合計</span>
      <span class="cart-total-value">${Format.price(total)}</span>
    </div>
    <button class="btn-primary" onclick="checkout()">
      レジに進む
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    </button>
  `;
}

function updateQty(pid, qty) {
  DataStore.updateCartItem(pid, qty);
  renderCart();
  updateCartBadge();
}
function removeItem(pid) {
  DataStore.removeFromCart(pid);
  renderCart();
  updateCartBadge();
  showToast('カートから削除しました');
}

function checkout() {
  const cart = DataStore.getCart();
  if (!cart.length) return;
  closeCart();
  location.href = 'checkout.html';
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const cart = DataStore.getCart();
  const total = cart.reduce((s, c) => s + c.qty, 0);
  if (!badge) return;
  if (total > 0) {
    badge.hidden = false;
    badge.textContent = total;
  } else {
    badge.hidden = true;
  }
}

// ==== Toast ====
function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, duration);
}
