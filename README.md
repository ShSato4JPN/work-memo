# 作業時間トラッカー

日々の作業をリアルタイムのタイマーで記録し、カテゴリ別・見積もり比・割り込みの観点で
振り返るためのローカル専用アプリ。設計は `docs/superpowers/specs/2026-08-29-work-time-tracker-design.md`。

## 開発の始め方

```bash
npm install
cp .env.example .env          # DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate deploy     # DB を作成（既存 DB があればそのまま）
npx prisma db seed            # カテゴリの初期データを投入
npm run dev                   # http://localhost:3000
```

`prisma/dev.db` が実データ。中身は `npx prisma studio` で直接確認・編集できる。

## その他のコマンド

```bash
npm test          # Vitest（ロジックと Server Actions。UI テストは書かない）
npm run lint      # oxlint（ESLint は使わない）
npm run format    # oxfmt（Prettier は使わない）
```

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
