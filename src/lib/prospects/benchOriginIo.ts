/**
 * The read behind Trade partners' from-Prospects line (v2.5807): the subs that landed as these
 * companies and their call log, under `prospects`' own policy. Fail-soft: a role the lane refuses
 * sees the bench without the line.
 */
import { supabase } from '../supabase'
import { benchOriginsFrom, type BenchOrigin } from './benchOrigin'

type ProspectRow = { id: string; converted_gc_company_id: string | null }
type CommentRow = { prospect_id: string; interaction_type: string; created_at: string | null; created_by_user: { name: string | null } | { name: string | null }[] | null }

export async function loadBenchOrigins(companyIds: readonly string[]): Promise<Record<string, BenchOrigin>> {
  if (companyIds.length === 0) return {}
  try {
    const { data: prospects, error } = await supabase.from('prospects').select('id, converted_gc_company_id').eq('kind', 'sub').in('converted_gc_company_id', [...companyIds])
    if (error || !prospects || prospects.length === 0) return {}
    const rows = prospects as ProspectRow[]
    const { data: comments, error: commentsError } = await supabase
      .from('prospect_comments')
      .select('prospect_id, interaction_type, created_at, created_by_user:users!prospect_comments_created_by_fkey(name)')
      .in('prospect_id', rows.map((p) => p.id))
      .in('interaction_type', ['didnt_answer', 'answered', 'converted'])
    if (commentsError) return {}
    return benchOriginsFrom(
      rows,
      ((comments ?? []) as unknown as CommentRow[]).map((c) => ({
        prospect_id: c.prospect_id,
        interaction_type: c.interaction_type,
        created_at: c.created_at,
        who: Array.isArray(c.created_by_user) ? c.created_by_user[0]?.name ?? null : c.created_by_user?.name ?? null,
      })),
    )
  } catch {
    return {}
  }
}
