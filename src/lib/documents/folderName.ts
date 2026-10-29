/**
 * Where files go (punch list #211): how a job's and a bid's Drive folder is named, the office's four settings and the
 * write check's words. The rules live in `supabase/functions/_shared/whereFilesGo.ts`, with no imports, so the functions
 * that make the folders (`job-drive-folders`, `drive-intake`) and the Documents page's tab read one implementation; this
 * file is the app's door to it, as `billing/billTruth.ts` is to its kernel.
 */
export * from '../../../supabase/functions/_shared/whereFilesGo'
