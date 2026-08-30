---
name: reviewing-modified-code
description: Use when reviewing code just changed in this repository, before treating the change as finished. Covers conventions specific to this project (magic numbers, comment style, hoisting pure helpers out of components, leftover debug code) on top of general correctness.
---

# Reviewing Modified Code

## Overview

General-purpose review (e.g. `/code-review`) catches correctness bugs.
This skill checks the same diff against conventions this project has
already settled on — things a generic reviewer has no way to know.

## When to Use

After making or receiving a code change in this repo, before calling it
done. Run against `git diff` (staged and unstaged) or the specific files
that changed.

## Checklist

| Check | Look for | Fix |
|---|---|---|
| Magic numbers | Bare numbers/strings with unexplained meaning (`44`, `10`, `1440`) | Extract to a named `const` near its use — see `TICK_MINUTES` / `LABEL_SHOW_WIDTH` in `src/components/day-timeline.tsx` |
| Leftover debug code | `console.log`, commented-out code, temp variables | Delete. `no-console` is only a lint **warning** in `.oxlintrc.json` — `pnpm lint` exits 0 even with one left in, so this needs a human/agent eye |
| Pure helper defined inside a component | A function in a component body that reads no props/state | Hoist it above the component, next to the other module-level constants (like `TICKS`) |
| `useCallback` on a dependency-free function | `useCallback(fn, [])` where `fn` uses no props/state | Hoist `fn` outside the component instead. `useCallback` still re-runs a dependency check every render and only pays off when there ARE dependencies |
| Comment explains WHAT instead of WHY | A comment restating what the next line does | Keep only comments explaining WHY (a constraint, a bug workaround, a non-obvious invariant) — see `src/lib/timeline.ts` for the pattern this repo already follows |
| Comparison operand order | `THRESHOLD < value` | Prefer `value > THRESHOLD` — the subject reads first |
| Formatter-only reflow hiding a real change | Reformatted lines (import order, line wraps) mixed into a diff that also changes logic | Fine on its own if `pnpm format:check` requires it; check nothing substantive is hiding inside the reflow |
| Before calling it done | — | Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` |

## Common Mistakes

- Treating a clean `pnpm lint` as proof there's no debug code left —
  `no-console` is a warning, not an error, in this project's config.
- Approving a formatter-driven reflow without checking whether an
  unrelated real change is hiding inside it.
