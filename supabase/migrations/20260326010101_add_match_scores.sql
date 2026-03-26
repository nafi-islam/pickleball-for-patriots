-- Add score fields and updated_at for match results.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS score_a integer,
  ADD COLUMN IF NOT EXISTS score_b integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
