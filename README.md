# CAYMUS Board — Production App

Next.js 14 + Supabase. This is the migration target for the HTML prototype
(\`design-reference/CAYMUS 25 Board.dc.html\`).

---

## What is finished vs. what is scaffolded

**Finished and production-ready:**
- Postgres schema with row-level security (\`supabase/schema.sql\`)
- Shared data layer (\`lib/data/*\`) — used by BOTH the web app and your mobile app
- Supabase auth wired up (email magic link), team-gated
- Realtime subscriptions so two open clients stay in sync
- Claude AI endpoint ported from \`caymus-ai-backend\` to \`app/api/claude/route.js\`
- Seed importer that loads your existing board data into Postgres
- Vercel deploy config

**Scaffolded — needs the UI ported:**
- The board grid, inline editing, subitem checklists, notifications panel and AI
  drawer exist in the prototype as ~2,100 lines of a single component. The app
  has the routes, the data layer and a working minimal board view. Porting the
  full grid UI is the main remaining task — see \`PORTING.md\`.

Do not copy the prototype HTML into the app. It is a design reference.

---

## Setup — follow in order

> **First:** read `SETUP-FIRST.md`. One folder needs renaming after you copy
> this project to your computer. It takes ten seconds and the app will not
> build without it.

### 1. Prerequisites
Install if you have not already:
- **Node.js LTS** — nodejs.org (v20 or newer)
- **Git** — git-scm.com
- **VS Code** — code.visualstudio.com

Verify in a terminal:
\`\`\`bash
node -v
git -v
\`\`\`
Both should print a version. If not, restart your terminal.

### 2. Create the Supabase project
1. Go to supabase.com, sign up, click **New project**.
2. Name it \`caymus-board\`. Pick a region near you. Save the database password
   somewhere safe — you will not be shown it again.
3. Wait for provisioning (~2 min).
4. Open **Project Settings -> API**. Copy these two values:
   - Project URL
   - \`anon\` public key
5. Open **Project Settings -> API -> service_role**. Copy that key too. It is a
   secret. It goes only in \`.env.local\`, never in the browser, never in git.

### 3. Create the database tables
1. In Supabase, open **SQL Editor -> New query**.
2. Paste the entire contents of \`supabase/schema.sql\`.
3. Click **Run**. You should see "Success. No rows returned".
4. Open **Table Editor** — you should now see \`boards\`, \`groups\`, \`items\`,
   \`subitems\` and the rest.

### 4. Create the storage bucket for file attachments
1. Open **Storage -> New bucket**.
2. Name it \`attachments\`. Leave it **private**.
3. Click **Create**.

### 5. Get the code into GitHub
On github.com, click **New repository**, name it \`caymus-board\`, keep it
**private**, and do not add a README. Then, in a terminal:

\`\`\`bash
cd ~/Documents            # or wherever you keep projects
# copy this caymus-app folder here first, then:
cd caymus-app
git init
git add .
git commit -m "Initial commit: CAYMUS board app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/caymus-board.git
git push -u origin main
\`\`\`

### 6. Configure environment variables
\`\`\`bash
cp .env.example .env.local
\`\`\`
Open \`.env.local\` in VS Code and paste in the three Supabase values from step 2,
plus your Anthropic API key from console.anthropic.com.

\`.env.local\` is already in \`.gitignore\`. Never commit it.

### 7. Run it
\`\`\`bash
npm install
npm run dev
\`\`\`
Open http://localhost:3000. You will be asked to sign in. Enter your email,
check your inbox, click the link.

### 8. Import your existing board data
With the dev server stopped:
\`\`\`bash
npm run seed
\`\`\`
This reads \`design-reference/caymus-data.js\` and writes the boards, groups,
items and subitems into Postgres. Run it once. Running it twice creates
duplicates.

### 9. Invite your team
In Supabase, open **Authentication -> Users -> Invite user** and enter each
teammate's email. Only invited users can sign in — see \`ALLOWLIST\` in
\`supabase/schema.sql\` for how access is enforced.

### 10. Deploy
1. Go to vercel.com, sign in with GitHub, click **Add New -> Project**.
2. Pick your \`caymus-board\` repo. Vercel detects Next.js automatically.
3. Before deploying, open **Environment Variables** and add the same four
   values from \`.env.local\`.
4. Click **Deploy**.
5. Back in Supabase, open **Authentication -> URL Configuration** and add your
   Vercel URL to **Redirect URLs**, otherwise the login link will bounce.

Every \`git push\` to \`main\` now redeploys automatically.

---

## Project layout

\`\`\`
app/                     Next.js routes
  page.js                redirects to the first board
  login/page.js          magic-link sign-in
  board/[boardId]/       the board view
  api/claude/route.js    AI endpoint (was caymus-ai-backend)
components/              React UI
lib/
  data/                  SHARED data layer — mobile app imports this too
  supabase/              client factories (browser / server / admin)
supabase/schema.sql      run this in the SQL editor
scripts/import-seed.mjs  one-time data import
design-reference/        the HTML prototype — reference only, not shipped
\`\`\`

## Docs in this folder
- \`PORTING.md\` — what is left to build, screen by screen
- \`MOBILE.md\` — how the mobile app shares this backend
- \`design-reference/README.md\` — design tokens, layout and behaviour spec
