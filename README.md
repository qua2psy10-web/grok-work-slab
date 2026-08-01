# 単純支持 RC 床版 設計補助ツール

主桁間の**一方向 RC 床版**を、単位幅（既定 1 m）の**単純梁**として許容応力度設計（参考値）で検討する、ブラウザ完結の静的 Web アプリです。

## 場所

```
/Users/qitengyiming/Documents/Grok/work/rc-slab-design/
```

## 起動方法

依存パッケージ・ビルドは不要です。

1. Finder で `index.html` をダブルクリックする  
   または  
2. ターミナルから:

```bash
open /Users/qitengyiming/Documents/Grok/work/rc-slab-design/index.html
```

ローカルサーバでも可:

```bash
cd /Users/qitengyiming/Documents/Grok/work/rc-slab-design
python3 -m http.server 8765
# ブラウザで http://localhost:8765
```

## できること

- 死荷重（自重・舗装・付加）＋活荷重（等分布等価）×(1+衝撃係数)
- 単純梁断面力: \(M = wL^2/8\), \(V = wL/2\)
- **単鉄筋／複鉄筋**矩形の曲げ応力度照査（σc, σs, 複鉄筋時は σs'）と必要鉄筋量
- せん断応力度照査（τ）
- 引張・圧縮・**配力**鉄筋の自動提案（径・間隔）または手動指定
- **詳細照査（参考）**: 最小版厚、配筋間隔上下限、配力鉄筋量、定着長・重ね継手長
- **プリセット**適用、条件の **localStorage 保存／読込**、**JSON 入出力**
- **設計計算書**の画面表示と印刷／PDF 保存（ブラウザの印刷機能）

## 計算の概要

| 項目 | 内容 |
|------|------|
| モデル | 単純支持・等分布・単位幅 |
| 有効高さ | \(d = t - c - \phi/2\)（引張主鉄筋1段） |
| 圧縮位置 | \(d' = c' + \phi'/2\)（複鉄筋時） |
| 単鉄筋曲げ | \(k,j\) による単鉄筋矩形、As,req は反復 |
| 複鉄筋曲げ | つり合い M1 超過分を圧縮鉄筋偶力で負担。応力度は換算断面 \(I_{tr}\) |
| 断面形式 | 単鉄筋／複鉄筋（必要時自動）／複鉄筋（常時） |
| せん断 | \(\tau = V/(bjd)\) |
| 材料 | σck / 鉄筋種別の参考テーブル（画面で上書き可） |
| n | 既定は固定 n=15（オフにすると Es/Ec、上限15） |

### 複鉄筋の要点

- つり合い断面: \(k = n/(n+\sigma_{sa}/\sigma_{ca})\), \(M_1 = \frac12 \sigma_{ca} k j b d^2\)
- \(M > M_1\) のとき \(M_2 = M - M_1\) を圧縮・引張の追加鉄筋で負担
- 応力度照査: \(I_{tr} = b(kd)^3/3 + (n-1)A_s'(kd-d')^2 + n A_s (d-kd)^2\)

## 免責

- **道路橋示方書の全文準拠・設計認証ソフトではありません。**
- 許容応力度や衝撃係数などは教育・補助用の参考値です。
- 正式設計では最新の適用基準・荷重モデル（T 荷重影響線など）で検証してください。

## 検証

ブラウザで `tests/calc.test.html` を開くと、代表ケースの自動検算が走ります。

または Node で計算コアを読み込んで検算:

```bash
cd /Users/qitengyiming/Documents/Grok/work/rc-slab-design
node tests/run-node-checks.cjs
```

## 詳細照査の参考式

| 項目 | 内容（いずれも参考・画面で係数変更可） |
|------|----------------------------------------|
| 最小版厚 | \(t \ge \max(t_{\min}, L/n)\) 既定 \(t_{\min}=160\) mm, \(n=30\) |
| 間隔 | \(\min s \le s \le \min(s_{\max}, k\cdot t)\) 既定 \(k=1.5\) |
| 配力 As | \(\max(0.3\,A_{s,\mathrm{main}},\, p_{\mathrm{dist}} b d)\) |
| 定着 ld | \(\max(\sigma_{sa}/(4\tau_{oa})\cdot\phi,\, 20\phi)\), 重ね \(l_s=\alpha\cdot l_d\) |

## フォルダ構成

```
rc-slab-design/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── format.js
│   ├── report.js
│   ├── presets.js          … プリセット・保存
│   └── calc/               … 荷重・断面・曲げ・せん断・配筋・詳細照査
└── tests/
```

## 対象外（今後の候補）

二方向版・連続版・ハンチ、T 荷重影響線、部分係数設計（限界状態）、疲労・パンチング・定着長の詳細など。
