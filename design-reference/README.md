# Design reference

\`CAYMUS 25 Board.dc.html\` is the **prototype**, not production code. Open it in
a browser to see intended look and behaviour. Recreate it in the Next.js app
using React components and the shared data layer. Do not copy it in.

Fidelity: **high**. Colours, type and spacing below are final.

## Design tokens

Light theme:
| Token | Value | Use |
|---|---|---|
| \`--s1\` | \`#ffffff\` | page and card surface |
| \`--s2\` | \`#f6f7fb\` | app background |
| \`--s3\` | \`#f0f2f7\` | row hover, subtle fill |
| \`--bd\` | \`#f0f2f7\` | hairline row divider |
| \`--bd2\` | \`#e6e9ef\` | card and panel border |
| \`--bd3\` | \`#d0d4e4\` | input border, popover border |
| \`--tx\` | \`#323338\` | primary text |
| \`--tx2\` | \`#676879\` | secondary text |
| \`--tx3\` | \`#a0a3bd\` | placeholder, icon rest |

Accent and status:
| Colour | Value | Meaning |
|---|---|---|
| Blue | \`#0073ea\` | primary action, active nav, drop indicator |
| Green | \`#00c875\` | Approved, Accepted, Complete, YES |
| Amber | \`#fdab3d\` | Submitted, Received, notification badge |
| Red | \`#df2f4a\` | destructive action, Need to Order |
| Purple | \`#a25ddc\` | agent label (Chris) |
| Teal | \`#4eccc6\` | Reviewed |
| Sky | \`#66ccff\` | Scheduled |
| Yellow | \`#ffcb00\` | Uploaded |
| Grey | \`#c4c4c4\` | Requested, N/A, neutral |
| Dark | \`#333333\` | Cancelled, Audit Done |

Typography — **Figtree**, weights 400/500/600/700/800:
| Element | Size | Weight |
|---|---|---|
| Board title | 24px | 800 |
| Group title | 15px | 700 |
| Table header | 12px | 600, letter-spacing .02em |
| Cell text | 13px | 500 |
| Sidebar item | 13.5px | 500 / 700 active |
| Section eyebrow | 10.5–11px | 800, letter-spacing .05–.12em |
| Meta / secondary | 12px | 400 |

Geometry:
- Radius: 3px checkbox, 6px row/button, 8px card/input, 12px modal/popover, 50% badge
- Row height: 36px items, 32px subitems
- Sidebar width: 240px
- Popover shadow: \`0 12px 32px rgba(30,40,80,.22)\`
- Card shadow: \`0 4px 20px rgba(30,40,80,.06)\`
- Transitions: 120ms on hover colour and opacity

A dark theme also exists in the prototype (\`body:has(.board-root.dark)\`,
background \`#14151b\`). Port it after the light theme works.

## Columns, left to right
Name (sticky) · Agent (label) · Deal Type (dropdown) · Closing Date (date) ·
Lender (multi-select) · Volume (currency) · Status (label) · Appraisal (label) ·
Appraiser (dropdown) · Instructed (label) · Broker Complete (label) ·
Compliance (label) · Notes (long text) · Email (text)

Headers are resizable by dragging the right edge and reorderable by dragging the
header itself. Both are per-user state.

## Interactions to preserve
- Click a cell to edit in place; label and dropdown cells open a colour-swatch popover; commit on blur or Enter, cancel on Escape
- Expand an item to reveal its subitem condition rows
- Collapse groups; collapse all
- Search filters rows across all groups
- Sort by clicking a header
- Drag rows between groups; drag boards in the sidebar to reorder
- Notification badge on a row: hover shows a popover listing that deal's notifications with a clear button, which asks for confirmation first
- Undo for destructive and reordering actions
- Soft delete into a trash view with restore

## Screenshots
See \`screenshots/\` in the previous handoff bundle for the five reference views:
board overview, subitems expanded, conversation drawer, automations panel,
filter menu.
