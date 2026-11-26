/**
 * The writes behind the payoff card (punch list #435, piece 4; the facts are `lienPayoffFields.ts`). Each lien is
 * one update of its affidavit row's `fields`, the row's other fields kept. The rows are written one after another
 * and the run keeps going past a row that fails: every row comes back with whether it took and, when it did not,
 * the reason. The update is the same whole-fields write the Release of record tab makes for the county's stamp.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { payoffFieldsPatch, type PayoffFieldsChange } from './lienPayoffFields'

export type PayoffFieldsRow = { affidavitId: string; fields: unknown }

export type PayoffFieldsOutcome = { affidavitId: string; ok: boolean; why: string | null }

export const PAYOFF_WRITE_FAILED = 'The lien did not take the change.'

export async function keepPayoffFields(rows: ReadonlyArray<PayoffFieldsRow>, change: PayoffFieldsChange): Promise<PayoffFieldsOutcome[]> {
  const out: PayoffFieldsOutcome[] = []
  for (const row of rows) {
    try {
      await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ fields: payoffFieldsPatch(row.fields, change) } as never).eq('id', row.affidavitId), 'lien payoff: keep a lien’s facts')
      out.push({ affidavitId: row.affidavitId, ok: true, why: null })
    } catch (e) {
      out.push({ affidavitId: row.affidavitId, ok: false, why: formatErrorMessage(e, PAYOFF_WRITE_FAILED) })
    }
  }
  return out
}
