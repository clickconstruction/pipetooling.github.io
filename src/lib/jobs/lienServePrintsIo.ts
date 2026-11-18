import { supabase } from '../supabase'
import { LIEN_SERVED_COPY_SENT_KIND } from '../jobsDocuments/lienServedCopy'

/**
 * Which filed liens had their copies printed here (`lienServeStage.ts`): every print is filed on its job against the
 * filing it copies (`sent_documents`, `docs/SENT_COPIES.md`), so the filings with such a row are the printed ones.
 * Reads only. A read that fails answers with none, and the doors read *Print the copies to mail* as they would with
 * nothing printed.
 */
export async function readLienCopyPrints(filingIds: ReadonlyArray<string>): Promise<string[]> {
  const ids = [...new Set(filingIds.filter(Boolean))]
  if (ids.length === 0) return []
  const out = new Set<string>()
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from('sent_documents' as never)
        .select('source_id')
        .eq('kind', LIEN_SERVED_COPY_SENT_KIND)
        .eq('source_table', 'job_lien_filings')
        .in('source_id', ids.slice(i, i + 100))
      if (error) return [...out]
      for (const r of (data ?? []) as Array<{ source_id: string | null }>) if (r.source_id) out.add(r.source_id)
    }
  } catch {
    // Fail soft: the stage reads from the filing alone.
  }
  return [...out]
}
