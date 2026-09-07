# Email delivery for auth (Resend + Supabase SMTP)

Supabase's built-in email sender is capped at ~2–4 messages/hour and is not for
production. Auth emails (magic links, invites) go through **Resend** instead.

Sending domain: a **subdomain** of the company domain, e.g. `send.caymusmortgage.ca`
(substitute the real domain below). A subdomain keeps email reputation separate
from the root domain.

---

## Part A — Resend (one time)

1. Sign up at **resend.com** — free tier is 3,000 emails/month, 100/day.
2. **Domains → Add Domain** → enter the subdomain (`send.caymusmortgage.ca`).
   Pick the **US** region (matches the Supabase project in `us-east-1`).
3. Resend shows 3–4 DNS records unique to this domain. Add them at whoever hosts
   DNS for the root domain. They look like:

   | Type | Name | Value |
   |---|---|---|
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
   | TXT | `resend._domainkey.send` | `p=MIGf...` (long DKIM key, copy exactly from Resend) |
   | TXT | `_dmarc.send` | `v=DMARC1; p=none;` (optional but recommended) |

   Propagation is usually minutes, up to ~1 hour.
4. Back in Resend, click **Verify**. Wait for all records green.
5. **API Keys → Create API Key** → name `caymus-supabase-smtp`, permission
   **Sending access**, domain-scoped to the subdomain. Copy the `re_...` key —
   it is shown once.

## Part B — Supabase SMTP (fill the form)

**Authentication → Emails → SMTP Settings** (older UI: Project Settings → Auth →
SMTP) → enable **Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `noreply@send.caymusmortgage.ca` — must be on the verified domain |
| Sender name | `Caymus Mortgage Capital` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `re_...` API key from Part A step 5 |

Save.

Then **Authentication → Rate Limits** → raise **"Rate limit for sending emails"**
to `100` per hour (the default is very low and is what caused "email rate limit
exceeded").

## Part C — verify

1. Go to `https://caymus-board.vercel.app/login`, enter your email, submit.
2. The email should arrive within a few seconds (check spam the first time).
3. Click the link → lands on the board.
4. Cross-check in **Resend → Emails** (delivery status) and
   **Supabase → Authentication → Logs** (send success) if it does not arrive.

## Part D — adding the team

Email signups are currently **open** — any teammate can go to the URL, enter
their work email, and get a link. Their `profiles` row is created automatically
with role `member`.

To lock it to invite-only later: **Authentication → Providers → Email** → turn
off "Enable email signups", then add each person via
**Authentication → Users → Invite user**. See `supabase/schema.sql` (ALLOWLIST).
