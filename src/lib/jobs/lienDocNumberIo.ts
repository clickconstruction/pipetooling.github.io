/**
 * The io half of a filed lien's document number (`lienDocNumber.ts`): one update of `recording_number` on the filing.
 * The write answers with the row it changed, so a lien the database refused is said as a failure, never as *saved*.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { LIEN_DOC_NUMBER_WORDS, lienDocNumberClean } from './lienDocNumber'

export async function saveLienDocNumber(args: { filingId: string; number: string }): Promise<void> {
  const rows = await withSupabaseRetry<Array<{ id: string }>>(
    () => supabase.from('job_lien_filings').update({ recording_number: lienDocNumberClean(args.number) }).eq('id', args.filingId).select('id') as never,
    'save lien document number',
  )
  if ((rows ?? []).length < 1) throw new Error(LIEN_DOC_NUMBER_WORDS.failed)
}
