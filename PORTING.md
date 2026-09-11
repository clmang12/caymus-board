# What is left to build

The prototype is one component. The app splits it along these seams. Each entry
lists the prototype behaviour, the data layer function that backs it, and the
component to write.

## 1. Board grid — the main work
Prototype: a table of groups, each with rows of items, ~14 columns, resizable
and reorderable headers, collapsible groups.
Data: \`lib/data/boards.js\` -> \`getBoardTree(boardId)\` returns the whole tree.
Build: \`components/board/BoardGrid.jsx\`, \`GroupSection.jsx\`, \`ItemRow.jsx\`,
\`Cell.jsx\`. One \`Cell\` per column type (text, label, dropdown, date, number,
multi-select). Column widths and order are per-user — persist via
\`lib/data/prefs.js\`, not localStorage.

## 2. Inline cell editing
Prototype: click a cell, a popover or input appears, change commits on blur.
Data: \`updateItem(itemId, patch)\`, \`updateSubitem(subitemId, patch)\`.
Note: write optimistically to local state, then reconcile — the realtime echo
of your own change will arrive a moment later and must not cause a flicker.

## 3. Subitem checklists — DONE (commit TBD)
Prototype: expand an item to reveal condition rows with their own status.
Data: \`getSubitems(itemId)\`, \`addSubitem\`, \`updateSubitem\`, \`deleteSubitem\`,
\`applyTemplate(sb, itemId, boardId, deal)\` (board-scoped, idempotent).
Built: \`components/board/SubitemPanel.jsx\` — editable name / status popover /
date / details / delete, "+ Add condition", empty-state Purch|Refi checklist
buttons. Optimistic writes in \`BoardGrid.jsx\`, reconciled by the \`subitems\`
realtime handler.

## 4. Multiple boards + sidebar — DONE (commit 82b765c)
Prototype: sidebar list, drag to reorder, rename, duplicate, delete.
Data: \`listBoards\`, \`reorderBoards\` (sequential UPDATEs), \`renameBoard\`,
\`createBoard({name, fromBoardId})\` (copies group structure + options + templates,
no deals), \`duplicateBoard\` (deep copy, client-gen UUIDs), \`deleteBoard\`
(soft delete into \`trash\`, refuses last board), \`setItemPositions\`.
Built: \`components/Sidebar.jsx\` (interactive; "+ New board", ⋯ menu). Board
order is global. Also: drag deal rows between/within groups — handle in the name
cell, \`BoardGrid.moveRow\`. Boards table is not in realtime (no cross-session
sidebar sync yet).

## 5. Notifications — DONE (commit a935aa8)
Prototype: computed client-side from dates on every load, dismissals kept in
localStorage.
Change this. Notifications should be generated server-side so they fire whether
or not anyone has the app open. Write a Supabase scheduled function (pg_cron,
daily) that inserts into \`notifications\`. \`lib/data/notifications.js\` then
just reads, marks read, and clears.
Built: \`generate_notifications()\` Postgres function (in \`supabase/schema.sql\`)
implements the 3 notify rules, scheduled daily via pg_cron; broadcasts to
every profile, deduped via the existing unique(user_id, dedupe_key). Bell icon
+ dropdown in the toolbar (\`components/board/NotificationsBell.jsx\`).

## 6. AI assistant panel — DONE (commit 9f1efb8)
Prototype: a drawer posting to the local Express backend.
Now: POST \`/api/claude\`. The route is done and reads the API key server-side —
the key must never reach the browser.
Built: \`components/board/AiPanel.jsx\`, a right-side drawer sending the board
tree + an "actions" grammar (\`lib/ai/prompt.js\`) as the system prompt;
proposed changes are parsed out of the response and executed on explicit user
approval via \`lib/ai/applyActions.js\` (through the same lib/data functions
the rest of the app uses). **Still blocked**: the ANTHROPIC_API_KEY is
rejected as invalid — regenerate at console.anthropic.com, then re-run
\`scripts/_ui-test-item6.mjs\` to confirm a real completion + action apply.

## 7. File attachments — DONE (commit dba0eb4)
Prototype: file names held in memory only.
Data: \`lib/data/attachments.js\` uploads to the \`attachments\` bucket and rows
into \`attachments\`. Use signed URLs for download; the bucket is private.
Built: \`components/board/AttachmentsPanel.jsx\` — a "Files" box below the
conditions checklist in the expanded row (upload, list, signed-URL download,
delete). Lazy-loaded per item on first expand (not in \`getBoardTree\` or
realtime).

## 8. Mobile-friendly view — DONE (commit 7794cdf)
Below 768px, render \`components/board/BoardCards.jsx\` instead of the grid — one
card per deal, tap to open a detail sheet. Do not try to make the 14-column
grid responsive.
Built: \`BoardCards.jsx\` (collapsible groups of compact cards) + tap opens
\`ItemDetailSheet.jsx\`, which reuses the desktop grid's own \`Cell\`,
\`SubitemPanel\`, and \`AttachmentsPanel\` components stacked into one scrollable
form — same editing/conditions/files code paths as desktop, not a parallel
implementation. \`BoardShell.jsx\` also gained a hamburger topbar + off-canvas
sidebar drawer on mobile, since the permanent 240px sidebar has nowhere to go
on a phone.

## 9. Automations — DONE (commit a935aa8)
Prototype: toggles that run in the client.
These belong in Postgres triggers or a scheduled function, for the same reason
as notifications. \`automations\` stores which are enabled per board.
Built: \`items_automations\` / \`subitems_automations\` Postgres triggers (in
\`supabase/schema.sql\`) implement all 11 structural automations (move deal on
status/broker/compliance change, post canned updates, stamp a subitem's date).
"⚡ Automations" toolbar button opens a toggle panel
(\`components/board/AutomationsPanel.jsx\` + \`lib/data/automations.js\`). A
missing row for a given automation defaults to enabled, matching the
prototype where everything starts on.

## Suggested order
1, 2, 4 first — that gets you a usable app. Then 3, 7, 5, 6, 8, 9.
All 9 items are done. Not started, and not part of this numbered list: dark
theme (prototype has the token set; board.css is light-only), a filter menu,
undo, and a trash/restore view (soft-deleted boards land in the \`trash\`
table with no UI to browse or restore them yet).

## Working with Claude Code
From the repo root:
\`\`\`bash
claude
\`\`\`
Then, for example: "Read design-reference/README.md and PORTING.md, then
implement item 1, the board grid, using getBoardTree from lib/data/boards.js."
Give it one numbered item at a time.
