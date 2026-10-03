# Azeitão Property Map

Private map and database of short-let properties around Azeitão with owner records and approach status.

Static site (no build step) served by Vercel. Data lives in Supabase (table `properties`, storage bucket `photos`). Sign-in is Supabase email + password; users are created in the Supabase dashboard.

Files
- `public/index.html` the app
- `supabase/schema.sql` run once in the Supabase SQL editor
- `scripts/seed.mjs` loads a JSON export from the local version into the table
