// =====================================================
// 海市 店舗管理画面 ロジック
// =====================================================

let adminState = {
  view: 'dashboard',
  editingProductId: null,
  imageData: null
};

document.addEventListener('DOMContentLoaded', () => {
  switchView('dashboard');
  loadShopForm();
});

// ==== ビュー切り替え ====
function switchView(name) {
  adminState.view = name;
  document.querySelectorAll('.admin-view').forEach(v => v.hidden = v.id !== `view-${name}`);
  document.querySelectorAll('.admin-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  const titles = {
    dashboard: ['ダッシュボード', '店舗の概要をひと目で確認'],
    products:  ['商品管理',     '商品の追加・編集・公開設定ができます'],
    orders:    ['注文履歴',     'お客様からの注文を管理'],
    shop:      ['店舗設定',     '店舗情報を更新']
  };
  document.getElementById('viewTitle').textContent = titles[name][0];
  document.getElementById('viewSubtitle').textContent = titles[name][1];

  if (name === 'dashboard') renderDashboard();
  if (name === 'products')  renderAdminProducts();
  if (name === 'orders')    renderOrders();
}

// ==== ダッシュボード ====
function renderDashboard() {
  const products = DataStore.getProducts();
  const orders = DataStore.getOrders();
  const published = products.filter(p => p.published).length;
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const totalSales = orders.reduce((s, o) => s + o.total, 0);

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon">📦</div>
      <div class="stat-label">公開中の商品</div>
      <div class="stat-value">${published}<small> / ${products.length} 件</small></div>
    </div>
    <div class="stat-card gold">
      <div class="stat-icon">🛒</div>
      <div class="stat-label">累計注文</div>
      <div class="stat-value">${orders.length}<small> 件</small></div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon">💴</div>
      <div class="stat-label">累計売上</div>
      <div class="stat-value">${Format.price(totalSales)}</div>
    </div>
    <div class="stat-card accent">
      <div class="stat-icon">⚠️</div>
      <div class="stat-label">要注意(少在庫 / 欠品)</div>
      <div class="stat-value">${lowStock + outOfStock}<small> 件</small></div>
    </div>
  `;

  // カテゴリ別
  const statsBox = document.getElementById('categoryStats');
  const max = Math.max(1, ...CATEGORIES.map(c => products.filter(p => p.category === c.id).length));
  statsBox.innerHTML = CATEGORIES.map(c => {
    const list = products.filter(p => p.category === c.id);
    const pub = list.filter(p => p.published).length;
    const pct = Math.round((list.length / max) * 100);
    return `
      <div class="category-stat-row">
        <div class="emoji" style="background:${c.color}22">${c.emoji}</div>
        <div class="label">
          ${c.name}
          <small class="published-count">(公開 ${pub})</small>
        </div>
        <div class="category-bar-wrap"><span style="width:${pct}%;background:${c.color}"></span></div>
        <div class="count">${list.length}</div>
      </div>
    `;
  }).join('');

  // 最近の商品
  const recent = [...products].sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
  const box = document.getElementById('recentProducts');
  if (!recent.length) {
    box.innerHTML = `<div class="empty-panel"><div class="icon">📦</div>まだ商品がありません</div>`;
  } else {
    box.innerHTML = recent.map(p => `
      <div class="recent-row">
        <img src="${p.image}" alt="" onerror="this.src='${placeholderImage(p.category)}'">
        <div class="info">
          <b>${p.name}</b>
          <small>${Format.categoryEmoji(p.category)} ${Format.categoryName(p.category)} / ${Format.date(p.createdAt)}</small>
        </div>
        <span class="price">${Format.price(p.price)}</span>
      </div>
    `).join('');
  }
}

function placeholderImage(cat) {
  const emoji = Format.categoryEmoji(cat);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect fill='%23e6f2f5' width='120' height='120'/><text x='60' y='80' font-size='60' text-anchor='middle'>${emoji}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + svg;
}

// ==== 商品一覧(管理) ====
function renderAdminProducts() {
  const search = document.getElementById('adminSearch')?.value || '';
  const cat = document.getElementById('adminCategory')?.value || 'all';
  const list = DataStore.getProducts({ search, category: cat });
  const tbody = document.getElementById('adminProductTbody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-panel"><div class="icon">📦</div>該当する商品がありません</div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const stockCls = p.stock === 0 ? 'low' : p.stock <= 5 ? 'low' : '';
    const stockLabel = p.stock === 0 ? '欠品' : `${p.stock}点`;
    const badge = p.badge ? `<span class="badge-chip ${p.badge}">${p.badge}</span>` : '';
    const pubChip = p.published ? '<span class="badge-chip published">公開中</span>' : '<span class="badge-chip hidden">非公開</span>';
    const original = p.originalPrice ? `<small>${Format.price(p.originalPrice)}</small>` : '';
    return `
      <tr>
        <td>
          <input type="checkbox" class="switch" ${p.published ? 'checked' : ''} onchange="togglePublish('${p.id}')" title="店舗ページで公開">
        </td>
        <td>
          <div class="admin-product-name">
            <img src="${p.image}" alt="" onerror="this.src='${placeholderImage(p.category)}'">
            <div>
              <b>${p.name}</b>
              <small>ID: ${p.id}</small>
            </div>
          </div>
        </td>
        <td>${Format.categoryEmoji(p.category)} ${Format.categoryName(p.category)}</td>
        <td class="admin-price">${Format.price(p.price)}${original}</td>
        <td class="admin-stock ${stockCls}">${stockLabel}</td>
        <td>${pubChip} ${badge}</td>
        <td>
          <div class="table-actions">
            <button class="icon-btn" onclick="openProductForm('${p.id}')" title="編集">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn" onclick="duplicateProduct('${p.id}')" title="複製">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="icon-btn danger" onclick="deleteProduct('${p.id}')" title="削除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function togglePublish(id) {
  const p = DataStore.togglePublish(id);
  showToast(p.published ? '✅ 公開しました' : '⚠️ 非公開にしました');
  renderAdminProducts();
}

function deleteProduct(id) {
  const p = DataStore.getProduct(id);
  if (!confirm(`「${p.name}」を削除します。よろしいですか？`)) return;
  DataStore.deleteProduct(id);
  renderAdminProducts();
  showToast('🗑 商品を削除しました');
}

function duplicateProduct(id) {
  const p = DataStore.getProduct(id);
  if (!p) return;
  const copy = { ...p, id: 'p' + Date.now(), name: p.name + ' (コピー)', published: false, createdAt: Date.now() };
  DataStore.saveProduct(copy);
  renderAdminProducts();
  showToast('📄 複製しました (非公開で保存)');
}

// ==== 商品フォーム ====
function openProductForm(id = null) {
  adminState.editingProductId = id;
  adminState.imageData = null;
  const form = document.getElementById('productFormEl');
  form.reset();
  const title = document.getElementById('productFormTitle');

  if (id) {
    const p = DataStore.getProduct(id);
    if (!p) return;
    title.textContent = '商品を編集';
    form.id.value = p.id;
    form.name.value = p.name;
    form.category.value = p.category;
    form.badge.value = p.badge || '';
    form.price.value = p.price;
    form.originalPrice.value = p.originalPrice || '';
    form.stock.value = p.stock;
    form.image.value = p.image || '';
    form.description.value = p.description || '';
    form.tags.value = (p.tags || []).join(', ');
    form.published.checked = !!p.published;
    previewImage(p.image);
  } else {
    title.textContent = '新しい商品を追加';
    form.stock.value = 10;
    form.published.checked = true;
    document.getElementById('imagePreview').style.backgroundImage = '';
    document.getElementById('imagePreview').classList.remove('has-image');
  }
  document.getElementById('productForm').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeProductForm() {
  document.getElementById('productForm').hidden = true;
  document.body.style.overflow = '';
}

function previewImage(url) {
  const box = document.getElementById('imagePreview');
  if (!url) {
    box.style.backgroundImage = '';
    box.classList.remove('has-image');
    return;
  }
  box.style.backgroundImage = `url("${url}")`;
  box.classList.add('has-image');
}

function uploadImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    adminState.imageData = e.target.result;
    document.querySelector('#productFormEl [name=image]').value = e.target.result;
    previewImage(e.target.result);
  };
  reader.readAsDataURL(file);
}

function saveProduct() {
  const form = document.getElementById('productFormEl');
  const fd = new FormData(form);
  const product = {
    id: fd.get('id') || null,
    name: fd.get('name'),
    category: fd.get('category'),
    badge: fd.get('badge') || null,
    price: Number(fd.get('price')),
    originalPrice: fd.get('originalPrice') ? Number(fd.get('originalPrice')) : null,
    stock: Number(fd.get('stock')),
    image: fd.get('image') || placeholderImage(fd.get('category')),
    description: fd.get('description'),
    tags: String(fd.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean),
    published: !!fd.get('published')
  };
  DataStore.saveProduct(product);
  closeProductForm();
  renderAdminProducts();
  renderDashboard();
  showToast(adminState.editingProductId ? '✏️ 商品を更新しました' : '✨ 商品を追加しました');
}

// ==== 注文履歴 ====
function renderOrders() {
  const orders = DataStore.getOrders();
  const box = document.getElementById('ordersList');
  if (!orders.length) {
    box.innerHTML = `
      <div class="empty-panel">
        <div class="icon">📋</div>
        <p>まだ注文がありません</p>
        <p style="font-size:12px">店舗ページでテスト注文してみましょう</p>
      </div>
    `;
    return;
  }
  box.innerHTML = orders.map(o => {
    const count = o.items.reduce((s, i) => s + i.qty, 0);
    const itemNames = o.items.slice(0, 2).map(i => i.name).join(' / ');
    const more = o.items.length > 2 ? ` 他${o.items.length - 2}点` : '';
    return `
      <div class="order-row">
        <span class="order-id">#${o.id}</span>
        <div class="order-summary">
          <b>${itemNames}${more}</b>
          <small>${count}点 / ${Format.date(o.createdAt)}</small>
        </div>
        <span class="order-total">${Format.price(o.total)}</span>
        <span class="status-chip">受付中</span>
      </div>
    `;
  }).join('');
}

// ==== 店舗設定 ====
function loadShopForm() {
  const info = DataStore.getShopInfo();
  const form = document.getElementById('shopForm');
  if (!form) return;
  Object.keys(info).forEach(k => {
    if (form[k]) form[k].value = info[k] || '';
  });
}
function saveShop() {
  const form = document.getElementById('shopForm');
  const fd = new FormData(form);
  const info = {};
  fd.forEach((v, k) => info[k] = v);
  DataStore.saveShopInfo(info);
  showToast('💾 店舗情報を保存しました');
}

// ==== リセット ====
function resetAll() {
  if (!confirm('すべてのデータ（商品・カート・注文）を初期状態に戻します。よろしいですか？')) return;
  DataStore.resetAll();
  switchView('dashboard');
  showToast('🔄 初期状態にリセットしました');
}

// ==== Toast ====
function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, duration);
}
