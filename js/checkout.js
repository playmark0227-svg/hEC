// =====================================================
// 海市 -UMIICHI- チェックアウトロジック
// =====================================================

const CheckoutState = {
  step: 1,
  shipping: null,
  payment: null,
  items: [],
  orderId: null,
  appliedCoupon: null  // { code, name, type, discount, shippingFree }
};

const STORAGE_KEY_DRAFT = 'umiichi_checkout_draft';
const EXPRESS_FEE = 500;
const COD_FEE = 330;
const FREE_SHIPPING_THRESHOLD = 5000;
const BASE_SHIPPING = 980;

// =====================================================
// 初期化
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  const cart = DataStore.getCart();
  if (!cart.length) {
    // 空カートならトップへ戻す
    alert('カートが空です。商品をお選びください。');
    location.href = 'index.html';
    return;
  }

  CheckoutState.items = cart.map(c => {
    const p = DataStore.getProduct(c.productId);
    return p ? {
      productId: p.id,
      name: p.name,
      price: p.price,
      qty: c.qty,
      image: p.image,
      category: p.category
    } : null;
  }).filter(Boolean);

  loadDraft();
  renderSummary();
  setDefaultDeliveryDate();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && CheckoutState.step > 1 && CheckoutState.step < 4) {
      // ESCで一つ前のステップへ
    }
  });
  // 配送オプション変更時、サマリー更新
  document.querySelectorAll('input[name="delivery"]').forEach(r => {
    r.addEventListener('change', renderSummary);
  });
  document.querySelectorAll('input[name="payment"]').forEach(r => {
    r.addEventListener('change', renderSummary);
  });
  // 入力途中ドラフト保存
  document.getElementById('shippingForm').addEventListener('input', saveDraft);
  document.getElementById('paymentForm').addEventListener('input', saveDraft);
});

function setDefaultDeliveryDate() {
  const input = document.getElementById('deliveryDateInput');
  if (!input) return;
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const min = new Date();
  min.setDate(min.getDate() + 2);
  input.min = min.toISOString().slice(0, 10);
  input.value = d.toISOString().slice(0, 10);
}

// =====================================================
// ステップ切替
// =====================================================
function goStep(n) {
  // バリデーション
  if (n >= 2) {
    const form = document.getElementById('shippingForm');
    if (!form.reportValidity()) return;
    CheckoutState.shipping = collectForm(form);
  }
  if (n >= 3) {
    const pform = document.getElementById('paymentForm');
    if (!pform.reportValidity()) return;
    CheckoutState.payment = collectForm(pform);
    renderReview();
  }
  CheckoutState.step = n;
  document.querySelectorAll('[data-panel]').forEach(p => {
    p.hidden = p.dataset.panel !== String(n);
  });
  document.querySelectorAll('.step').forEach(s => {
    const step = Number(s.dataset.step);
    s.classList.toggle('active', step === n);
    s.classList.toggle('done', step < n);
  });
  // スクロール上へ
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // サマリー側の表示制御（完了時は非表示）
  document.getElementById('summarySide').hidden = (n === 4);
  saveDraft();
}

// =====================================================
// フォーム収集
// =====================================================
function collectForm(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (data[k] !== undefined) {
      data[k] = [].concat(data[k], v);
    } else {
      data[k] = v;
    }
  });
  return data;
}

// =====================================================
// 郵便番号検索（ダミー実装）
// =====================================================
async function lookupZip() {
  const zip = document.getElementById('zipInput').value.replace(/[^\d]/g, '');
  if (zip.length !== 7) {
    showToast('郵便番号は7桁で入力してください');
    return;
  }
  // デモ用：ダミー住所をセット
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
    if (!res.ok) throw new Error('検索失敗');
    const json = await res.json();
    if (!json.results || !json.results.length) {
      showToast('該当する住所が見つかりませんでした');
      return;
    }
    const r = json.results[0];
    const form = document.getElementById('shippingForm');
    form.pref.value = r.address1;
    form.city.value = r.address2 + r.address3;
    form.address.focus();
    showToast('住所を入力しました');
  } catch (e) {
    // フォールバック：オフライン時
    const form = document.getElementById('shippingForm');
    form.pref.value = '北海道';
    form.city.value = '紋別市海辺町';
    form.address.focus();
    showToast('（デモ）ダミー住所を入力しました');
  }
}

// =====================================================
// カード番号・有効期限フォーマット
// =====================================================
function formatCardNumber(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 16);
  v = v.replace(/(.{4})/g, '$1 ').trim();
  e.target.value = v;
}
function formatCardExp(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
  e.target.value = v;
}
function togglePaymentPanel() {
  const payment = document.querySelector('input[name="payment"]:checked')?.value;
  document.getElementById('cardFields').classList.toggle('hidden', payment !== 'card');
  document.querySelectorAll('#cardFields input').forEach(i => {
    i.required = (payment === 'card');
  });
  renderSummary();
}

// =====================================================
// サマリー描画
// =====================================================
function computeTotals() {
  const subtotal = CheckoutState.items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = document.querySelector('input[name="delivery"]:checked')?.value || 'standard';
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'card';
  let baseShipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : BASE_SHIPPING;
  const express = delivery === 'express' ? EXPRESS_FEE : 0;
  const cod = payment === 'cod' ? COD_FEE : 0;

  // クーポン適用
  let discount = 0;
  let couponShippingFree = false;
  const ac = CheckoutState.appliedCoupon;
  if (ac) {
    // 小計が変わった可能性があるので再検証
    const recheck = DataStore.validateCoupon(ac.code, subtotal);
    if (recheck.ok) {
      discount = recheck.discount || 0;
      couponShippingFree = !!recheck.shippingFree;
      // 最新の計算結果で上書き
      CheckoutState.appliedCoupon = {
        code: recheck.coupon.code,
        name: recheck.coupon.name,
        type: recheck.coupon.type,
        discount,
        shippingFree: couponShippingFree
      };
    } else {
      // 条件から外れた場合は解除
      CheckoutState.appliedCoupon = null;
      showCouponStatus(recheck.error, 'error');
    }
  }
  if (couponShippingFree) baseShipping = 0;
  const total = Math.max(0, subtotal + baseShipping + express + cod - discount);
  return { subtotal, baseShipping, express, cod, discount, couponShippingFree, total, delivery, payment };
}

// =====================================================
// クーポン適用
// =====================================================
function applyCoupon() {
  const input = document.getElementById('couponInput');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) {
    showCouponStatus('クーポンコードを入力してください', 'error');
    return;
  }
  const subtotal = CheckoutState.items.reduce((s, i) => s + i.price * i.qty, 0);
  const result = DataStore.validateCoupon(code, subtotal);
  if (!result.ok) {
    CheckoutState.appliedCoupon = null;
    showCouponStatus(result.error, 'error');
    renderSummary();
    return;
  }
  CheckoutState.appliedCoupon = {
    code: result.coupon.code,
    name: result.coupon.name,
    type: result.coupon.type,
    discount: result.discount || 0,
    shippingFree: !!result.shippingFree
  };
  let msg = '';
  if (result.shippingFree) {
    msg = `✅ 「${result.coupon.name}」を適用しました（送料無料）`;
  } else {
    msg = `✅ 「${result.coupon.name}」を適用しました（${Format.price(result.discount)} 割引）`;
  }
  showCouponStatus(msg, 'success');
  input.value = result.coupon.code;
  input.disabled = true;
  // 「適用する」ボタンを「解除」に切替
  const btn = input.parentElement.querySelector('button');
  if (btn) {
    btn.textContent = '解除';
    btn.onclick = removeCoupon;
    btn.classList.add('coupon-btn-remove');
  }
  renderSummary();
}

function removeCoupon() {
  CheckoutState.appliedCoupon = null;
  const input = document.getElementById('couponInput');
  if (input) {
    input.value = '';
    input.disabled = false;
  }
  const btn = input?.parentElement.querySelector('button');
  if (btn) {
    btn.textContent = '適用する';
    btn.onclick = applyCoupon;
    btn.classList.remove('coupon-btn-remove');
  }
  showCouponStatus('', 'clear');
  renderSummary();
}

function showCouponStatus(msg, kind) {
  const el = document.getElementById('couponStatus');
  if (!el) return;
  if (!msg || kind === 'clear') {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('is-success', 'is-error');
    return;
  }
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle('is-success', kind === 'success');
  el.classList.toggle('is-error', kind === 'error');
}

function renderSummary() {
  const t = computeTotals();
  const itemsEl = document.getElementById('summaryItems');
  itemsEl.innerHTML = CheckoutState.items.map(i => `
    <div class="summary-item">
      <div style="position:relative;width:52px;height:52px">
        <img class="summary-item-img" src="${i.image}" alt="${escapeHtml(i.name)}">
        <span class="summary-item-qty">${i.qty}</span>
      </div>
      <div class="summary-item-body">
        <span class="summary-item-name">${escapeHtml(i.name)}</span>
        <span class="summary-item-price">${Format.price(i.price * i.qty)}</span>
      </div>
    </div>
  `).join('');
  document.getElementById('sumSubtotal').textContent = Format.price(t.subtotal);
  document.getElementById('sumShipping').innerHTML = t.baseShipping === 0
    ? (t.couponShippingFree ? '<b style="color:#16a34a">無料（クーポン）</b>' : '<b>無料</b>')
    : Format.price(t.baseShipping);
  document.getElementById('sumExpressRow').hidden = t.express === 0;
  document.getElementById('sumExpress').textContent = Format.price(t.express);
  document.getElementById('sumCodRow').hidden = t.cod === 0;
  document.getElementById('sumCod').textContent = Format.price(t.cod);
  // クーポン割引の表示
  const discountRow = document.getElementById('sumDiscountRow');
  const discountEl = document.getElementById('sumDiscount');
  const couponLabel = document.getElementById('sumCouponLabel');
  if (discountRow && discountEl) {
    if (t.discount > 0) {
      discountRow.hidden = false;
      discountEl.textContent = '-' + Format.price(t.discount);
      if (couponLabel && CheckoutState.appliedCoupon) {
        couponLabel.textContent = CheckoutState.appliedCoupon.name;
      }
    } else {
      discountRow.hidden = true;
      discountEl.textContent = '-¥0';
    }
  }
  document.getElementById('sumTotal').textContent = Format.price(t.total);
  const hint = document.getElementById('sumFreeHint');
  if (t.subtotal < FREE_SHIPPING_THRESHOLD) {
    const diff = FREE_SHIPPING_THRESHOLD - t.subtotal;
    hint.hidden = false;
    hint.innerHTML = `🚚 あと <b>${Format.price(diff)}</b> で送料無料！`;
  } else {
    hint.hidden = true;
  }
}

// =====================================================
// 確認画面の描画
// =====================================================
function renderReview() {
  const s = CheckoutState.shipping;
  const p = CheckoutState.payment;
  if (!s || !p) return;

  document.getElementById('reviewShipping').innerHTML = `
    <dl class="review-kv">
      <dt>お名前</dt><dd><b>${escapeHtml(s.name)}</b>（${escapeHtml(s.nameKana)} 様）</dd>
      <dt>ご住所</dt><dd>〒${escapeHtml(s.zip)}<br>${escapeHtml(s.pref)}${escapeHtml(s.city)}<br>${escapeHtml(s.address)}</dd>
      <dt>お電話</dt><dd>${escapeHtml(s.phone)}</dd>
      <dt>メール</dt><dd>${escapeHtml(s.email)}</dd>
      <dt>配送方法</dt><dd>${s.delivery === 'express' ? 'お急ぎ便（+¥500）' : '通常配送（クール便）'}</dd>
      <dt>配達希望日</dt><dd>${s.deliveryDate ? Format.date(new Date(s.deliveryDate).getTime()) : '指定なし'}${s.deliveryTime ? ' / ' + escapeHtml(s.deliveryTime) : ''}</dd>
      ${s.note ? `<dt>備考</dt><dd>${escapeHtml(s.note)}</dd>` : ''}
    </dl>
  `;

  const pmLabel = {
    card: 'クレジットカード',
    bank: '銀行振込（前払い）',
    cod: '代金引換（手数料¥330）'
  }[p.payment];
  let cardInfo = '';
  if (p.payment === 'card' && p.cardNumber) {
    const digits = p.cardNumber.replace(/\D/g, '');
    const masked = '**** **** **** ' + digits.slice(-4);
    cardInfo = `
      <dt>カード番号</dt><dd><code>${masked}</code></dd>
      <dt>カード名義</dt><dd>${escapeHtml(p.cardName || '')}</dd>
      <dt>有効期限</dt><dd>${escapeHtml(p.cardExp || '')}</dd>
    `;
  }
  document.getElementById('reviewPayment').innerHTML = `
    <dl class="review-kv">
      <dt>お支払い</dt><dd><b>${pmLabel}</b></dd>
      ${cardInfo}
    </dl>
  `;

  document.getElementById('reviewItems').innerHTML = CheckoutState.items.map(i => `
    <div class="review-item">
      <img src="${i.image}" alt="${escapeHtml(i.name)}">
      <div>
        <div class="review-item-name">${escapeHtml(i.name)}</div>
        <div class="review-item-qty">${Format.price(i.price)} × ${i.qty}点</div>
      </div>
      <div class="review-item-price">${Format.price(i.price * i.qty)}</div>
    </div>
  `).join('');

  // クーポン適用状況の表示
  const reviewCouponWrap = document.getElementById('reviewCouponBlock');
  const reviewCouponBody = document.getElementById('reviewCoupon');
  if (reviewCouponWrap && reviewCouponBody) {
    const ac = CheckoutState.appliedCoupon;
    if (ac) {
      const t = computeTotals();
      const benefit = ac.shippingFree
        ? '送料無料'
        : `${Format.price(t.discount)} 割引`;
      reviewCouponWrap.hidden = false;
      reviewCouponBody.innerHTML = `
        <dl class="review-kv">
          <dt>クーポン</dt><dd><b>${escapeHtml(ac.name)}</b> <code style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:12px;margin-left:6px">${escapeHtml(ac.code)}</code></dd>
          <dt>特典</dt><dd style="color:#16a34a;font-weight:700">${benefit}</dd>
        </dl>
      `;
    } else {
      reviewCouponWrap.hidden = true;
    }
  }
}

// =====================================================
// 注文確定
// =====================================================
function placeOrder() {
  const btn = document.getElementById('placeOrderBtn');
  btn.classList.add('loading');

  // 擬似決済処理（1.2秒ディレイ）
  setTimeout(() => {
    const t = computeTotals();
    const ac = CheckoutState.appliedCoupon;
    const order = DataStore.createOrder({
      items: CheckoutState.items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        image: i.image
      })),
      subtotal: t.subtotal,
      shipping: t.baseShipping,
      expressFee: t.express,
      codFee: t.cod,
      discount: t.discount || 0,
      coupon: ac ? {
        code: ac.code,
        name: ac.name,
        type: ac.type,
        discount: t.discount || 0,
        shippingFree: !!ac.shippingFree
      } : null,
      total: t.total,
      shippingInfo: CheckoutState.shipping,
      paymentMethod: CheckoutState.payment.payment,
      paymentSummary: maskPayment(CheckoutState.payment),
      deliveryType: t.delivery,
      note: CheckoutState.shipping.note || ''
    });
    // クーポン利用カウント
    if (ac && ac.code) {
      try { DataStore.incrementCouponUsage(ac.code); } catch (e) { console.warn(e); }
    }
    CheckoutState.orderId = order.id;
    DataStore.clearCart();
    localStorage.removeItem(STORAGE_KEY_DRAFT);
    renderComplete(order);
    goStep(4);
    btn.classList.remove('loading');
  }, 1200);
}

function maskPayment(p) {
  if (p.payment === 'card' && p.cardNumber) {
    const digits = p.cardNumber.replace(/\D/g, '');
    return {
      method: 'card',
      last4: digits.slice(-4),
      brand: detectBrand(digits),
      cardName: p.cardName || '',
      exp: p.cardExp || ''
    };
  }
  if (p.payment === 'bank') return { method: 'bank' };
  if (p.payment === 'cod') return { method: 'cod' };
  return { method: p.payment };
}

function detectBrand(digits) {
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (/^35/.test(digits)) return 'JCB';
  if (/^30[0-5]|^36|^38/.test(digits)) return 'Diners';
  return 'Card';
}

// =====================================================
// 完了画面
// =====================================================
function renderComplete(order) {
  const s = order.shippingInfo;
  const pm = {
    card: `クレジットカード${order.paymentSummary.brand ? '（' + order.paymentSummary.brand + ' **** ' + order.paymentSummary.last4 + '）' : ''}`,
    bank: '銀行振込（前払い）',
    cod: '代金引換'
  }[order.paymentMethod];
  const expectedDate = s.deliveryDate
    ? Format.date(new Date(s.deliveryDate).getTime())
    : '最短翌々日';

  // クーポン適用があれば表示
  let couponRow = '';
  if (order.coupon && (order.discount > 0 || order.coupon.shippingFree)) {
    const benefit = order.coupon.shippingFree
      ? '送料無料'
      : `-${Format.price(order.discount || 0)}`;
    couponRow = `<dt>🎟️ クーポン</dt><dd><b>${escapeHtml(order.coupon.name)}</b>（${escapeHtml(order.coupon.code)}）<span style="color:#16a34a;font-weight:700;margin-left:8px">${benefit}</span></dd>`;
  }

  document.getElementById('completeOrder').innerHTML = `
    <div class="co-id">
      <span>注文番号</span>
      <b>${order.id}</b>
    </div>
    <dl>
      <dt>お届け先</dt><dd>${escapeHtml(s.name)} 様<br>〒${escapeHtml(s.zip)} ${escapeHtml(s.pref)}${escapeHtml(s.city)}${escapeHtml(s.address)}</dd>
      <dt>お支払い</dt><dd>${pm}</dd>
      <dt>お届け予定</dt><dd>${expectedDate}${s.deliveryTime ? ' / ' + escapeHtml(s.deliveryTime) : ''}</dd>
      ${couponRow}
      <dt>合計金額</dt><dd style="color:var(--c-primary);font-weight:900">${Format.price(order.total)}</dd>
    </dl>
  `;
}

// =====================================================
// ドラフト保存
// =====================================================
function saveDraft() {
  try {
    const data = {
      shipping: CheckoutState.shipping || collectForm(document.getElementById('shippingForm')),
      payment: CheckoutState.payment || collectForm(document.getElementById('paymentForm')),
      step: CheckoutState.step
    };
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(data));
  } catch (e) {}
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.shipping) {
      const f = document.getElementById('shippingForm');
      Object.entries(d.shipping).forEach(([k, v]) => {
        const el = f.elements[k];
        if (!el || !v) return;
        if (el.type === 'radio' || el.type === 'checkbox') {
          f.querySelectorAll(`[name="${k}"]`).forEach(r => {
            r.checked = (r.value === v);
          });
        } else {
          el.value = v;
        }
      });
    }
    if (d.payment) {
      const f = document.getElementById('paymentForm');
      Object.entries(d.payment).forEach(([k, v]) => {
        const el = f.elements[k];
        if (!el || !v) return;
        if (el.type === 'radio') {
          f.querySelectorAll(`[name="${k}"]`).forEach(r => { r.checked = (r.value === v); });
        } else if (k !== 'cardNumber' && k !== 'cardCvc') {
          // カード情報は復元しない（セキュリティ上の理由を装う）
          if (el.type === 'checkbox') el.checked = (v === 'on' || v === true);
          else el.value = v;
        }
      });
      togglePaymentPanel();
    }
  } catch (e) {
    console.warn('draft load failed:', e);
  }
}

// =====================================================
// ユーティリティ
// =====================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, duration);
}
