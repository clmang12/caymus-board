# Read this before step 5

One file needs renaming after you copy this folder to your computer. Next.js
uses square brackets for dynamic routes, and they could not survive the export.

Rename this folder:

```
app/board/-boardId-/
```

to:

```
app/board/[boardId]/
```

Keep the square brackets — they are literal characters in the folder name, not
a placeholder. In VS Code, right-click the folder in the sidebar and choose
Rename, then paste `[boardId]`.

Or from a terminal, inside `caymus-app`:

```bash
mv "app/board/-boardId-" "app/board/[boardId]"
```

Nothing else needs renaming. Continue with `README.md` from step 1.
