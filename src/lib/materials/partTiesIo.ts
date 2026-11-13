/**
 * Same part? (punch list #330, PR 3): the read and the two writes of `on_site_part_ties`
 * (migration 20261113040000). A site's answers are few, so one read holds them all. The rules
 * are the table's own: who may read is the on-site gate, who may answer is the roles that read
 * the desk with its money, and an answer is undone by deleting its row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import type { PartTie, TieVerdict } from './partTies'

// The table is younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

/** Where an answer belongs: a site (a development), or one job that is on no site. */
export type TieScope = { developmentId: string } | { jobId: string }

type Row = { id: string; a_key: string; b_key: string; a_name: string; b_name: string; verdict: TieVerdict; by_name: string; at: string }
const COLS = 'id, a_key, b_key, a_name, b_name, verdict, by_name, at'
const tieOf = (r: Row): PartTie => ({ id: r.id, aKey: r.a_key, bKey: r.b_key, aName: r.a_name, bName: r.b_name, verdict: r.verdict, byName: r.by_name, at: r.at })

export async function fetchPartTies(scope: TieScope): Promise<PartTie[]> {
  // Paged (v2.7160): `.limit(2000)` was cut at PostgREST's 1,000 rows without a word.
  const rows = await fetchAllRows<Row>((from, to) => {
    const q = db.from('on_site_part_ties').select(COLS)
    return ('developmentId' in scope ? q.eq('development_id', scope.developmentId) : q.eq('job_id', scope.jobId)).order('at').order('id').range(from, to)
  }, 'read the names joined here')
  return rows.map(tieOf)
}

export async function insertPartTie(scope: TieScope, tie: { aKey: string; bKey: string; aName: string; bName: string; verdict: TieVerdict }, byName: string): Promise<PartTie> {
  const { data, error } = await db
    .from('on_site_part_ties')
    .insert({
      ...('developmentId' in scope ? { development_id: scope.developmentId } : { job_id: scope.jobId }),
      a_key: tie.aKey,
      b_key: tie.bKey,
      a_name: tie.aName.slice(0, 200),
      b_name: tie.bName.slice(0, 200),
      verdict: tie.verdict,
      by_name: byName.slice(0, 120),
    })
    .select(COLS)
    .single()
  if (error) throw error
  return tieOf(data as Row)
}

export async function deletePartTie(id: string): Promise<void> {
  const { error } = await db.from('on_site_part_ties').delete().eq('id', id)
  if (error) throw error
}
