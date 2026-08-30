---
name: documenting-new-skills
description: Use when creating a new skill under .claude/skills/ in this repository, or editing an existing skill's behavior, name, or description — before considering the skill finished.
---

# Documenting New Skills

## Overview

Every skill under `.claude/skills/` gets a matching Markdown page under
`docs/skills/`, written for a human reading it in Obsidian — not for an
agent deciding whether to load it. A `SKILL.md` frontmatter `description`
is deliberately terse (trigger conditions only); the docs page explains
what the skill does and how to use it, in plain language.

## When to Use

- Right after writing a new `.claude/skills/<name>/SKILL.md`
- Right after changing an existing skill's behavior, name, or trigger
  conditions enough that the old summary would go stale

## Output Location

`docs/skills/<skill-name>.md` — same `<skill-name>` as the skill's
directory name.

## Template

```markdown
# <スキル名>

## 概要

このスキルが何をするか、人が読んでわかる言葉で1〜3文。

## いつ使われるか

どんな場面・症状でこのスキルが動くか
（SKILL.md の description をもとに、人向けに書き直す）。

## 使い方

呼び出し方（例: 特定の依頼をすると自動で読み込まれる、など）と、
代表的な入出力例。

## 関連

- スキル本体: `.claude/skills/<skill-name>/SKILL.md`
```

## Common Mistakes

- Copying the frontmatter `description` verbatim — it's written for
  agent triggering (third person, "Use when…"), not for a human
  skimming Obsidian. Rewrite it in plain terms.
- Editing `SKILL.md` without updating the docs page — treat them as one
  edit, not two separate tasks.
