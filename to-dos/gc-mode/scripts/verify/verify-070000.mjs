import { q } from './verify-lib.mjs'
await q('1 the cron row (expect gc-office-notices, 13 * * * *, active)', `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'gc-office-notices';`)
await q('2 the latest run, if any yet (expect succeeded after the next :13)', `SELECT status, return_message, start_time FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'gc-office-notices') ORDER BY start_time DESC LIMIT 1;`)
