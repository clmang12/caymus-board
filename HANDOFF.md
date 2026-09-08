# HANDOFF — CAYMUS Board

Session state as of 2026-09-07 (session 2). Read this first when resuming in a
new Claude Code / Claude for VS Code window. Companion docs: `README.md`
(overview), `PORTING.md` (remaining UI work, numbered), `DEPLOY.md` (Vercel),
`SMTP-SETUP.md` (email), `design-reference/README.md` (design spec + tokens).

---

## TL;DR

- Migrating a Claude Design prototype into a real app: **Next.js 14 (App Router) +
  Supabase**, deployed on **Vercel**.
- **Live:** https://caymus-board.vercel.app — auto-deploys from `main` on every push.
- Repo: https://github.com/clmang12/caymus-board (private). Branch `main`.
  As of this handoff: through `39b4916` (+ this doc commit), pushed, tree clean,
  prod deploy green. `git log --oneline -5` for the real HEAD.
- **PORTING items 1 (board grid), 2 (inline editing), 3 (subitem CRUD), and 4
  (sidebar board CRUD + row drag) are DONE and deployed.** Board UI in
  `components/board/`; sidebar is `components/Sidebar.jsx`. Items 5–9 remain.
- Auth works end to end **except email delivery** (Supabase built-in SMTP is
  rate-limited; custom SMTP not set up — see "Signing in" below for the bypass).

### This session (2026-09-07, session 2)
- Shipped PORTING item 3 (subitem CRUD) — `1663a35`, deployed.
- Fixed a transparent-popover bug — every `Popover` (Agent/Status/Lender cell
  menus + the new condition-status menu) rendered with no background because the
  design tokens were scoped to `.board-root` and `Popover` portals into
  `document.body`. Moved tokens to `:root`, added `.pop` fallbacks — `930c64c`.
- Shipped PORTING item 4 (sidebar board CRUD + drag rows between groups) —
  `82b765c`, deployed.
- Added headless dev scripts `scripts/_ui-test-item3.mjs`, `_ui-popover-shot.mjs`,
  `_verify-boards.mjs`, `_ui-test-item4.mjs` (all gitignored).

---

## Accounts / infra

| Thing | Value |
|---|---|
| Supabase project ref | `zefanugmidaghugfgsfj` (region `us-east-1`) |
| Supabase URL | `https://zefanugmidaghugfgsfj.supabase.co` |
| Vercel project | `caymus-board` (`prj_3spg8UyyKZ9i88hKIueop5VsdRXE`) |
| GitHub repo | `clmang12/caymus-board` |
| Git identity (repo-local) | `Leynard Ang <clmang@gmail.com>` |

Secrets live in `.env.local` (gitignored, already on this machine):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `DATABASE_URL` (Postgres
**session-pooler** URI — the direct `db.<ref>` host does NOT resolve from here,
must use `aws-0-us-east-1.pooler.supabase.com:5432`).

Vercel env vars (Production + Preview + Development): the four above **only**.
Do **not** add `NEXT_PUBLIC_SITE_URL` (breaks prod magic-link redirect — the
login page falls back to `window.location.origin`) or `DATABASE_URL`.

---

## Run it locally

```bash
npm install          # if node_modules is missing
npm run dev          # http://localhost:3000
```

`npm run build` passes clean. `/api/health` reports which env vars a deployment
received (presence only) — use it to debug Vercel config.

---

## Signing in (during evaluation)

Email delivery is not set up, so the normal "enter email → click link" flow
can't send. Two ways in:

**1. Out-of-band magic link.** Generate one with the service-role key, follow the
Supabase verify redirect manually, and hand the token hash straight to
`/auth/callback` (which now handles both `?code=` PKCE and `#access_token`
implicit flows):

```bash
node --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env={};for(const l of readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2];}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data}=await admin.auth.admin.generateLink({type:"magiclink",email:"clmang@gmail.com",options:{redirectTo:"https://caymus-board.vercel.app/auth/callback"}});
const r=await fetch(data.properties.action_link,{redirect:"manual"});
const p=new URLSearchParams((r.headers.get("location")||"").split("#")[1]);
console.log("https://caymus-board.vercel.app/auth/callback#access_token="+p.get("access_token")+"&refresh_token="+p.get("refresh_token")+"&expires_in=3600&token_type=bearer&type=magiclink");
'
```

The access token in the URL is valid ~1h; once the browser has the session it
persists indefinitely (Supabase default: no refresh-token expiry). So it's a
one-time login per browser.

**2. `scripts/_mint-session.mjs`** (gitignored local helper) mints a session
cookie for headless/automated testing. `DEV_EMAIL=clmang@gmail.com node
scripts/_mint-session.mjs` prints the exact `sb-<ref>-auth-token` cookie value.

A Supabase auth user for `clmang@gmail.com` already exists (created during
setup; role `member`).

**To fix email properly:** follow `SMTP-SETUP.md`. Blocked on: Caymus has no DNS
admin access to `caymusmortgage.ca`, so a sending domain must be arranged
(register a dedicated domain, or get the DNS admin to add Resend's records).

---

## What's built

### Infrastructure (done, in prior commits)
- `supabase/schema.sql` applied — 13 tables, RLS, realtime, triggers.
  **RLS is wide open**: `team_all` policy = any authenticated user reads/writes
  everything. `profiles.role` (owner/member/viewer) is stored but NOT enforced.
- Seed loaded: 9 groups, 46 deals, 599 subitems (`npm run seed` from
  `design-reference/caymus-data.js` — real monday.com board data).
- `attachments` storage bucket (private) created.
- Shared data layer `lib/data/*` (platform-neutral, mobile reuses it).
- Auth: magic-link, `middleware.js` gates routes (hardened to not 500 on missing
  env / auth failure; `/api/*` excluded from the gate, they self-enforce).
- `/api/claude` — AI endpoint, key server-side. NOTE: the `ANTHROPIC_API_KEY` in
  `.env.local` / Vercel is currently **rejected by Anthropic as invalid** —
  regenerate at console.anthropic.com. Only affects PORTING item 6.
- `/api/health` — env diagnostic.

### PORTING item 1 + 2 — board grid + inline editing (commit `89c339c`)
`components/board/`:
- `columns.js` — 14-column model (from `design-reference/README.md`), formatters,
  prefs resolution. Column widths/order persist per-user in `user_prefs`, keyed
  by column key.
- `board.css` — design tokens (light theme only). Tokens are on `:root` (see
  Gotchas) — everything else keys off them.
- `Popover.jsx` — portal-based (into `document.body`), escapes grid overflow,
  closes on outside click / Esc / scroll.
- `Cell.jsx` — one renderer/editor per type: text, currency, date, label
  (colour-swatch popover), dropdown, multi-select (lender).
- `ItemRow.jsx` — sticky Deal/Client column, 13 cells, expand → `SubitemPanel`
  (editable, see item 3 below) + progress bar.
- `GroupSection.jsx` — collapsible group card, header row with drag-resize /
  drag-reorder / click-sort, "+ Add deal", volume SUM row, row drop targets.
- `BoardGrid.jsx` — toolbar (search, collapse-all), realtime merge for
  items/subitems/groups, optimistic commits, prefs persistence (debounced),
  `moveRow` (drag rows between/within groups → `setItemPositions`).
- `app/board/[boardId]/page.js` loads `user_prefs`; `BoardShell.jsx` is now a
  thin sidebar+grid layout.

Verified (headless Chrome + CDP, against live DB): inline text/label/date edits
persist and survive reload; column resize + collapse persist to `user_prefs`;
search filters across groups; realtime push updates the open grid; no runtime
exceptions.

### PORTING item 3 — subitem CRUD (commits `1663a35`, `930c64c`)
- `components/board/SubitemPanel.jsx` (new) — replaces the read-only condition
  panel in `ItemRow.jsx`. Editable rows: name (blur), status (colour-swatch
  popover, `cond` field options), due date, details (blur), delete (✕).
  "+ Add condition" input; empty-state buttons apply the Purch / Refi checklist.
- `lib/data/subitems.js` — `applyTemplate` now scopes to `board_id` and is
  idempotent (skips conditions the item already has, appends after existing).
  Added `listTemplateDeals`.
- `BoardGrid.jsx` — optimistic `createSubitem` / `commitSubitem` / `removeSubitem`
  / `applyChecklist`, reconciled by the existing `subitems` realtime handler;
  threaded through `GroupSection` → `ItemRow`.
- `board.css` — 5-col subitem grid (added a delete column) + `.sub-*` input styles.
- Verified (headless Chrome + CDP, live DB, `scripts/_ui-test-item3.mjs`):
  add / status-change / details-edit / delete all persist; new row appears in
  the open grid; popover renders opaque; no console errors. `scripts/_verify.mjs`
  covers the data layer (16 checks).

### PORTING item 4 — sidebar board CRUD + row drag (commit `82b765c`)
- `components/Sidebar.jsx` — was a stub, now a client component. "+ New board"
  (creates a board that copies the current board's groups + field_options +
  checklist templates — no deals — navigates, opens inline rename via a
  `sessionStorage` intent that survives the nav). Per-board ⋯ menu: Rename
  (inline `<input>`), Duplicate, Delete (`window.confirm`, soft-delete). Drag a
  row to reorder — persists globally via `reorderBoards`. Optimistic local list
  + `router.refresh()` (boards table is **not** in the realtime publication, so
  no cross-session push — a later nicety).
- `lib/data/boards.js` — `createBoard({ name, fromBoardId })` (copies group
  structure + options + templates, no deals), `duplicateBoard` (deep copy, client-gen
  UUIDs so parent refs remap with no round trips; sits right after the original),
  `deleteBoard` (tree → `trash`, refuses last board), `setItemPositions`.
  `reorderBoards` rewritten as sequential `UPDATE`s (upsert took the INSERT path
  → NOT NULL `name`).
- Board grid: `.row-drag` handle in the sticky name cell (hover to reveal); drop
  on a row inserts before it, drop on a group body appends. `BoardGrid.moveRow`
  updates the tree and renumbers the target group; the existing `items` realtime
  handler already reconciles `group_id` changes.
- Verified: `scripts/_verify-boards.mjs` (12 data-layer checks, self-cleaning),
  `scripts/_ui-test-item4.mjs` (headless: create/rename/duplicate/delete +
  synthetic row-drop; restores the live seed board after).

---

## What's NOT done (next work)

From `PORTING.md`, remaining order **7 → 5 → 6 → 8 → 9**:

| # | Item | Notes |
|---|---|---|
| 5 | Server-side notifications | Prototype computes them client-side each load. Replace with a Supabase `pg_cron` daily job that inserts into `notifications`; `lib/data/notifications.js` already reads / marks read / clears. |
| 6 | AI assistant drawer | Route `POST /api/claude` is done (key server-side). **Blocked:** `ANTHROPIC_API_KEY` is rejected as invalid — regenerate before building this. Prototype's drawer + `actions` JSON protocol is in `design-reference/CAYMUS 25 Board.dc.html` (~line 1280). |
| 7 | File attachments | `lib/data/attachments.js` + the private `attachments` bucket are both ready; no UI. Signed URLs for download. `attachments` rows can hang off an item or a subitem. |
| 8 | Mobile card view <768px | Build `components/board/BoardCards.jsx` — one card per deal, tap → detail sheet. Do **not** make the 14-col grid responsive. |
| 9 | Automations | Postgres triggers / scheduled fns; `automations` table stores which are enabled per board. e.g. prototype's "stamp condition date when its status changes". |

Also not started: dark theme (prototype has the dark token set; `board.css` is
light-only, tokens now on `:root` so a `@media (prefers-color-scheme)` / toggle
override is straightforward), filter menu, undo, trash/restore view.

Do **not** copy `design-reference/CAYMUS 25 Board.dc.html` into the app — it's a
reference. Match its tokens/behaviour with React.

---

## Gotchas / decisions

- **DB connection**: direct host unreachable → `DATABASE_URL` uses the session
  pooler. `scripts/apply-schema.mjs` (`npm run db:schema`) uses it.
- **Vercel env**: only the 4 keys; `NEXT_PUBLIC_SITE_URL` and `DATABASE_URL`
  were removed because they broke things.
- **npm audit**: 5 high advisories against Next 14.2.x whose only fix is Next 16
  (major). Deferred — low real risk on Vercel with no custom server.
- **Design tokens live on `:root`** in `board.css` (not `.board-root`) — the
  `Popover` portals into `document.body`, so scoping `--s1` etc. to `.board-root`
  made every popover render transparent. `.pop` also has literal fallbacks.
- **Boards realtime**: `boards` is NOT in `supabase_realtime` (only items /
  subitems / groups / updates are). Sidebar board changes don't push to other
  sessions — fine for now; add the table + a `subscribeToBoards` if needed.
- **Local dev helper scripts** `scripts/_*.mjs` are gitignored (contain admin
  logic): `_mint-session`, `_verify` (data-layer suite — `node scripts/_verify.mjs`,
  16 checks, self-cleaning), `_verify-boards` (item-4 data layer, 12 checks),
  `_verify-realtime`, `_vercel-setup`, `_vercel-fix`, `_ui-test-item3`,
  `_ui-test-item4`, `_ui-popover-shot` (headless CDP checks).
- **Vercel API access**: the user supplied a temporary `VERCEL_TOKEN` once (used
  to set env vars + redeploy), then removed it. Not available now — ask if you
  need to touch Vercel programmatically; otherwise a `git push` auto-deploys.
- **Supabase URL Configuration**: Site URL + Redirect URLs
  (`https://caymus-board.vercel.app/**`) ARE set. Email delivery is the only
  remaining auth gap.
- **Testing UI without a browser**: pattern used this session = launch
  `Google Chrome --headless --remote-debugging-port`, drive via CDP over the
  native `WebSocket`, set the auth cookie from `_mint-session.mjs`, screenshot.

---

## Attribution for commits/PRs

End commit messages with:

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ny9VCdJmJj1qubanHkJinD
```

End PR descriptions with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
