# Mobile-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app comfortable on a 375px mobile screen without changing the desktop experience, and align all touched components to mobile-first Tailwind class ordering.

**Architecture:** Pure Tailwind class edits across 5 files — no new components, no logic changes, no API changes. Each task is a single file. Verification after each task is a TypeScript check + existing test run to catch regressions.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4 (CSS-first, arbitrary-property syntax `[property:value]`), TypeScript strict

---

## File Map

| File | What changes |
|---|---|
| `components/TickerPill.tsx` | `shrink-0` on pill span; `p-1 -mr-1` on `×` button |
| `components/AddTickerForm.tsx` | Input: `flex-1` base, `sm:w-36` override |
| `components/WatchlistBar.tsx` | Horizontal scroll + hidden scrollbar on mobile; `sm:flex-wrap` on desktop |
| `components/TopBar.tsx` | Stack vertically on mobile (`flex-col`); row on `sm:` |
| `app/page.tsx` | Main padding: `px-4 sm:px-6` |

---

## Task 1: TickerPill — shrink-0 + larger tap target

**Files:**
- Modify: `components/TickerPill.tsx`

These two changes are coupled: `shrink-0` prevents the pill from compressing inside the horizontal-scroll WatchlistBar; the button padding enlarges the touch target for the `×`.

- [ ] **Step 1: Edit TickerPill.tsx**

Replace the entire file content with:

```tsx
'use client';

interface Props {
  ticker: string;
  onRemove: (ticker: string) => void;
}

export function TickerPill({ ticker, onRemove }: Props) {
  return (
    <span className="flex shrink-0 items-center gap-1 bg-[#1a1a1a] border border-[#1f1f1f] text-white text-sm rounded-full px-3 py-1">
      {ticker}
      <button
        onClick={() => onRemove(ticker)}
        className="ml-1 -mr-1 p-1 text-gray-500 hover:text-[#ef4444] leading-none transition-colors"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/TickerPill.tsx
git commit -m "feat: shrink-0 on pill, larger tap target on remove button"
```

---

## Task 2: AddTickerForm — full-width input on mobile

**Files:**
- Modify: `components/AddTickerForm.tsx`

On mobile the input should stretch to fill the remaining width (`flex-1`). On `sm+` it reverts to the fixed `w-36`. The form is already `flex gap-2` so `flex-1` on the input is all that's needed.

- [ ] **Step 1: Edit AddTickerForm.tsx**

Replace the entire file content with:

```tsx
'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onAdd: (ticker: string) => void;
}

export function AddTickerForm({ onAdd }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (ticker) {
      onAdd(ticker);
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add ticker…"
        maxLength={10}
        className="flex-1 sm:flex-none sm:w-36 bg-[#1a1a1a] border border-[#1f1f1f] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8FF00]"
        suppressHydrationWarning
      />
      <button
        type="submit"
        className="bg-[#C8FF00] text-black text-sm font-semibold px-3 py-1.5 rounded hover:brightness-90 transition-all"
        suppressHydrationWarning
      >
        Add
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AddTickerForm.tsx
git commit -m "feat: full-width ticker input on mobile"
```

---

## Task 3: WatchlistBar — horizontal scroll on mobile

**Files:**
- Modify: `components/WatchlistBar.tsx`

On mobile: single non-wrapping row with `overflow-x-auto`; scrollbar hidden via three browser-targeted arbitrary properties. On `sm+`: reintroduce `flex-wrap` so pills wrap as before. The `shrink-0` is already handled in Task 1 (on each pill).

- [ ] **Step 1: Edit WatchlistBar.tsx**

Replace the entire file content with:

```tsx
'use client';

import { TickerPill } from './TickerPill';

interface Props {
  tickers: string[];
  onRemove: (ticker: string) => void;
}

export function WatchlistBar({ tickers, onRemove }: Props) {
  if (tickers.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-2">
        No tickers yet — add one above.
      </p>
    );
  }
  return (
    <div className="flex gap-2 py-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tickers.map((t) => (
        <TickerPill key={t} ticker={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run existing tests**

```bash
npm test
```

Expected: all tests pass (no component tests for WatchlistBar exist — this confirms no regressions in hooks/lib).

- [ ] **Step 4: Commit**

```bash
git add components/WatchlistBar.tsx
git commit -m "feat: horizontal scroll watchlist on mobile"
```

---

## Task 4: TopBar — stack on mobile, row on sm+

**Files:**
- Modify: `components/TopBar.tsx`

On mobile (`< 640px`): the header is `flex-col` so the title sits above the `AddTickerForm`. On `sm+`: reverts to the current side-by-side `flex-row justify-between`. `gap-3` provides spacing between title and form on mobile; `sm:gap-0` removes it on desktop where `justify-between` handles spacing.

- [ ] **Step 1: Edit TopBar.tsx**

Replace the entire file content with:

```tsx
'use client';

import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className="flex flex-col gap-3 px-4 py-4 border-b border-[#1f1f1f] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6">
      <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
        Stock Buzz
      </h1>
      <AddTickerForm onAdd={onAdd} />
    </header>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/TopBar.tsx
git commit -m "feat: stack TopBar vertically on mobile"
```

---

## Task 5: page.tsx — responsive main padding

**Files:**
- Modify: `app/page.tsx`

Single class change: `px-6` → `px-4 sm:px-6`. Everything else in the file stays identical.

- [ ] **Step 1: Edit the main element padding in app/page.tsx**

Find this line:

```tsx
<main className='px-6 py-6 max-w-7xl mx-auto'>
```

Replace with:

```tsx
<main className='px-4 py-6 max-w-7xl mx-auto sm:px-6'>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: responsive horizontal padding on main"
```

---

## Task 6: Verify in browser

No code changes — this is a manual verification step.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open browser DevTools → toggle device toolbar to iPhone SE (375 × 667)**

Check each of the following at 375px width:

| Element | Expected behaviour |
|---|---|
| Header | "Stock Buzz" title on its own row; input + Add button on the row below, input stretches full width |
| Watchlist pills | Single row; swipe reveals pills that overflow; no scrollbar visible |
| `×` on a pill | Easy to tap — no accidental misses |
| Card grid | Single column, full width, `px-4` side padding |
| News toggle | Still visible as accent-coloured text link |

- [ ] **Step 3: Resize to 768px+ (tablet/desktop)**

| Element | Expected behaviour |
|---|---|
| Header | Title and form side-by-side, `px-6` padding |
| Watchlist | Pills wrap to multiple rows as before |
| Card grid | 2 columns at `sm`, 3 columns at `lg` |

- [ ] **Step 4: Done** — no commit needed for this task.
