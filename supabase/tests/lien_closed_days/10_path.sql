-- The job's lien path answer (20261117080000_job_lien_path_answer.sql), added to the lien_hand_day bed's stand-in jobs
-- table, typed as that migration types it. See scripts/pgtest-lien-closed-days.sh. Never against prod.
\set ON_ERROR_STOP on
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS lien_path_answer text;
