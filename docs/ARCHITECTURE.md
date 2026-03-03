# MyCraft - アーキテクチャ & 開発引き継ぎ資料

## 概要

MyCraft はブラウザで動作する Minecraft 風 3D ボクセルゲーム。
React + TypeScript + Three.js + Vite で構成される。

**公開URL**: https://kekoyana.github.io/mykura/

---

## 技術スタック

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 18.3 | UI レイヤー（HUD, インベントリ, オーバーレイ） |
| Three.js | 0.183 | 3D レンダリングエンジン |
| TypeScript | 5.6 | 型安全なコード |
| Vite | 6.0 | ビルド & 開発サーバー |

---

## ディレクトリ構成

```
src/
├── main.tsx              # エントリーポイント（React マウント）
├── App.tsx               # メイン React コンポーネント（UI全体）
├── App.css               # UI スタイル
├── index.css             # グローバルリセット
├── vite-env.d.ts         # Vite 型定義
└── game/
    ├── engine.ts          # ゲームエンジン（メインループ, 入力, ライティング）
    ├── world.ts           # ワールド管理（チャンク生成/破棄, 地形生成）
    ├── chunk.ts           # チャンクデータ & メッシュ構築
    ├── player.ts          # プレイヤー操作 & 物理演算
    ├── blocks.ts          # ブロック型定義 & メタデータ
    ├── noise.ts           # Perlin ノイズ（2D/3D）
    ├── textures.ts        # プロシージャルテクスチャアトラス生成
    ├── particles.ts       # パーティクルシステム
    ├── sounds.ts          # 効果音（Web Audio API）
    └── clouds.ts          # 雲レイヤー
```

---

## アーキテクチャ図

```
┌─────────────────────────────────────────────────┐
│  App.tsx (React)                                │
│  ┌─────────┐ ┌────────┐ ┌──────┐ ┌───────────┐ │
│  │Start    │ │HUD     │ │Hotbar│ │Inventory  │ │
│  │Screen   │ │(座標,  │ │(9枠) │ │(Eキー)    │ │
│  │         │ │FPS,時刻)│ │      │ │           │ │
│  └─────────┘ └────────┘ └──────┘ └───────────┘ │
├─────────────────────────────────────────────────┤
│  Engine (ゲームループ)                           │
│  ┌─────────────────┐  ┌────────────────────┐    │
│  │ Three.js Scene   │  │ Input Handler      │    │
│  │ ├─ Renderer      │  │ ├─ PointerLock     │    │
│  │ ├─ Camera        │  │ ├─ Mouse (操作)    │    │
│  │ ├─ AmbientLight  │  │ ├─ Keyboard (WASD) │    │
│  │ ├─ DirectionLight│  │ └─ Wheel (選択)    │    │
│  │ └─ Fog           │  └────────────────────┘    │
│  └─────────────────┘                             │
├──────────────┬──────────────┬────────────────────┤
│ World        │ Player       │ Effects            │
│ ├─ Chunks[]  │ ├─ Position  │ ├─ Particles       │
│ ├─ Generate  │ ├─ Velocity  │ ├─ Sounds          │
│ ├─ Raycast   │ ├─ Collision │ ├─ Clouds          │
│ └─ Biomes    │ └─ Swimming  │ └─ Day/Night       │
├──────────────┴──────────────┴────────────────────┤
│ Data Layer                                       │
│ ├─ blocks.ts   (16種のブロック定義)               │
│ ├─ noise.ts    (Perlin 2D/3D + FBM)             │
│ └─ textures.ts (Canvas ベースのテクスチャアトラス) │
└─────────────────────────────────────────────────┘
```

---

## コアシステム詳細

### 1. チャンクシステム (`chunk.ts`, `world.ts`)

**定数:**
- `CHUNK_SIZE` = 16 (X, Z 方向のブロック数)
- `CHUNK_HEIGHT` = 64 (Y 方向のブロック数)
- `RENDER_DISTANCE` = 5 (チャンク単位の描画距離)

**データ構造:**
- ブロックデータ: `Uint8Array` (16×64×16 = 16,384 bytes/chunk)
- インデックス計算: `y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x`
- チャンクキー: `"cx,cz"` 文字列で Map に格納

**メッシュ構築フロー:**
1. 全ブロックを走査
2. 各非AIRブロックの6面について隣接ブロックをチェック
3. 隣接が透明/AIR の場合のみ面を追加（face culling）
4. 各頂点に AO (Ambient Occlusion) 値を計算
5. AO に基づく quad フリップ（異方性対策）
6. 固体ブロックと水ブロックを別メッシュに分離
7. 1フレームあたり最大6チャンクを再構築（距離順にソート）

**AO (アンビエントオクルージョン) 計算:**
```
各頂点について、面法線方向の隣接3ブロック(side1, side2, corner)を調査:
- 2つのsideが両方ソリッド → AO = 0 (最暗: 0.4)
- それ以外 → AO = 3 - (side1 + side2 + corner)
- AO曲線: [0.4, 0.65, 0.85, 1.0]
```

**水の描画:**
- 別マテリアル（transparent: true, opacity: 0.65, DoubleSide）
- 水面の上面 Y 座標を 0.85 に下げて凹みを表現

### 2. 地形生成 (`world.ts`)

**ノイズ関数 (6個):**

| ノイズ | シード | 用途 |
|--------|-------|------|
| `noise` | 42 | 地形の高さ |
| `treeNoise` | 123 | 木の配置 |
| `caveNoise` | 777 | 洞窟(チャンネル1) |
| `caveNoise2` | 888 | 洞窟(チャンネル2) |
| `oreNoise` | 555 | 鉱石分布 |
| `biomeNoise` | 999 | バイオーム |

**高さ計算:**
```typescript
base = fbm(wx * 0.008, wz * 0.008, octaves=5)
detail = fbm(wx * 0.03, wz * 0.03, octaves=3) * 0.3
height = floor(25 + (base + detail) * 15)
// 結果: 約 10 ~ 40 の範囲
```

**バイオーム判定:**
```
biomeNoise(wx * 0.004, wz * 0.004) の値:
  < -0.3  → desert  (砂漠)
  > 0.4   → snow    (雪原)
  > 0.05  → forest  (森林)
  else    → plains  (平原)
```

**洞窟生成:**
```
2つの3Dノイズを使用:
  |caveNoise(wx*0.04, y*0.06, wz*0.04)| < 0.08
  |caveNoise2(wx*0.06, y*0.09, wz*0.06)| < 0.06
いずれかが真ならその位置を空洞にする（y>1 かつ y<height-1 の場合のみ）
```

**鉱石分布:**
```
oreNoise(wx*0.12, y*0.12, wz*0.12) の値:
  y < 16 かつ > 0.65  → ダイヤモンド
  y < 40 かつ > 0.55  → 鉄
  > 0.5               → 石炭
```

**木の生成:**
- チャンク辺境 2ブロックを避けて生成（隣接チャンクへの越境防止）
- バイオームごとに密度が異なる（forest: 0.2, plains: 0.35, snow: 0.4, desert: 生成なし）
- 木の高さ: 4〜7 ブロック
- 葉の範囲: trunk 上部 ±2（半径2, 上部は半径1）

### 3. プレイヤー物理 (`player.ts`)

**速度定数:**
| 状態 | 速度 |
|------|------|
| 歩行 | 4.5 |
| ダッシュ (Shift) | 7 |
| 水泳 | 3 |
| ジャンプ | 7.5 |
| 重力 | 20 |
| 水中重力 | 5 |

**当たり判定:**
- AABB (Axis-Aligned Bounding Box)
- 幅: 0.3 × 2 = 0.6, 高さ: 1.7
- 軸ごとに独立して移動→衝突判定→巻き戻し
- 水ブロックとAIRは通過可能

**水中物理:**
- 重力が 20 → 5 に減少
- 速度に 0.9 の減衰（ドラッグ）
- Space で上昇（速度 3.5）

### 4. テクスチャシステム (`textures.ts`)

**テクスチャアトラス:**
- サイズ: 64×80 ピクセル (4列 × 5行, 各16×16)
- Canvas 2D で動的生成（画像ファイル不要）
- `NearestFilter` でピクセルアート風に表示
- ミップマップなし

**テクスチャ配置 (index → 内容):**
```
 0: grass_top    1: grass_side   2: dirt         3: stone
 4: sand         5: wood_top     6: wood_side    7: leaves
 8: water        9: bedrock     10: cobblestone  11: planks
12: snow        13: coal_ore    14: iron_ore     15: diamond
16: glass
```

**UV 計算:**
```typescript
u0 = col / ATLAS_COLS
v0 = 1 - (row + 1) / ATLAS_ROWS
u1 = (col + 1) / ATLAS_COLS
v1 = 1 - row / ATLAS_ROWS
```

### 5. 昼夜サイクル (`engine.ts`)

**時刻システム:**
- `dayTime`: 0.0 〜 1.0 の周期（0=真夜中, 0.25=夜明け, 0.5=正午, 0.75=夕暮れ）
- 進行速度: `dt * 0.008` (約125秒で1周期)

**ライティング変化:**
```
sunAngle = dayTime * 2π - π/2
sunHeight = sin(sunAngle)
dayFactor = clamp(sunHeight * 2.5 + 0.5, 0, 1)

AmbientLight:  0.15 + dayFactor * 0.5
DirectionalLight: dayFactor * 0.85
Sky color: lerp(NIGHT_COLOR, DAY_COLOR, dayFactor) + dawn/dusk blend
```

### 6. レイキャスト (`world.ts`)

- **アルゴリズム**: DDA (Digital Differential Analyzer)
- **最大距離**: 8 ブロック
- **戻り値**: `{ pos: [x,y,z], normal: [nx,ny,nz], block: BlockType }`
- 水とAIRは透過（その先のブロックを検出）

---

## ブロック一覧

| ID | 名前 | 透明 | 液体 | テクスチャ(top/side/bottom) |
|----|------|------|------|---------------------------|
| 0 | AIR | - | - | なし |
| 1 | Grass | No | No | 0 / 1 / 2 |
| 2 | Dirt | No | No | 2 / 2 / 2 |
| 3 | Stone | No | No | 3 / 3 / 3 |
| 4 | Sand | No | No | 4 / 4 / 4 |
| 5 | Wood | No | No | 5 / 6 / 5 |
| 6 | Leaves | Yes | No | 7 / 7 / 7 |
| 7 | Water | Yes | Yes | 8 / 8 / 8 |
| 8 | Bedrock | No | No | 9 / 9 / 9 |
| 9 | Cobblestone | No | No | 10 / 10 / 10 |
| 10 | Planks | No | No | 11 / 11 / 11 |
| 11 | Snow | No | No | 12 / 12 / 12 |
| 12 | Coal Ore | No | No | 13 / 13 / 13 |
| 13 | Iron Ore | No | No | 14 / 14 / 14 |
| 14 | Diamond Ore | No | No | 15 / 15 / 15 |
| 15 | Glass | Yes | No | 16 / 16 / 16 |

---

## 操作方法

| 操作 | キー/入力 |
|------|----------|
| 移動 | WASD / 矢印キー |
| ジャンプ | Space |
| ダッシュ | Shift (地上のみ) |
| 水泳上昇 | Space (水中) |
| 視点操作 | マウス移動 (PointerLock 中) |
| ブロック破壊 | 左クリック |
| ブロック設置 | 右クリック |
| ブロック選択 | 1-9 キー / マウスホイール |
| インベントリ | E キー |
| マウス解放 | ESC |

---

## ビルド & デプロイ

```bash
# 開発サーバー
npm run dev

# 本番ビルド（dist/ に出力）
npm run build

# デプロイ（GitHub Pages）
# main ブランチへ push すると .github/workflows/deploy.yml が自動実行
git push origin main
```

**Vite 設定:**
- `base: '/mykura/'` (GitHub Pages 用サブパス)

---

## 既知の制限事項

1. **チャンク境界の木**: 辺境2ブロックを避けて生成するため、チャンク境界をまたぐ大木は生成されない
2. **ブロック設置時の衝突**: プレイヤーの足と頭の位置のみチェック。幅は考慮していない
3. **水の描画順**: 半透明水メッシュの描画順が最適化されていない（稀に描画アーティファクトあり）
4. **チャンク生成**: 1フレーム6チャンク制限のため、高速移動時にポップインが発生する
5. **セーブ機能なし**: ワールドはメモリ上のみ。リロードで消失する
6. **シングルプレイのみ**: マルチプレイヤー非対応
