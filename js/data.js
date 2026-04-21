// =====================================================
// 海鮮市場EC - データ管理モジュール
// localStorageでECと管理画面でデータ共有
// =====================================================

const STORAGE_KEYS = {
  PRODUCTS: 'umiichi_products',
  CART: 'umiichi_cart',
  ORDERS: 'umiichi_orders',
  SHOP_INFO: 'umiichi_shop_info',
  DATA_VERSION: 'umiichi_data_version'
};

// サンプルデータのスキーマが変わった時にバージョンを上げる
// → ユーザーのlocalStorageが古い場合は商品データのみ自動で最新化
const DATA_VERSION = 2;

// カテゴリ定義
const CATEGORIES = [
  { id: 'scallop', name: 'ホタテ', emoji: '🐚', color: '#f5b971', bgFrom: '#fff6e6', bgTo: '#f5b971' },
  { id: 'crab',    name: 'カニ',   emoji: '🦀', color: '#e76f51', bgFrom: '#fde6dd', bgTo: '#e76f51' },
  { id: 'octopus', name: 'タコ',   emoji: '🐙', color: '#c77dff', bgFrom: '#f3e6ff', bgTo: '#9d4edd' },
  { id: 'squid',   name: 'イカ',   emoji: '🦑', color: '#6a9cd1', bgFrom: '#e3edf7', bgTo: '#3a6fa0' }
];

// カテゴリごとの商品画像生成（SVG data URI）
// ラベル・波・光沢・エンブレムを重ねて「意図したデザイン」に見える商品サムネイル
function generateProductImage(category, variant = 1, label = '') {
  const cat = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
  const seed = (variant * 37 + category.length) % 360;
  const hueShift = variant % 2 === 0 ? 0 : -8;
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'>
  <defs>
    <linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='${cat.bgFrom}'/>
      <stop offset='100%' stop-color='${cat.bgTo}'/>
    </linearGradient>
    <radialGradient id='glow' cx='50%' cy='35%' r='55%'>
      <stop offset='0%' stop-color='rgba(255,255,255,.55)'/>
      <stop offset='100%' stop-color='rgba(255,255,255,0)'/>
    </radialGradient>
    <pattern id='dots' width='28' height='28' patternUnits='userSpaceOnUse'>
      <circle cx='2' cy='2' r='1.2' fill='rgba(255,255,255,.25)'/>
    </pattern>
  </defs>
  <rect width='600' height='600' fill='url(#bg)'/>
  <rect width='600' height='600' fill='url(#dots)'/>
  <rect width='600' height='600' fill='url(#glow)'/>

  <path d='M0 ${420 + variant * 10} C 150 ${380 + variant * 5}, 300 ${460 - variant * 8}, 450 ${400 + variant * 6} S 600 ${430 + variant * 4}, 600 ${430 + variant * 4} L 600 600 L 0 600 Z'
        fill='rgba(255,255,255,.22)'/>
  <path d='M0 ${480} C 150 ${440}, 300 ${520}, 450 ${470} S 600 ${490}, 600 ${490} L 600 600 L 0 600 Z'
        fill='rgba(10,35,48,.08)'/>

  <circle cx='300' cy='260' r='150' fill='rgba(255,255,255,.4)'/>
  <circle cx='300' cy='260' r='140' fill='rgba(255,255,255,.55)' stroke='rgba(255,255,255,.8)' stroke-width='3'/>
  <text x='300' y='320' font-size='180' text-anchor='middle' font-family='Apple Color Emoji,Segoe UI Emoji,sans-serif'>${cat.emoji}</text>

  <g transform='translate(40, 40)'>
    <rect x='0' y='0' rx='8' ry='8' width='120' height='30' fill='rgba(10,35,48,.85)'/>
    <text x='60' y='20' font-size='14' text-anchor='middle' fill='#fff' font-family='system-ui,sans-serif' font-weight='700' letter-spacing='2'>UMIICHI</text>
  </g>
  ${label ? `<g transform='translate(300, 540)'>
    <rect x='-140' y='-22' rx='14' ry='14' width='280' height='38' fill='rgba(255,255,255,.9)'/>
    <text x='0' y='4' font-size='16' text-anchor='middle' fill='${cat.bgTo}' font-family='system-ui,sans-serif' font-weight='700'>${label}</text>
  </g>` : ''}
</svg>`.trim().replace(/\s+/g, ' ').replace(/> </g, '><');
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// サンプル商品（初回のみ登録される）
const SAMPLE_PRODUCTS = [
  {
    id: 'p001',
    name: '活〆北海道産 特大ホタテ貝柱 1kg',
    category: 'scallop',
    price: 5980,
    originalPrice: 7980,
    stock: 24,
    description: '北海道オホーツク海の冷たい海で育った特大サイズのホタテ貝柱です。甘みと旨みがぎゅっと詰まった逸品。お刺身はもちろん、バター焼きやフライにも最適。活〆後、急速冷凍で鮮度そのままお届けします。',
    tags: ['冷凍', '送料無料', '北海道産', '特大'],
    image: generateProductImage('scallop', 1, '特大 1kg / 活〆冷凍'),
    badge: 'BEST',
    published: true,
    createdAt: Date.now() - 86400000 * 5
  },
  {
    id: 'p002',
    name: '紋別産 ボイルホタテ 500g',
    category: 'scallop',
    price: 3280,
    originalPrice: null,
    stock: 15,
    description: '旨みが凝縮されたボイルホタテ。解凍するだけですぐお召し上がりいただけます。サラダや和え物、パスタの具材にも。',
    tags: ['冷凍', '調理済み', '国産'],
    image: generateProductImage('scallop', 2, 'ボイル済 500g'),
    badge: null,
    published: true,
    createdAt: Date.now() - 86400000 * 10
  },
  {
    id: 'p003',
    name: '極上タラバガニ 脚 1.2kg (ボイル済)',
    category: 'crab',
    price: 12800,
    originalPrice: 15800,
    stock: 8,
    description: 'ロシア産・特大サイズのタラバガニ脚。身入り抜群で、プリッとした食感と濃厚な甘みが口いっぱいに広がります。ボイル済みなので解凍してそのままお召し上がりいただけます。',
    tags: ['冷凍', '送料無料', 'ボイル済', 'ギフト'],
    image: generateProductImage('crab', 1, 'タラバガニ脚 1.2kg'),
    badge: 'SALE',
    published: true,
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'p004',
    name: '本ズワイガニ 姿 約800g',
    category: 'crab',
    price: 8980,
    originalPrice: null,
    stock: 12,
    description: '日本海で獲れた活ズワイガニを船上で瞬間ボイル。身のしまりと上品な甘みが特徴です。贈答用化粧箱入り。',
    tags: ['冷凍', 'ボイル済', '日本海産', 'ギフト'],
    image: generateProductImage('crab', 2, 'ズワイガニ姿 800g'),
    badge: 'NEW',
    published: true,
    createdAt: Date.now() - 86400000 * 1
  },
  {
    id: 'p005',
    name: '明石産 真タコ 丸ごと一杯 800g',
    category: 'octopus',
    price: 4580,
    originalPrice: null,
    stock: 10,
    description: '激しい潮流で育った明石の真タコは、足が太く、コリコリとした食感と凝縮された旨みが自慢。お刺身、タコ飯、唐揚げなど幅広くお使いいただけます。',
    tags: ['冷凍', '国産', '明石産'],
    image: generateProductImage('octopus', 1, '真タコ 一杯 800g'),
    badge: null,
    published: true,
    createdAt: Date.now() - 86400000 * 7
  },
  {
    id: 'p006',
    name: 'タコの刺身用スライス 300g',
    category: 'octopus',
    price: 1980,
    originalPrice: 2480,
    stock: 30,
    description: '解凍するだけで刺身として召し上がれる便利なスライスパック。コリコリ食感、ほんのりとした甘み。',
    tags: ['冷凍', '刺身用', 'お手軽'],
    image: generateProductImage('octopus', 2, '刺身用スライス 300g'),
    badge: 'SALE',
    published: true,
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'p007',
    name: '函館産 真イカ 刺身用 5杯セット',
    category: 'squid',
    price: 3480,
    originalPrice: null,
    stock: 18,
    description: '函館港水揚げ直後に船上で急速冷凍。透明度抜群の新鮮な真イカを刺身用にお届けします。下処理済みで調理カンタン。',
    tags: ['冷凍', '刺身用', '函館産', '下処理済'],
    image: generateProductImage('squid', 1, '真イカ 5杯セット'),
    badge: null,
    published: true,
    createdAt: Date.now() - 86400000 * 4
  },
  {
    id: 'p008',
    name: 'するめイカ一夜干し 5枚セット',
    category: 'squid',
    price: 2480,
    originalPrice: null,
    stock: 25,
    description: '昔ながらの製法で丁寧に作った一夜干し。軽く炙るだけで、凝縮された旨みと磯の香りが口いっぱいに広がります。',
    tags: ['常温', '干物', '伝統製法'],
    image: generateProductImage('squid', 2, '一夜干し 5枚セット'),
    badge: null,
    published: true,
    createdAt: Date.now() - 86400000 * 8
  }
];

const DEFAULT_SHOP_INFO = {
  name: '海市 -UMIICHI-',
  tagline: '北の海から、食卓へ。',
  description: '北海道産直の高品質な海鮮を、新鮮なままお届けする水産加工専門のECサイトです。',
  address: '北海道紋別市XX町1-2-3',
  phone: '0158-XX-XXXX',
  email: 'info@umiichi.example'
};

// =====================================================
// データ管理API
// =====================================================

const DataStore = {
  // 初期化 - サンプルデータ投入
  init() {
    const savedVersion = Number(localStorage.getItem(STORAGE_KEYS.DATA_VERSION) || 0);
    const stale = savedVersion < DATA_VERSION;

    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS) || stale) {
      // 既存の商品データが旧スキーマ（Unsplash URL等）の場合、管理者編集分は保持しつつ
      // サンプル商品IDのみ最新のSVG画像で上書きする
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      const sampleIds = new Set(SAMPLE_PRODUCTS.map(p => p.id));
      const customProducts = existing.filter(p => !sampleIds.has(p.id));
      const merged = [...SAMPLE_PRODUCTS, ...customProducts];
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SHOP_INFO)) {
      localStorage.setItem(STORAGE_KEYS.SHOP_INFO, JSON.stringify(DEFAULT_SHOP_INFO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }
    localStorage.setItem(STORAGE_KEYS.DATA_VERSION, String(DATA_VERSION));
  },

  // 商品取得
  getProducts(options = {}) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    let filtered = all;
    if (options.onlyPublished) filtered = filtered.filter(p => p.published);
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(p => p.category === options.category);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (options.sort === 'price-asc')  filtered.sort((a,b) => a.price - b.price);
    if (options.sort === 'price-desc') filtered.sort((a,b) => b.price - a.price);
    if (options.sort === 'newest')     filtered.sort((a,b) => b.createdAt - a.createdAt);
    return filtered;
  },

  getProduct(id) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    return all.find(p => p.id === id);
  },

  saveProduct(product) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const idx = all.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...product };
    } else {
      product.id = product.id || 'p' + Date.now();
      product.createdAt = product.createdAt || Date.now();
      all.unshift(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(all));
    return product;
  },

  deleteProduct(id) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const filtered = all.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
  },

  togglePublish(id) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
    const p = all.find(x => x.id === id);
    if (p) {
      p.published = !p.published;
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(all));
    }
    return p;
  },

  // カート管理
  getCart() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]');
  },

  addToCart(productId, qty = 1) {
    const cart = this.getCart();
    const exist = cart.find(c => c.productId === productId);
    if (exist) {
      exist.qty += qty;
    } else {
      cart.push({ productId, qty });
    }
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return cart;
  },

  updateCartItem(productId, qty) {
    const cart = this.getCart();
    const item = cart.find(c => c.productId === productId);
    if (item) {
      if (qty <= 0) {
        const filtered = cart.filter(c => c.productId !== productId);
        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(filtered));
        return filtered;
      }
      item.qty = qty;
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    }
    return cart;
  },

  removeFromCart(productId) {
    const cart = this.getCart().filter(c => c.productId !== productId);
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    return cart;
  },

  clearCart() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
  },

  // 注文管理
  getOrders() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  },

  createOrder(orderData) {
    const orders = this.getOrders();
    const order = {
      id: 'O' + Date.now(),
      createdAt: Date.now(),
      status: 'pending',
      ...orderData
    };
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    return order;
  },

  // ショップ情報
  getShopInfo() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOP_INFO) || JSON.stringify(DEFAULT_SHOP_INFO));
  },

  saveShopInfo(info) {
    localStorage.setItem(STORAGE_KEYS.SHOP_INFO, JSON.stringify(info));
  },

  // すべてリセット(デモ用)
  resetAll() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    this.init();
  }
};

// 共通フォーマット関数
const Format = {
  price(n) { return '¥' + Number(n).toLocaleString('ja-JP'); },
  date(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'short', day:'numeric' });
  },
  categoryName(id) {
    const c = CATEGORIES.find(x => x.id === id);
    return c ? c.name : '';
  },
  categoryEmoji(id) {
    const c = CATEGORIES.find(x => x.id === id);
    return c ? c.emoji : '📦';
  }
};

// 初期化
DataStore.init();
