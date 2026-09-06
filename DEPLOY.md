# Deploying to Vercel

The app is a standard Next.js 14 project. `vercel.json` pins the region to
`iad1` (US East) to sit next to the Supabase project (`us-east-1`).

## One-time setup

### 1. Push to GitHub
```bash
git push -u origin main
```
Remote `origin` is `https://github.com/clmang12/caymus-board`.

### 2. Import into Vercel
1. vercel.com -> **Add New -> Project**
2. Import `clmang12/caymus-board`. Next.js is auto-detected; leave build
   settings at their defaults.

### 3. Environment variables
Add these in **Project -> Settings -> Environment Variables** (all
environments). The values are the same ones in your local `.env.local`:

| Name | Exposed to browser | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes (NEXT_PUBLIC_) | Supabase -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (NEXT_PUBLIC_) | Supabase -> Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | Supabase -> Settings -> API -> service_role |
| `ANTHROPIC_API_KEY` | **no** | console.anthropic.com |

Do **not** set:
- `NEXT_PUBLIC_SITE_URL` — the login page falls back to the live deployment
  origin (`window.location.origin`) and the auth callback uses the request
  origin. Setting it to a fixed URL only causes trouble across preview
  deployments.
- `DATABASE_URL` — only used by the local `npm run db:schema` script, never at
  runtime.

### 4. Deploy
Click **Deploy**. Every `git push` to `main` redeploys automatically; pull
requests get preview deployments.

### 5. Point Supabase auth at the deployed URL
In Supabase -> **Authentication -> URL Configuration**:
- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/**`

Without this the magic-link email links bounce back to `localhost`.

If you later add a custom domain, add it to both fields too.

## Schema / data on a fresh environment

The schema and seed are already applied to the shared Supabase project, so a
Vercel deploy needs nothing extra. If you ever point the app at a new Supabase
project, run against it once, locally:

```bash
npm run db:schema      # applies supabase/schema.sql
npm run setup:storage  # creates the private 'attachments' bucket
npm run seed           # imports design-reference/caymus-data.js
```

## Notes

- `npm audit` reports advisories against Next 14.2.x whose only fix is Next 16
  (a major upgrade). Deferred until after the UI port. Low real-world risk for
  a Vercel-hosted app with no custom server.
