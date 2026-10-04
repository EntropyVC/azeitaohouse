# Azeitão Property Map

Private map and database of short-let properties around Azeitão with owner records and approach status.

Static site (no build step) served by Vercel. Data lives in Supabase (table `properties`, storage bucket `photos`). Sign-in is Supabase email + password; users are created in the Supabase dashboard.

Files
- `public/index.html` the app
- `supabase/schema.sql` run once in the Supabase SQL editor
- `scripts/seed.mjs` loads a JSON export from the local version into the table

## Vercel environment variables

- `ANTHROPIC_API_KEY` (optional) turns on the cloud sign reader in the gate scan.
- Certidão Permanente requests from a record (`/api/cert/request`) file the form on Predial Online as you. Set the requester once, the values never enter the database or the page:
  `CERT_NOME`, `CERT_NIF`, `CERT_EMAIL`, `CERT_MORADA`, `CERT_CODPOSTAL`, `CERT_LOCALIDADE`, and optionally `CERT_TELEMOVEL`.
  Each request creates a €15 Multibanco reference in that name. Without these variables the button reports that the requester is not set.
