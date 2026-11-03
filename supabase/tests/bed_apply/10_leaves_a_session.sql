-- Leaves everything a session can hold. 20 checks that none of it came along.
SET lock_timeout = '3s';
SET search_path = pg_catalog;
SET application_name = 'bed_apply_10';
CREATE TEMP TABLE bed_apply_left_behind (x int);
SELECT pg_advisory_lock(424242);
CREATE TABLE IF NOT EXISTS public.bed_apply_ran (n serial PRIMARY KEY, file text NOT NULL, pid int NOT NULL DEFAULT pg_backend_pid());
INSERT INTO public.bed_apply_ran (file) VALUES ('10');