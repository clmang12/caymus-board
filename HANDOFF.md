# HANDOFF — CAYMUS Board

Session state as of 2026-09-11 (session 3, continued). Read this first when
resuming in a new Claude Code / Claude for VS Code window. Companion docs:
`README.md` (overview), `PORTING.md` (all 9 items — now done, see below),
`DEPLOY.md` (Vercel), `SMTP-SETUP.md` (email), `design-reference/README.md`
(design spec + tokens).

---

## TL;DR

- Migrating a Claude Design prototype into a real app: **Next.js 14 (App Router) +
  Supabase**, deployed on **Vercel**.
- **Live:** https://caymus-board.vercel.app — auto-deploys from `main` on every push.
- Repo: https://github.com/clmang12/caymus-board (private). Branch `main`.
  As of this handoff: through `9f1efb8`, pushed, tree clean, prod deploy green.
  `git log --oneline -5` for the real HEAD.
- **All 9 PORTING.md items are DONE and deployed**: board grid, inline
  editing, subitem CRUD, sidebar board CRUD + row drag, notifications,
  AI assistant drawer, file attachments, mobile card view, automations.
  Board UI in `components/board/`; sidebar is `components/Sidebar.jsx`.
- Auth works end to end **except email delivery** (Supabase built-in SMTP is
  rate-limited; custom SMTP not set up — see "Signing in" below for the bypass).
- **One open blocker**: `ANTHROPIC_API_KEY` (.env.local + Vercel) is rejected
  by Anthropic as invalid — the AI drawer (item 6) is fully built and wired
  but can't complete a real request until it's regenerated at
  console.anthropic.com. Everything short of that boundary is verified (see
  below).
- Not started, and intentionally outside the 9-item PORTING.md scope: dark
  theme, a filter menu, undo, and a trash/restore view (soft-deleted boards
  land in the `trash` table with no UI to browse or restore them).

### This session (2026-09-11, session 3 continued) — items 5, 9, 8, 6
Picked in that order: 5 and 9 are both server-side Postgres work (natural to
do together), 8 is self-contained frontend, 6 was saved for last since it's
blocked on an external dependency (the API key) I can't resolve myself.

**Item 9 (automations) + item 5 (notifications)** — commit `a935aa8`.
`supabase/schema.sql` gained: `automation_enabled(board_id, key)` (a missing
row defaults to **enabled**, matching the prototype where everything starts
on) and `find_group_id(board_id, title)` helpers; `items_automations` /
`subitems_automations` triggers (BEFORE UPDATE, so a group move just mutates
NEW — no extra statement, no self-trigger loop) implementing all 11
structural automations (move deal on status/broker/compliance change, post
canned updates, stamp a subitem's date when its condition changes); and
`generate_notifications()` implementing the 3 notify rules (submitted
follow-up, closing today, instruct-reminder within 10 days), broadcast to
every profile and deduped via the existing `unique(user_id, dedupe_key)`.
Scheduled daily via `pg_cron` (`0 12 * * *`). `scripts/apply-schema.mjs` now
splits `schema.sql` on a `-- ==CRON==` marker and applies the cron section as
its **own** statement batch — Postgres runs a multi-statement simple-query
string as one implicit transaction, so if pg_cron isn't enabled on a given
Supabase plan, that failure must not roll back the trigger DDL that ran
before it. Also had to make the `alter publication supabase_realtime add
table ...` lines idempotent (wrapped in a `do $$ ... exception when
duplicate_object$$` block) — turns out `schema.sql` had never actually been
re-run end-to-end since initial setup; that line was the first thing to break
on a second run. New UI: "⚡ Automations" toolbar button → toggle panel
(`AutomationsPanel.jsx` + `lib/data/automations.js` + `automationDefs.js`),
and a bell icon (`NotificationsBell.jsx`) using the already-written
`lib/data/notifications.js`. Verified: `scripts/_verify-automations.mjs` (14
checks: each automation actually fires/doesn't fire, notifications are
idempotent and respect toggles, the pg_cron job is scheduled and active) +
`scripts/_ui-test-item5-9.mjs` (9 headless checks).

**Item 8 (mobile card view)** — commit `7794cdf`. Below 768px (checked via
`window.matchMedia`, not CSS alone — the grid and cards are genuinely
different DOM, not a squeezed version of one), `BoardGrid.jsx` renders
`BoardCards.jsx` (collapsible groups of compact deal cards) instead of
`GroupSection`. Tapping a card opens `ItemDetailSheet.jsx`, which reuses the
desktop grid's own `Cell`, `SubitemPanel`, and `AttachmentsPanel` components
stacked into one scrollable form — mobile editing/conditions/files go through
the exact same code paths as desktop. `BoardShell.jsx` gained a hamburger
topbar + off-canvas sidebar drawer for mobile (the permanent 240px sidebar
has nowhere to go on a phone). **Gotcha that cost a debug round-trip**: the
first version put the mobile topbar as a row-flex sibling of the sidebar
inside `.board-root`; since board-root is `display:flex` with no
flex-direction override, the topbar sized to its content instead of
stacking above the grid, silently splitting the viewport in half. Fixed by
wrapping the topbar + `BoardGrid` in a `.board-main-wrap` column container.
Caught by comparing `getBoundingClientRect()` of `.board-main` against the
emulated viewport width in a throwaway debug script — worth doing again if a
mobile layout looks subtly wrong; screenshots alone didn't make the cause
obvious. Verified at a 390×844 viewport: `scripts/_ui-test-item8.mjs` (13
checks — cards render instead of the grid, drawer opens/closes, tap → sheet
with all 13 fields + conditions + files, an inline edit persists).

**Item 6 (AI assistant drawer)** — commit `9f1efb8`. Right-side drawer
(`AiPanel.jsx`) sends the full board tree + an "actions" grammar
(`lib/ai/prompt.js`) as the system prompt to the already-existing
`POST /api/claude` route (bumped its model to `claude-sonnet-5`). Ported the
prototype's action protocol but trimmed to 7 types this app can actually
execute against its schema — `set_field`, `bulk_set_field`, `set_condition`,
`add_condition`, `move_deal`, `add_deal`, `post_update` — dropping
`send_client_update` (no email-sending integration exists) and
`order_appraisal` (redundant with `set_field` on appraisal/appraiser).
`lib/ai/applyActions.js` executes approved actions through the same
`lib/data/*` functions the rest of the app already uses, so applied changes
flow through `BoardGrid.jsx`'s existing realtime subscription instead of
needing bespoke optimistic-UI wiring. **Still blocked**: confirmed directly
against the Messages API that `ANTHROPIC_API_KEY` is still rejected as
invalid — regenerate it, then re-run `scripts/_ui-test-item6.mjs` to confirm
an actual completion + action apply (right now it only verifies the request
fires and the resulting error surfaces correctly in the panel, rather than
hanging or crashing). Also verified the action dispatch/parsing logic
directly against the live DB, independent of the API call:
`scripts/_verify-ai-actions.mjs` (15 checks).

**Also fixed**: `npm run build` (production) and `npm run dev` must not run
concurrently against the same `.next` directory — doing so mid-session
corrupted the dev server's webpack runtime ("Cannot find module './948.js'"),
which looked like a React crash until `document.body.innerHTML` was
inspected directly and it turned out to be a Next.js 500 page. Fix is just
`rm -rf .next` + restart `npm run dev` after any `npm run build` run while
dev is up.

### Prior session (2026-09-07, session 2)
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

### PORTING item 7 — file attachments (commit `dba0eb4`)
- `components/board/AttachmentsPanel.jsx` (new) — "Files" box rendered below
  `SubitemPanel` in the expanded row. Header shows count + "+ Add file"
  (reveals a hidden `<input type=file multiple>`); rows show filename (click
  to download), size, date, and a delete `✕` (reuses `.sub-del`). Empty /
  loading states.
- `BoardGrid.jsx` — attachments are **not** part of `getBoardTree` and **not**
  in the realtime publication (same tradeoff as boards, see Gotchas). Lazy
  state `attachmentsByItem` (keyed by item id) + `attachmentsLoaded` ref guard
  fetch on first expand via `toggleExpand`. `uploadAttachmentFor` /
  `removeAttachmentFor` are optimistic (patch local state, fire the Supabase
  call); `downloadAttachment` calls `getDownloadUrl` for a fresh signed URL
  then clicks a throwaway `<a download>`.
- No schema/Supabase changes — `attachments` table, private bucket, and RLS +
  storage policies were already provisioned during initial infra setup;
  `lib/data/attachments.js` was already written and untouched.
- Verified (headless Chrome + CDP, live DB, `scripts/_ui-test-item7.mjs`, 15
  checks, self-cleaning): upload → DB row + storage object with correct
  size/mime; signed URL fetched over HTTP actually returns the uploaded bytes;
  delete removes the DB row, the storage object, and the UI row; no console
  errors.

### PORTING item 9 + item 5 — automations + notifications (commit `a935aa8`)
See "This session" above for the full writeup. Files: `supabase/schema.sql`
(`automation_enabled`, `find_group_id`, `items_automations` /
`subitems_automations` triggers, `generate_notifications`, pg_cron schedule),
`lib/data/automations.js`, `components/board/automationDefs.js`,
`components/board/AutomationsPanel.jsx`, `components/board/NotificationsBell.jsx`.

### PORTING item 8 — mobile card view (commit `7794cdf`)
See "This session" above. Files: `components/board/BoardCards.jsx`,
`components/board/ItemDetailSheet.jsx`, `components/BoardShell.jsx` (hamburger
topbar + drawer), `.board-main-wrap` / `.cards-*` / `.deal-card*` /
`.msheet-*` in `board.css`.

### PORTING item 6 — AI assistant drawer (commit `9f1efb8`)
See "This session" above. Files: `components/board/AiPanel.jsx`,
`lib/ai/prompt.js`, `lib/ai/applyActions.js`, `app/api/claude/route.js`
(model bumped to `claude-sonnet-5`). **Needs a fresh `ANTHROPIC_API_KEY`**
before it can complete a real request — see the open blocker at the top.

---

## What's NOT done (next work)

**All 9 PORTING.md items are done.** What's left is explicitly outside that
numbered scope:

| Item | Notes |
|---|---|
| Dark theme | Prototype has the dark token set; `board.css` is light-only. Tokens are already on `:root`, so a `@media (prefers-color-scheme)` block or a toggle (persisted via `user_prefs`, which already has a `prefs` jsonb column) is straightforward. |
| Filter menu | Prototype has an agent/lender filter in the toolbar (see `design-reference/CAYMUS 25 Board.dc.html`, `filterAgent`/`filterLender` state). Not built — search is the only filter today. |
| Undo | Prototype keeps a full undo stack client-side. Not attempted here — retrofitting undo onto server-authoritative state (multi-user, realtime) is a materially different problem than the prototype's single-user localStorage undo, and needs a deliberate design pass (event log? Postgres history table?) rather than a port. |
| Trash / restore view | `deleteBoard` already soft-deletes into the `trash` table (`payload` jsonb holds the full board tree), but there's no UI to browse or restore from it. |

Also still open: the `ANTHROPIC_API_KEY` blocker on item 6 (see top of this
file) — the only thing separating "built" from "verified working" on that
item.

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
  `_ui-test-item4`, `_ui-test-item7`, `_ui-popover-shot`,
  `_verify-automations`, `_ui-test-item5-9`, `_ui-test-item8`,
  `_verify-ai-actions`, `_ui-test-item6` (headless CDP checks).
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
