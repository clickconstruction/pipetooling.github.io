/**
 * The By person look's own read: the trail of changes that are not ledger rows. A box retired, brought
 * back or edited (`job_container_changes`), a box renamed (`job_container_names`) and a part tie or a
 * site price taken off (`on_site_removed_answers`), over one site's boxes and jobs. Read when the look
 * opens, never with the desk. Each table answers by its own RLS, so a row the reader may not see is
 * simply not there. Throws the database's own error, for the caller to word.
 */
import { supabase } from '../supabase'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import type { BoxChange, BoxRename, RemovedAnswer } from './sitePersonActs'

export type SiteTrail = { boxChanges: BoxChange[]; boxRenames: BoxRename[]; removedAnswers: RemovedAnswer[] }
export type SiteTrailReader = (input: { siteId: string; jobIds: ReadonlyArray<string>; containerIds: ReadonlyArray<string> }) => Promise<SiteTrail>

type ChangeRow = { id: string; container_id: string; what: BoxChange['what']; old_value: string; new_value: string; by_name: string; at: string }
type NameRow = { id: string; container_id: string; old_label: string; new_label: string; by_name: string; at: string }
type RemovedRow = { id: string; answer: 'tie' | 'price'; job_id: string | null; was: Record<string, unknown> | null; by_name: string; at: string }

// The generated types learn these two tables at the regeneration after the push.
const changes = () => supabase.from('job_container_changes' as never)
const removed = () => supabase.from('on_site_removed_answers' as never)

const REMOVED_COLS = 'id, answer, job_id, was, by_name, at'
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** What a removed answer said, from the row as it stood: the two names of a tie, or a price's row and its dollars. */
export function removedAnswerWords(answer: 'tie' | 'price', was: Record<string, unknown> | null): string {
  if (!was) return ''
  if (answer === 'tie') {
    const a = text(was.a_name)
    const b = text(was.b_name)
    const pair = a && b ? `${a} and ${b}` : a || b
    return was.verdict === 'different' && pair ? `${pair}, kept apart` : pair
  }
  const name = text(was.row_name)
  if (was.kind === 'left_out') return name ? `${name}, left out` : 'a row left out'
  const price = typeof was.unit_price === 'number' ? was.unit_price : Number(was.unit_price)
  if (!name || was.unit_price == null || !Number.isFinite(price)) return name
  const dollars = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return name + ', $' + dollars
}

export const fetchSiteTrail: SiteTrailReader = async ({ siteId, jobIds, containerIds }) => {
  const boxes = [...new Set(containerIds)]
  const jobs = [...new Set(jobIds)]
  const paged = { parallel: 4 }
  const bySiteRead = async (): Promise<RemovedRow[]> => {
    const { data, error } = await removed().select(REMOVED_COLS).eq('development_id', siteId).order('at', { ascending: false }).limit(500)
    if (error) throw error
    return (data ?? []) as unknown as RemovedRow[]
  }
  const [changeRows, nameRows, bySite, byJob] = await Promise.all([
    boxes.length === 0 ? [] : fetchAllRowsChunkedIn(boxes, (chunk, from, to) => changes().select('id, container_id, what, old_value, new_value, by_name, at').in('container_id', chunk).order('id').range(from, to), 'box changes', paged),
    boxes.length === 0 ? [] : fetchAllRowsChunkedIn(boxes, (chunk, from, to) => supabase.from('job_container_names').select('id, container_id, old_label, new_label, by_name, at').in('container_id', chunk).order('id').range(from, to), 'box names', paged),
    bySiteRead(),
    jobs.length === 0 ? [] : fetchAllRowsChunkedIn(jobs, (chunk, from, to) => removed().select(REMOVED_COLS).in('job_id', chunk).order('id').range(from, to), 'answers taken off', paged),
  ])
  return {
    boxChanges: (changeRows as unknown as ChangeRow[]).map((r) => ({ id: r.id, containerId: r.container_id, what: r.what, oldValue: r.old_value ?? '', newValue: r.new_value ?? '', byName: r.by_name ?? '', at: r.at })),
    boxRenames: (nameRows as unknown as NameRow[]).map((r) => ({ id: r.id, containerId: r.container_id, oldLabel: r.old_label, newLabel: r.new_label, byName: r.by_name ?? '', at: r.at })),
    removedAnswers: [...bySite, ...(byJob as unknown as RemovedRow[])].map((r) => ({ id: r.id, answer: r.answer, jobId: r.job_id, words: removedAnswerWords(r.answer, r.was), byName: r.by_name ?? '', at: r.at })),
  }
}
