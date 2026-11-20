-- RPMOD database schema (run in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.projects (
  share_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edit_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pack_hash TEXT NOT NULL,
  manifest_json JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS projects_created_at_idx
  ON public.projects (created_at DESC);

-- The API connects with the PostgreSQL connection string and performs
-- server-side operations. Do not expose the database password in the browser.
