import { q } from './verify-lib.mjs'
await q('1 the column (expect uuid, YES)', `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_project_money' AND column_name = 'general_conditions_job_id';`)
await q('2 its key (expect jobs_ledger, n)', `SELECT confrelid::regclass::text AS refs, confdeltype::text AS on_delete FROM pg_constraint WHERE conrelid = 'public.gc_project_money'::regclass AND contype = 'f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.gc_project_money'::regclass AND attname = 'general_conditions_job_id')];`)
await q('3 no project names a job yet (expect 0)', `SELECT count(*) AS named FROM public.gc_project_money WHERE general_conditions_job_id IS NOT NULL;`)
