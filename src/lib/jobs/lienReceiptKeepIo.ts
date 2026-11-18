/**
 * The io half of a receipt kept the moment it is added (`lienReceiptFile.ts`): one copy's number and receipt written
 * onto its filing's `sends`. The list is read fresh before it is written, so two people at the post office counter
 * keep both copies, and only `sends` is written: the day served is **Record**'s.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienSendsWithProof, type LienCopyProof } from './lienReceiptFile'
import type { LienSendLike } from './lienSendTracking'
import type { ServiceCopy } from './lienServiceProof'

export type LienReceiptKeepIo = {
  read: (filingId: string) => Promise<unknown>
  write: (filingId: string, sends: LienSendLike[]) => Promise<void>
}

export const supabaseLienReceiptKeepIo: LienReceiptKeepIo = {
  read: async (filingId) => {
    const row = await withSupabaseRetry<{ sends?: unknown } | null>(() => supabase.from('job_lien_filings').select('sends').eq('id', filingId).maybeSingle() as never, 'lien receipt: read the sends')
    return row?.sends ?? []
  },
  write: async (filingId, sends) => {
    await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ sends: JSON.parse(JSON.stringify(sends)) }).eq('id', filingId), 'lien receipt: keep the proof')
  },
}

/** Keep one copy's proof on its filing. Returns the `sends` as written. */
export async function keepLienCopyProof(args: { filingId: string; recipient: ServiceCopy; proof: LienCopyProof }, io: LienReceiptKeepIo = supabaseLienReceiptKeepIo): Promise<LienSendLike[]> {
  const sends = lienSendsWithProof(await io.read(args.filingId), args.recipient, args.proof)
  await io.write(args.filingId, sends)
  return sends
}
