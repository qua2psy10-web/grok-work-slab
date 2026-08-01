# セッション引き継ぎメモ

最終更新: 2026-07-27（1→2 機能実装後）

## 作業場所

- ユーザー指定の作業ルート: `/Users/qitengyiming/Documents/Grok/work/`
- 本プロジェクト: `/Users/qitengyiming/Documents/Grok/work/rc-slab-design/`

## 決定事項（要約）

| 項目 | 内容 |
|------|------|
| 目的 | 単純支持 RC 床版の設計 Web アプリ（補助・教育用） |
| 技術 | 静的 HTML+CSS+JS（ビルド不要） |
| 設計法 | 許容応力度（参考値） |
| 第1版 | 曲げ・せん断・配筋・計算書 |
| 第2版 | 複鉄筋 |
| **第3版** | **プリセット＋保存/JSON、詳細照査（配力・最小厚・間隔・定着）** |

## 実装済み

- 単鉄筋／複鉄筋曲げ、せん断、主筋・圧縮筋提案、計算書
- **組み込みプリセット**（標準 / 道示寄り参考 / 長支間 / 複鉄筋デモ）
- **localStorage 保存・読込・削除**（最大30件）
- **JSON エクスポート／インポート**
- **詳細照査** `js/calc/detailChecks.js`
  - 最小版厚: t ≥ max(tmin, L/n)
  - 主筋・圧縮筋間隔上下限
  - 配力鉄筋 As と自動/手動配筋
  - 定着 ld・重ね ls（簡易）
- 結果画面・計算書 §8 に反映。総合判定に詳細照査を含む
- テスト: `node tests/run-node-checks.cjs` 通過

## 起動

```bash
open /Users/qitengyiming/Documents/Grok/work/rc-slab-design/index.html
node /Users/qitengyiming/Documents/Grok/work/rc-slab-design/tests/run-node-checks.cjs
```

## 次回候補

- 連続版（2〜3径間）の M, V
- 複鉄筋の反復最適化
- ハンチ・有効支間
- T 荷重簡易影響線
- UI 体裁

## 会話要約

1. 第1版作成 → 複鉄筋実装
2. おすすめ機能を提示 → ユーザーが **1→2**（プリセット保存、詳細照査）を選択
3. 本日: 1→2 を実装・検算通過
