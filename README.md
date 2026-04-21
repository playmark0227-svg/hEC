# 🌊 海市 -UMIICHI- | 水産加工 EC サイト

北海道産直のホタテ・カニ・タコ・イカを販売する EC サイトと、超シンプルな店舗管理ページのフロントエンドサンプル。

## 🔗 デモ

- **店舗ページ**: [https://playmark0227-svg.github.io/hEC/](https://playmark0227-svg.github.io/hEC/)
- **店舗管理ページ**: [https://playmark0227-svg.github.io/hEC/admin.html](https://playmark0227-svg.github.io/hEC/admin.html)

## ✨ 機能

### 店舗ページ (`index.html`)
- ヒーローセクション / カテゴリ別ナビゲーション
- 商品一覧（バッジ・割引表示・在庫警告つき）
- 商品詳細モーダル、数量選択、カートへ追加
- サイドカート（¥5,000以上で送料無料）
- 検索・並び替え・トースト通知
- モバイル完全対応

### 店舗管理ページ (`admin.html`)
- ダッシュボード（公開数・累計注文・売上・要注意在庫）
- 商品管理 (トグルで公開切替、編集・複製・削除)
- 商品追加フォーム（画像URL or ファイルアップロード対応）
- 注文履歴、店舗情報編集、デモデータリセット

## 🛠 技術スタック

- Pure HTML / CSS / Vanilla JavaScript
- localStorage による簡易永続化（ECと管理画面でデータ共有）
- 依存関係・ビルド不要

## 📁 ファイル構成

```
hEC/
├── index.html        # 店舗ページ
├── admin.html        # 店舗管理ページ
├── css/
│   ├── style.css     # 共通スタイル
│   └── admin.css     # 管理画面スタイル
├── js/
│   ├── data.js       # データ層 (localStorage)
│   ├── shop.js       # 店舗ロジック
│   └── admin.js      # 管理画面ロジック
└── .nojekyll         # GitHub Pages Jekyll 無効化
```

## 🚀 ローカルで起動

```bash
cd hEC
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

## 📝 GitHub Pages で公開

1. このリポジトリの **Settings → Pages** を開く
2. **Source** で `Deploy from a branch` を選択
3. **Branch** を `main` / `/ (root)` に設定して Save
4. 数分後に `https://<username>.github.io/hEC/` が公開される
