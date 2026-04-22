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
    coupons:   ['クーポン管理', '割引クーポンの発行・管理'],
    shop:      ['店舗設定',     '店舗情報を更新']
  };
  document.getElementById('viewTitle').textContent = titles[name][0];
  document.getElementById('viewSubtitle').textContent = titles[name][1];

  if (name === 'dashboard') renderDashboard();
  if (name === 'products')  renderAdminProducts();
  if (name === 'orders')    renderOrders();
  if (name === 'coupons')   renderCoupons();
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
  return generateProductImage(cat, 1);
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
const ORDER_STATUS = {
  pending:   { label: '受付中',   cls: 'pending',   next: 'preparing' },
  preparing: { label: '準備中',   cls: 'preparing', next: 'shipped'   },
  shipped:   { label: '発送済み', cls: 'shipped',   next: 'delivered' },
  delivered: { label: '配達完了', cls: 'delivered', next: null        },
  cancelled: { label: 'キャンセル', cls: 'cancelled', next: null      }
};

const PAYMENT_LABEL = {
  card: 'クレジット',
  bank: '銀行振込',
  cod:  '代金引換'
};

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
  // フィルタバー + リスト
  const status = adminState.orderFilter || 'all';
  const counts = Object.keys(ORDER_STATUS).reduce((acc, k) => {
    acc[k] = orders.filter(o => (o.status || 'pending') === k).length;
    return acc;
  }, {});
  const filtered = status === 'all'
    ? orders
    : orders.filter(o => (o.status || 'pending') === status);
  const tabs = [
    ['all', 'すべて', orders.length],
    ['pending', '受付中', counts.pending || 0],
    ['preparing', '準備中', counts.preparing || 0],
    ['shipped', '発送済み', counts.shipped || 0],
    ['delivered', '配達完了', counts.delivered || 0]
  ].map(([k, label, n]) => `
    <button class="order-tab ${status === k ? 'active' : ''}" onclick="setOrderFilter('${k}')">
      ${label}<span class="tab-count">${n}</span>
    </button>
  `).join('');

  box.innerHTML = `
    <div class="order-tabs">${tabs}</div>
    <div class="order-list">
      ${filtered.length
        ? filtered.map(renderOrderCard).join('')
        : `<div class="empty-panel" style="padding:40px 20px"><p>該当する注文はありません</p></div>`}
    </div>
  `;
}

function setOrderFilter(k) {
  adminState.orderFilter = k;
  renderOrders();
}

function renderOrderCard(o) {
  const status = o.status || 'pending';
  const st = ORDER_STATUS[status] || ORDER_STATUS.pending;
  const count = o.items.reduce((s, i) => s + i.qty, 0);
  const isOpen = adminState.openOrderId === o.id;
  const firstItem = o.items[0];
  const thumb = firstItem && firstItem.image
    ? `<img class="order-thumb" src="${firstItem.image}" alt="" onerror="this.style.display='none'">`
    : `<div class="order-thumb order-thumb-placeholder">📦</div>`;
  const itemNames = o.items.slice(0, 2).map(i => i.name).join(' / ');
  const more = o.items.length > 2 ? ` 他${o.items.length - 2}点` : '';
  const paymentLabel = PAYMENT_LABEL[o.paymentMethod] || (o.paymentMethod || '-');
  const shipName = o.shippingInfo?.name || '-';
  const shipPref = o.shippingInfo?.pref || '';

  return `
    <article class="admin-order ${isOpen ? 'open' : ''}">
      <header class="admin-order-head" onclick="toggleOrder('${o.id}')">
        ${thumb}
        <div class="admin-order-meta">
          <div class="admin-order-top">
            <span class="order-id">#${o.id}</span>
            <span class="status-chip status-${st.cls}">${st.label}</span>
          </div>
          <b class="admin-order-title">${escapeHtmlAdmin(itemNames)}${more}</b>
          <div class="admin-order-sub">
            <span>${count}点</span>
            <span class="dot">・</span>
            <span>${escapeHtmlAdmin(shipName)}様${shipPref ? '（' + escapeHtmlAdmin(shipPref) + '）' : ''}</span>
            <span class="dot">・</span>
            <span>${paymentLabel}</span>
            <span class="dot">・</span>
            <span>${Format.date(o.createdAt)}</span>
          </div>
        </div>
        <div class="admin-order-right">
          <span class="order-total">${Format.price(o.total)}</span>
          <span class="toggle-icon" aria-label="詳細">${isOpen ? '▲' : '▼'}</span>
        </div>
      </header>

      ${isOpen ? renderOrderDetail(o, st) : ''}
    </article>
  `;
}

function renderOrderDetail(o, st) {
  const s = o.shippingInfo || {};
  const p = o.paymentSummary || {};
  const cardText = p.method === 'card'
    ? `${p.brand || 'Card'} **** **** **** ${p.last4 || '----'} / ${p.cardName || ''} / ${p.exp || ''}`
    : (o.paymentMethod === 'bank' ? '銀行振込（入金確認中）' : (o.paymentMethod === 'cod' ? '代金引換' : '-'));
  const deliveryLabel = o.deliveryType === 'express' ? 'お急ぎ便' : '通常配送（クール便）';

  const items = o.items.map(i => `
    <tr>
      <td class="o-item-thumb">${i.image ? `<img src="${i.image}" alt="">` : '📦'}</td>
      <td>
        <b>${escapeHtmlAdmin(i.name)}</b>
        <small>${Format.price(i.price)} × ${i.qty}点</small>
      </td>
      <td class="o-item-price">${Format.price(i.price * i.qty)}</td>
    </tr>
  `).join('');

  const nextBtn = st.next
    ? `<button class="btn-solid" onclick="updateOrderStatus('${o.id}', '${st.next}')">
         ${ORDER_STATUS[st.next].label}に進める
       </button>`
    : '';

  return `
    <div class="admin-order-body">
      <div class="admin-order-grid">
        <section class="o-section">
          <h4>お届け先</h4>
          <dl class="o-kv">
            <dt>お名前</dt><dd><b>${escapeHtmlAdmin(s.name || '-')}</b>（${escapeHtmlAdmin(s.nameKana || '')}）</dd>
            <dt>郵便番号</dt><dd>〒${escapeHtmlAdmin(s.zip || '-')}</dd>
            <dt>住所</dt><dd>${escapeHtmlAdmin(s.pref || '')}${escapeHtmlAdmin(s.city || '')}<br>${escapeHtmlAdmin(s.address || '')}</dd>
            <dt>電話</dt><dd>${escapeHtmlAdmin(s.phone || '-')}</dd>
            <dt>メール</dt><dd>${escapeHtmlAdmin(s.email || '-')}</dd>
            <dt>配送方法</dt><dd>${deliveryLabel}</dd>
            <dt>お届け希望</dt><dd>${s.deliveryDate ? Format.date(new Date(s.deliveryDate).getTime()) : '指定なし'}${s.deliveryTime ? ' / ' + escapeHtmlAdmin(s.deliveryTime) : ''}</dd>
            ${o.note ? `<dt>備考</dt><dd>${escapeHtmlAdmin(o.note)}</dd>` : ''}
          </dl>
        </section>
        <section class="o-section">
          <h4>お支払い</h4>
          <dl class="o-kv">
            <dt>お支払方法</dt><dd><b>${PAYMENT_LABEL[o.paymentMethod] || o.paymentMethod || '-'}</b></dd>
            <dt>詳細</dt><dd>${cardText}</dd>
            <dt>小計</dt><dd>${Format.price(o.subtotal || 0)}</dd>
            <dt>送料</dt><dd>${(o.shipping || 0) === 0 ? '<b style="color:var(--c-primary)">無料</b>' : Format.price(o.shipping || 0)}</dd>
            ${o.expressFee ? `<dt>お急ぎ便</dt><dd>${Format.price(o.expressFee)}</dd>` : ''}
            ${o.codFee ? `<dt>代引手数料</dt><dd>${Format.price(o.codFee)}</dd>` : ''}
            ${o.coupon ? `<dt>🎟️ クーポン</dt><dd style="color:#16a34a"><b>${escapeHtmlAdmin(o.coupon.name)}</b> <code style="font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:4px;color:var(--c-primary)">${escapeHtmlAdmin(o.coupon.code)}</code>${o.coupon.shippingFree ? '（送料無料）' : ''}</dd>` : ''}
            ${(o.discount || 0) > 0 ? `<dt>クーポン割引</dt><dd style="color:#16a34a;font-weight:700">-${Format.price(o.discount)}</dd>` : ''}
            <dt>合計</dt><dd class="o-total">${Format.price(o.total)}</dd>
          </dl>
        </section>
      </div>

      <section class="o-section">
        <h4>ご注文商品（${o.items.length}種・${o.items.reduce((s,i)=>s+i.qty,0)}点）</h4>
        <table class="o-items">
          <tbody>${items}</tbody>
        </table>
      </section>

      <section class="o-section">
        <h4>ステータス操作</h4>
        <div class="status-actions">
          ${nextBtn}
          ${st.cls !== 'cancelled' && st.cls !== 'delivered'
            ? `<button class="btn-danger" onclick="updateOrderStatus('${o.id}', 'cancelled')">キャンセル</button>`
            : ''}
          <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
            <option value="">ステータス変更…</option>
            ${Object.entries(ORDER_STATUS).map(([k, v]) =>
              `<option value="${k}" ${k === (o.status||'pending') ? 'selected' : ''}>${v.label}</option>`
            ).join('')}
          </select>
        </div>
      </section>
    </div>
  `;
}

function toggleOrder(id) {
  adminState.openOrderId = (adminState.openOrderId === id) ? null : id;
  renderOrders();
}

function updateOrderStatus(id, status) {
  if (!status) return;
  const orders = DataStore.getOrders();
  const o = orders.find(x => x.id === id);
  if (!o) return;
  o.status = status;
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  renderOrders();
  renderDashboard();
  showToast('📦 ステータスを「' + (ORDER_STATUS[status]?.label || status) + '」に更新しました');
}

function escapeHtmlAdmin(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ==== クーポン管理 ====
const COUPON_TYPE_LABEL = {
  percent: '%OFF',
  fixed: '¥OFF',
  shipping: '送料無料'
};

function renderCoupons() {
  const coupons = DataStore.getCoupons();
  const box = document.getElementById('couponsList');
  if (!coupons.length) {
    box.innerHTML = `
      <div class="empty-panel">
        <div class="icon">🎟️</div>
        <p>まだクーポンがありません</p>
        <p style="font-size:12px">右上の「新規クーポンを追加」から発行できます</p>
      </div>
    `;
    return;
  }
  box.innerHTML = `
    <div class="coupons-grid">
      ${coupons.map(c => renderCouponCard(c)).join('')}
    </div>
  `;
}

function renderCouponCard(c) {
  const expired = c.expiresAt && Date.now() > c.expiresAt;
  const used = c.usageLimit && c.usedCount >= c.usageLimit;
  const isDisabled = !c.active || expired || used;
  const badgeText = c.type === 'percent'
    ? `${c.value}%OFF`
    : c.type === 'fixed'
      ? `¥${Number(c.value).toLocaleString('ja-JP')} OFF`
      : '送料無料';
  const statusText = !c.active ? '無効' : expired ? '期限切れ' : used ? '上限到達' : '有効';
  const statusCls = !c.active ? 'inactive' : expired ? 'expired' : used ? 'limited' : 'active';

  return `
    <article class="coupon-card ${isDisabled ? 'disabled' : ''}">
      <div class="coupon-left">
        <div class="coupon-badge coupon-type-${c.type}">${badgeText}</div>
        <code class="coupon-code">${escapeHtmlAdmin(c.code)}</code>
      </div>
      <div class="coupon-main">
        <div class="coupon-name">${escapeHtmlAdmin(c.name)}</div>
        <div class="coupon-meta">
          ${c.minAmount ? `<span>最低 ${Format.price(c.minAmount)}〜</span>` : ''}
          ${c.maxDiscount ? `<span>上限 ${Format.price(c.maxDiscount)}</span>` : ''}
          ${c.usageLimit ? `<span>利用 ${c.usedCount || 0}/${c.usageLimit}</span>` : `<span>利用 ${c.usedCount || 0}回</span>`}
          ${c.expiresAt ? `<span>期限 ${Format.date(c.expiresAt)}</span>` : ''}
        </div>
        <span class="coupon-status status-${statusCls}">${statusText}</span>
      </div>
      <div class="coupon-actions">
        <button class="icon-btn" onclick="editCoupon('${c.id}')" title="編集">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn" onclick="toggleCouponActive('${c.id}')" title="${c.active ? '無効化' : '有効化'}">
          ${c.active
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          }
        </button>
        <button class="icon-btn icon-btn-danger" onclick="deleteCoupon('${c.id}')" title="削除">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </article>
  `;
}

function openCouponForm() {
  adminState.editingCouponId = null;
  const form = document.getElementById('couponFormEl');
  form.reset();
  form.id.value = '';
  form.active.checked = true;
  form.type.value = 'percent';
  onCouponTypeChange('percent');
  document.getElementById('couponFormTitle').textContent = '新しいクーポンを追加';
  document.getElementById('couponForm').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeCouponForm() {
  document.getElementById('couponForm').hidden = true;
  document.body.style.overflow = '';
}

function editCoupon(id) {
  const c = DataStore.getCoupon(id);
  if (!c) return;
  adminState.editingCouponId = id;
  const form = document.getElementById('couponFormEl');
  form.id.value = c.id;
  form.code.value = c.code;
  form.name.value = c.name;
  form.type.value = c.type;
  form.value.value = c.value || 0;
  form.maxDiscount.value = c.maxDiscount || '';
  form.minAmount.value = c.minAmount || '';
  form.usageLimit.value = c.usageLimit || '';
  form.expiresAt.value = c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '';
  form.active.checked = !!c.active;
  onCouponTypeChange(c.type);
  document.getElementById('couponFormTitle').textContent = 'クーポンを編集';
  document.getElementById('couponForm').hidden = false;
  document.body.style.overflow = 'hidden';
}

function onCouponTypeChange(type) {
  const row = document.getElementById('couponValueRow');
  const form = document.getElementById('couponFormEl');
  if (!row || !form) return;
  if (type === 'shipping') {
    row.style.display = 'none';
    form.value.required = false;
    form.value.value = 0;
  } else {
    row.style.display = '';
    form.value.required = true;
    form.maxDiscount.parentElement.style.display = type === 'percent' ? '' : 'none';
  }
}

function saveCoupon() {
  const form = document.getElementById('couponFormEl');
  const fd = new FormData(form);
  const data = {};
  fd.forEach((v, k) => data[k] = v);
  // 型変換
  const coupon = {
    id: data.id || null,
    code: (data.code || '').toUpperCase().trim(),
    name: data.name,
    type: data.type,
    value: Number(data.value || 0),
    maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : null,
    minAmount: data.minAmount ? Number(data.minAmount) : 0,
    usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
    active: form.active.checked,
    usedCount: 0
  };
  if (!coupon.code) {
    showToast('クーポンコードを入力してください');
    return;
  }
  // 重複チェック（新規時のみ）
  if (!coupon.id) {
    const existing = DataStore.getCouponByCode(coupon.code);
    if (existing) {
      showToast('このコードは既に存在します');
      return;
    }
  }
  DataStore.saveCoupon(coupon);
  closeCouponForm();
  renderCoupons();
  showToast(adminState.editingCouponId ? '✏️ クーポンを更新しました' : '🎟️ クーポンを発行しました');
}

function toggleCouponActive(id) {
  DataStore.toggleCoupon(id);
  renderCoupons();
  showToast('✅ 状態を切り替えました');
}

function deleteCoupon(id) {
  const c = DataStore.getCoupon(id);
  if (!c) return;
  if (!confirm(`クーポン「${c.code}」を削除しますか？`)) return;
  DataStore.deleteCoupon(id);
  renderCoupons();
  showToast('🗑️ クーポンを削除しました');
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
