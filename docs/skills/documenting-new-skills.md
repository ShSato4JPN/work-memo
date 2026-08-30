# documenting-new-skills

## 概要

`.claude/skills/` にスキルを作成・編集したとき、その内容を人が読める
Markdown として `docs/skills/` にも書き出すためのスキル。Obsidian で
スキルの一覧や中身を見られるようにするのが目的。

## いつ使われるか

- `.claude/skills/<name>/SKILL.md` を新しく作ったとき
- 既存のスキルの挙動・名前・発動条件を変えて、要約が古くなったとき

## 使い方

新しいスキルを作った直後、または既存スキルを大きく変えた直後に、
このスキルが `docs/skills/<スキル名>.md` を用意する（無ければ作成、
あれば更新）。SKILL.md の `description`（発動条件だけを書いた素っ気ない
一文）をそのまま転記するのではなく、人向けに「何をするか」「いつ動くか」
「どう使うか」を書き直す。

## 関連

- スキル本体: [`.claude/skills/documenting-new-skills/SKILL.md`](../../.claude/skills/documenting-new-skills/SKILL.md)
