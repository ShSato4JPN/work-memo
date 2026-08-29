# 作業時間トラッカー

日々の作業をリアルタイムのタイマーで記録し、カテゴリ別・見積もり比・割り込みの観点で
振り返るためのローカル専用アプリ。設計は `docs/superpowers/specs/2026-08-29-work-time-tracker-design.md`。

## 開発の始め方

```bash
pnpm install                     # postinstall で prisma generate が走る
cp .env.example .env             # DATABASE_URL="file:./prisma/dev.db"
pnpm exec prisma migrate deploy  # DB を作成（既存 DB があればそのまま）
pnpm exec prisma db seed         # カテゴリの初期データを投入
pnpm dev                         # http://localhost:3000
```

`prisma/dev.db` が実データ。中身は `pnpm exec prisma studio` で直接確認・編集できる。

## コードの置き場所

```
src/app         画面（Server Component）
src/components  描画に徹する。計算も状態も持たない
src/hooks       状態と副作用（計測の時計、フォーム、Server Action の呼び出し）
src/lib         副作用のない計算。集計・レイアウト・表記はここに集める
src/server      Server Actions と DB からの読み出し
scripts         コマンドラインから使う道具（バックアップ・復元）
test            テスト。src / scripts と同じ階層構造で置く
```

テストの対象は `src/lib` の純粋関数と `src/server/actions` のふるまい。
UI のテストは書かない（見た目は変わりやすく、壊れやすいテストになるため）。

## その他のコマンド

```bash
pnpm test    # Vitest（ロジックと Server Actions。UI テストは書かない）
pnpm lint    # oxlint（ESLint は使わない）
pnpm format  # oxfmt（Prettier は使わない）
```

## バックアップと復元

記録は `prisma/dev.db` というファイル1つに入っているので、消えるときは丸ごと消える。
`backups/` に1日1ファイルの JSON を残しておく。

```bash
pnpm backup           # backups/YYYY-MM-DD.json に書き出す
pnpm restore          # backups/ の全ファイルを取り込む
pnpm restore --dry-run  # 何が追加されるかだけ見る
```

`pnpm dev` の前に `pnpm backup` が自動で走るので、アプリを使った日は勝手に控えが残る。
アプリを開かなかった日も残したい場合は `scripts/launchd/` の設定を使う。

### 設計上の約束

- **復元は足すだけで、消さない。** 既にあるカテゴリ・タスク・記録には触らないので、
  一部だけ消えた状態から実行しても、まっさらな DB に実行しても同じように使える。
  何度実行しても結果は変わらない。
- **突き合わせは自動採番の id ではなく自然キーで行う。** カテゴリは名前、タスクは
  タイトル、記録は「タスク＋開始時刻」。別々の日のファイルを続けて取り込んでも
  id が食い違わない。
- **記録が減る上書きは拒む。** データが消えたあとにバックアップが走ると、空のファイルが
  その日の控えを潰してしまう。件数が減っていると中止する（意図的なら `--force`）。

`backups/*.json` は作業内容そのものなので既定では git に含めない。
別マシンにも残したい場合は `.gitignore` の該当行を消す。

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
