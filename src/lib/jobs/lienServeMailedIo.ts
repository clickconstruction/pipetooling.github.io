/**
 * The io half of the *Mailed* tick that saves itself (`lienServeNumbers.ts`): one filed lien's mailing day written,
 * or taken back. The `sends` are read fresh before they are written, as a kept receipt's are, so a number someone
 * else added a moment ago is not lost. The write answers with the row it changed: a lien the database refused comes
 * back with none, and that is said as a failure, never as *Saved*.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienSendsWithMailedDay } from './lienServeNumbers'
import type { LienSendLike } from './lienSendTracking'

export type LienMailedIo = {
  read: (filingId: string) => Promise<unknown>
  /** Answers how many rows the write changed. */
  write: (filingId: string, servedOn: string | null, sends: LienSendLike[]) => Promise<number>
}

export const supabaseLienMailedIo: LienMailedIo = {
  read: async (filingId) => {
    const row = await withSupabaseRetry<{ sends?: unknown } | null>(() => supabase.from('job_lien_filings').select('sends').eq('id', filingId).maybeSingle() as never, 'read lien mailing')
    return row?.sends ?? []
  },
  write: async (filingId, servedOn, sends) => {
    const rows = await withSupabaseRetry<Array<{ id: string }>>(
      () => supabase.from('job_lien_filings').update({ served_at: servedOn, sends: JSON.parse(JSON.stringify(sends)) }).eq('id', filingId).select('id') as never,
      servedOn ? 'record lien mailing' : 'take back lien mailing',
    )
    return (rows ?? []).length
  },
}

/** Write the day one lien's copies were mailed, or take it back with null. Returns the `sends` as written. */
export async function setLienMailed(args: { filingId: string; servedOn: string | null }, io: LienMailedIo = supabaseLienMailedIo): Promise<LienSendLike[]> {
  const sends = lienSendsWithMailedDay(await io.read(args.filingId), args.servedOn)
  const changed = await io.write(args.filingId, args.servedOn, sends)
  if (changed < 1) throw new Error('the lien did not take it')
  return sends
}
