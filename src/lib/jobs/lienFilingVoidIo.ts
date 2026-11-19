/**
 * The io half of `lienFilingVoid.ts`: a filing voided, as the Lien window's **Void** and **Back from the clerk**'s
 * take-back both do it. One write, the filing's `voided_at`. The database puts the lien's paper back in that same
 * step. The two reads around it only find out what to tell the person, so a read that fails never fails the void.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { lienVoidPaperOutcome, type LienVoidPaperOutcome, type LienVoidPaperRow } from './lienFilingVoid'

export type LienFilingVoidDeps = {
  /** The live affidavit papers that are sent and tied to this filing, by id. */
  tiedPapers: (filingId: string) => Promise<string[]>
  voidFiling: (filingId: string, at: string) => Promise<void>
  papers: (ids: ReadonlyArray<string>) => Promise<LienVoidPaperRow[]>
}

export const supabaseLienFilingVoidDeps: LienFilingVoidDeps = {
  tiedPapers: async (filingId) => {
    const rows = await withSupabaseRetry<Array<{ id: string }>>(
      () => supabase.from('job_lien_desk_items').select('id').eq('sent_filing_id', filingId).eq('kind', 'affidavit').eq('status', 'sent').is('voided_at', null) as never,
      'read lien paper',
    )
    return (rows ?? []).map((r) => r.id)
  },
  voidFiling: async (filingId, at) => {
    await withSupabaseRetry(() => supabase.from('job_lien_filings').update({ voided_at: at }).eq('id', filingId), 'void lien filing')
  },
  papers: async (ids) => {
    const rows = await withSupabaseRetry<LienVoidPaperRow[]>(() => supabase.from('job_lien_desk_items').select('id, status, voided_at').in('id', [...ids]) as never, 'read lien paper')
    return rows ?? []
  },
}

/**
 * Void one filing. Throws with the reason when the void did not land. Answers what became of the lien's paper; a
 * filing that is not an affidavit has no paper to put back, and answers `none`.
 */
export async function voidLienFiling(filing: { id: string; kind: string }, deps: LienFilingVoidDeps = supabaseLienFilingVoidDeps): Promise<LienVoidPaperOutcome> {
  let tied: string[] = []
  if (filing.kind === 'affidavit') {
    try {
      tied = await deps.tiedPapers(filing.id)
    } catch {
      // The void still goes ahead. With no list, nothing is said about the paper.
    }
  }
  await deps.voidFiling(filing.id, new Date().toISOString())
  if (tied.length === 0) return 'none'
  try {
    return lienVoidPaperOutcome(tied, await deps.papers(tied))
  } catch {
    return 'none'
  }
}
