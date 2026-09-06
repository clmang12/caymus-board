# Sharing this backend with your mobile app

Both clients talk to the same Postgres through Supabase. There is no sync layer
to write and no server to keep in step — the database is the single source of
truth and Supabase pushes changes to whoever is listening.

## The rule that makes this work

**No business logic in \`app/api/*\`.** Everything that decides what a board is,
how a status change cascades, or what a notification means lives in
\`lib/data/\`. Those files import only \`@supabase/supabase-js\`, so a React
Native app can import the exact same modules unchanged. The Next.js API routes
exist only for things that need a secret key (the Claude endpoint).

If you put a rule in a Next.js route, the mobile app cannot reach it and you
will end up writing it twice and having the two drift apart.

## Recommended mobile setup

Expo + React Native:
\`\`\`bash
npx create-expo-app caymus-mobile
cd caymus-mobile
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
\`\`\`

Then share the data layer. Two options:

**Option A — monorepo (recommended).** Move \`lib/data\` into a
\`packages/core\` workspace that both \`apps/web\` and \`apps/mobile\` depend on.
One copy, no drift.

**Option B — git submodule.** Keep \`lib/data\` in its own small repo and add it
to both projects. Simpler to start, easier to forget to update.

Start with B if the monorepo tooling feels like a detour; move to A when the
duplication starts to bite.

## Auth carries over

Supabase Auth issues the same JWT to both clients. A user signed in on mobile
and on web is the same user, and row-level security applies identically. On
mobile, pass AsyncStorage as the session store:

\`\`\`js
createClient(url, anonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true,
          detectSessionInUrl: false }
})
\`\`\`

## Realtime

\`lib/data/realtime.js\` subscribes to Postgres change events. The same function
works on both platforms — edit a cell on the web and the mobile list updates
without a refresh, and vice versa.

## What NOT to share

Keep UI separate. The board grid is a desktop-density layout; a phone wants a
card list. Share the data and the rules, not the components.
