-- Allow same job to appear multiple times in common_jobs (add row id, drop job_id PK)
-- Enables users to add the same job to Common Jobs multiple times for quick access

ALTER TABLE public.common_jobs ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.common_jobs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.common_jobs ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.common_jobs DROP CONSTRAINT IF EXISTS common_jobs_pkey;
ALTER TABLE public.common_jobs ADD PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS common_jobs_job_id_idx ON public.common_jobs(job_id);
