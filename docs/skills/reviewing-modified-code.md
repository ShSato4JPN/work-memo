# reviewing-modified-code

## 概要

修正したコードを、このプロジェクト独自の観点でレビューするためのスキル。
汎用のコードレビュー（`/code-review` など）はバグの正しさを見るが、
このスキルは「このリポジトリで既に決まっている流儀」に沿っているかを見る。

## いつ使われるか

コードを修正した直後、完了とみなす前。`git diff` や変更したファイルを
対象にチェックリストを当てる。

## 使い方

以下の観点で変更点を確認する。

| 観点 | 何を見るか | 直し方 |
|---|---|---|
| マジックナンバー | `44` や `1440` のような意味の説明がない数値・文字列 | 使う場所の近くに名前付き定数を切り出す（`day-timeline.tsx` の `TICK_MINUTES` / `LABEL_SHOW_WIDTH` が例） |
| 消し忘れたデバッグコード | `console.log`、コメントアウトされたコード、一時変数 | 削除する。`.oxlintrc.json` では `no-console` が warning 止まりなので `pnpm lint` は失敗しない。人間・エージェントの目で見るしかない |
| コンポーネント内に定義された純粋な関数 | props/state を一切使わない関数がコンポーネントの中にある | コンポーネントの外、他の定数（`TICKS` など）と同じ場所に出す |
| 依存値のない `useCallback` | `useCallback(fn, [])` で `fn` が props/state を使っていない | `fn` を外に出す。`useCallback` は依存値が無くても毎レンダー比較処理が走り、依存値があるときだけ意味がある |
| コメントが「何をしているか」の説明になっている | 次の行の内容をそのまま日本語にしただけのコメント | 「なぜそうしているか」（制約・バグの回避・非自明な前提）だけ残す。`src/lib/timeline.ts` の既存コメントが手本 |
| 比較の左右が不自然 | `THRESHOLD < value` | `value > THRESHOLD` にする（主語を左に置く） |
| フォーマッタの整形に紛れた実質変更 | import順序や改行位置の変更に、ロジックの変更が混ざっている | 整形自体は `pnpm format:check` が求めるなら問題ないが、中に無関係な実質変更が隠れていないか確認する |
| 完了とする前 | — | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` / `pnpm test` を実行する |

## よくある見落とし

- `pnpm lint` が通ったことを「デバッグコードが残っていない証拠」と誤解する
  （`no-console` は warning であり、`console.log` が残っていても lint は失敗しない）
- フォーマッタによる整形だと思って、中に紛れた無関係な実質変更を見逃す

## 関連

- スキル本体: [`.claude/skills/reviewing-modified-code/SKILL.md`](../../.claude/skills/reviewing-modified-code/SKILL.md)
