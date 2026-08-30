# 作業時間トラッカー 設計書

作成日: 2026-08-29

## 1. 目的

日々の作業（開発・調査・レビュー・会議など）に何時間かけているかを記録し、
後から振り返って自分のボトルネックを見つける。

検証したい仮説:

1. 調査・理解に時間を食われすぎているのではないか
2. 割り込みが多く、まとまった作業時間が取れていないのではないか
3. 見積もりと実績が乖離しているのではないか
4. そもそも1日の時間の使い方の実態が分かっていない

## 2. スコープ

### 作るもの

- リアルタイムのタイマーによる作業時間の記録
- タスク管理（一覧・進捗・見積もり）
- 日 / 週 / 月単位の集計とグラフ表示

### 作らないもの

認証、複数ユーザー、クラウド同期、外部連携（Git・カレンダー）、通知。

まず自分のデータが2週間貯まり、そこから何か見えるかを確認することを優先する。

## 3. データモデル

### ER 概要

```
categories ──< tasks ──< entries
                            └─ parent_entry_id (自己参照 = 割り込み元)
```

### DDL (SQLite)

```sql
-- カテゴリマスタ
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,       -- 開発 / 調査 / レビュー / 会議 / その他
  color       TEXT    NOT NULL,              -- グラフ色の固定 (#RRGGBB)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,    -- 隠すだけ。過去集計は保持
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- タスク
CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL UNIQUE,     -- 表記ゆれ防止
  category_id   INTEGER NOT NULL REFERENCES categories(id),
  estimate_min  INTEGER,                     -- NULL 可
  status        TEXT    NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo','doing','done')),
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

-- 作業ログ（計測の実体）
CREATE TABLE entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id         INTEGER NOT NULL REFERENCES tasks(id),
  started_at      TEXT    NOT NULL,
  ended_at        TEXT,                      -- NULL = 計測中
  parent_entry_id INTEGER REFERENCES entries(id),  -- NULL 以外 = 割り込み
  note            TEXT,
  CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- 計測中は全体で1件だけ、を DB レベルで保証
CREATE UNIQUE INDEX idx_entries_single_running
  ON entries ((1)) WHERE ended_at IS NULL;

CREATE INDEX idx_entries_started_at  ON entries(started_at);
CREATE INDEX idx_entries_task_id     ON entries(task_id);
CREATE INDEX idx_tasks_category_id   ON tasks(category_id);
```

### 設計判断とその理由

- **タスクとカテゴリをマスタ化する**: タイトルを毎回手入力すると表記ゆれで集計が壊れる。
  ID で紐づけることで改名しても過去データが壊れない。
  Start 時の入力も「タスクを選ぶだけ」になり、継続しやすくなる。
- **カテゴリは tasks 側に持つ**: 入力を最小にすることを優先した。
  1タスク内の調査/実装の内訳が必要な場合は「認証機能：調査」「認証機能：実装」のように
  タスクを分けて作ることで同じ解像度を得る。
- **duration カラムを持たない**: `ended_at - started_at` で常に導出する。
  時刻を手修正したときに整合性が崩れるのを避けるため。
- **`tasks.status` と「計測中」は別物**: `doing` は進行中として扱っているフラグ。
  計測中かどうかの真実は `entries.ended_at IS NULL` のみ。
- **部分ユニークインデックス**: アプリのバグやタブの二重起動で計測が二重に走る事故を DB で防ぐ。

### 仮説の検証方法

| 知りたいこと | 出し方                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| 時間配分     | `tasks.category_id` 別の合計時間                                        |
| 見積もりズレ | `tasks.estimate_min` と task 単位の実績合計の比                         |
| 割り込み     | `parent_entry_id` が非 NULL のレコード数、1エントリあたりの平均継続時間 |
| 実態         | 日 / 週 / 月のタイムラインと積み上げグラフ                              |

## 4. 画面と操作フロー

画面は3つ。

### ① 今日の画面（トップ）

- 上部: 計測中のタスク名・カテゴリ・経過時間、Stop ボタン
- Start パネル: タスクを検索・選択（`doing` を上位表示）して Start。
  新規タスクはその場で「タイトル + カテゴリ + 見積もり」を入力して作成しつつ Start
- 計測中に Start を押すと、前のエントリが自動で Stop され、
  新エントリの `parent_entry_id` に前のエントリ ID が入る（= 割り込み）
- 今日のログ一覧（時系列）。各行に「再開」ボタン。時刻の手修正も可能
- 今日の合計とカテゴリ内訳バー

### ② タスク一覧

- `todo` / `doing` / `done` でフィルタ
- 各行: タイトル、カテゴリ、見積もり、実績合計、差分、最終作業日、Start ボタン

### ③ 分析

- 期間切り替え: 日 / 週 / 月
- カテゴリ別の時間配分（円 or 積み上げ棒）と数値テーブル
- 期間内トレンド（日ごとの積み上げ棒）
- 割り込み指標: 割り込み回数、1エントリあたりの平均継続時間
- 見積もり精度: 見積もり比の分布

### Stop 忘れ対策

実運用で最大のリスクなので必須とする。

- タブのタイトルに経過時間を表示する
- 一定時間（初期値 2 時間）を超えたら画面上に警告を表示する
- 起動時に `ended_at` が NULL のまま放置されたエントリがあれば終了時刻を確認する

## 5. 技術スタック

| 領域           | 選定                               | 理由                                                                              |
| -------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| フレームワーク | Next.js (App Router) + TypeScript  | 1プロセスで画面も更新処理も完結する                                               |
| DB             | SQLite + Prisma                    | ファイル1つで完結。マイグレーションが型安全。Prisma Studio で中身を直接確認できる |
| データ取得     | Server Components + Server Actions | 一覧・集計はサーバ側で行い、REST API は別途作らない                               |
| UI             | shadcn/ui + Tailwind CSS           | 生成したコンポーネントをプロジェクト内に持つ                                      |
| グラフ         | shadcn/ui chart (Recharts)         | 色をテーマ変数で一元管理でき、`categories.color` と噛み合う                       |
| Lint / Format  | oxlint / oxfmt                     | ESLint・Prettier は導入しない（`create-next-app --no-eslint`）                    |
| テスト         | Vitest                             |                                                                                   |

### 実装方針

- React / Next.js のベストプラクティスに沿う。
  デフォルトは Server Component とし、`use client` は経過時間のカウントアップなど
  クライアント状態が本当に必要な箇所に限定する。
- 更新は Server Actions で行い、完了後に `revalidatePath` でキャッシュを更新する。
- **時刻の真実は DB の `started_at` のみ**。画面はそこからの差分を描画するだけにする。
  これによりリロードしても経過時間がズレない。

### ディレクトリ構成

```
src/
  app/                画面 (today / tasks / analytics)
  components/
    ui/               shadcn/ui の生成物
  server/
    actions/          startTimer, stopTimer, switchTask, createTask ...
    queries/          日次・週次・月次の集計クエリ
  lib/
    aggregate.ts      純粋関数。entries[] を受けて集計値を返す
```

`lib/aggregate.ts` を DB に触らない純粋関数として切り出すことが要点。
日跨ぎ、計測中エントリの扱い、割り込みの数え方が最もバグりやすく、
同時に最もテストしやすい部分であるため。

## 6. テスト方針

ロジックの核だけを厚くテストする。UI のテストは書かない。

### 集計関数のユニットテスト (`lib/aggregate.ts`)

- 日を跨いだエントリ（23:30〜翌 0:30）が日次集計でどう分割されるか
- `ended_at` が NULL の計測中エントリを「現在時刻まで」として含める
- 割り込み回数のカウント（`parent_entry_id` を持つ件数）
- 見積もり比の計算（`estimate_min` が NULL のタスクは対象外にする）

### タイマー操作のテスト（Server Actions、テスト用 SQLite に対して）

- 計測中に Start すると前のエントリが自動 Stop され `parent_entry_id` が入る
- 二重 Start で部分ユニークインデックスが効き、計測中が2件にならない
- Stop 忘れの復旧（`ended_at` を後から埋める）で整合性が保たれる
