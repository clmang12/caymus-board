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

## 4. Multiple boards + sidebar
Prototype: sidebar list, drag to reorder, rename, duplicate, delete.
Data: \`listBoards\`, \`reorderBoards\`, \`renameBoard\`, \`duplicateBoard\`,
\`deleteBoard\` (soft delete into \`trash\`).
Build: \`components/Sidebar.jsx\`. Board order is global, not per-user.

## 5. Notifications
Prototype: computed client-side from dates on every load, dismissals kept in
localStorage.
Change this. Notifications should be generated server-side so they fire whether
or not anyone has the app open. Write a Supabase scheduled function (pg_cron,
daily) that inserts into \`notifications\`. \`lib/data/notifications.js\` then
just reads, marks read, and clears.

## 6. AI assistant panel
Prototype: a drawer posting to the local Express backend.
Now: POST \`/api/claude\`. The route is done and reads the API key server-side —
the key must never reach the browser.

## 7. File attachments
Prototype: file names held in memory only.
Data: \`lib/data/attachments.js\` uploads to the \`attachments\` bucket and rows
into \`attachments\`. Use signed URLs for download; the bucket is private.

## 8. Mobile-friendly view
Below 768px, render \`components/board/BoardCards.jsx\` instead of the grid — one
card per deal, tap to open a detail sheet. Do not try to make the 14-column
grid responsive.

## 9. Automations
Prototype: toggles that run in the client.
These belong in Postgres triggers or a scheduled function, for the same reason
as notifications. \`automations\` stores which are enabled per board.

## Suggested order
1, 2, 4 first — that gets you a usable app. Then 3, 7, 5, 6, 8, 9.
Done so far: 1, 2, 3. Remaining: 4, 7, 5, 6, 8, 9.

## Working with Claude Code
From the repo root:
\`\`\`bash
claude
\`\`\`
Then, for example: "Read design-reference/README.md and PORTING.md, then
implement item 1, the board grid, using getBoardTree from lib/data/boards.js."
Give it one numbered item at a time.
