/**
 * Plan sets by part (punch list #239, PR 2): the reads and writes behind the job window's Plans section,
 * over the tables of migration `20261101210000`. The screen takes this io so its tests run over a fake.
 * Every write is a plain table write under the caller's RLS; the mirror onto `job_plans_link` is the
 * database's own trigger, so nothing here touches the job's old link.
 */
import { supabase } from '../supabase'
import type { NewSetDraft, OtherPart, PlanPartRow, PlanSetRow } from './planSets'

export type JobPlansRead = {
  job: { id: string; plan_part_id: string | null; development_id: string | null; development_name: string | null; job_plans_link: string | null }
  part: PlanPartRow | null
  sets: PlanSetRow[]
  /** The development's parts, every one, so the section can say when another part carries a set. Empty outside a development. */
  developmentParts: OtherPart[]
  /** Names for `current_set_by` and each set's `created_by`. */
  names: Record<string, string>
}

export type AddSetArgs = {
  partId: string
  draft: NewSetDraft
  makeCurrent: boolean
  replacesSetId: string | null
  marksUpSetId: string | null
  /** The job that made it: set on an as-built. */
  jobId: string | null
  userId: string | null
}

export type SitePlansRead = { parts: PlanPartRow[]; sets: PlanSetRow[]; names: Record<string, string> }

export interface JobPlansIo {
  read(jobId: string): Promise<JobPlansRead>
  /** The development's parts and every set on them (PR 3, the site look). */
  readSite(developmentId: string): Promise<SitePlansRead>
  /** A new part on a development, named by the office. */
  makeSitePart(args: { developmentId: string; name: string; position: number; userId: string | null }): Promise<PlanPartRow>
  /** Make the part a job builds from and name it on the job: the job's own part, or one on its development. */
  makePart(args: { jobId: string; developmentId: string | null; name: string; userId: string | null }): Promise<PlanPartRow>
  /** A job inside a development names one of the site's parts. */
  pickPart(jobId: string, partId: string): Promise<void>
  addSet(args: AddSetArgs): Promise<PlanSetRow>
  makeCurrent(partId: string, setId: string, userId: string | null): Promise<void>
  removeSet(setId: string): Promise<void>
  updateMemo(setId: string, memo: string): Promise<void>
  /** What changed from the set before it, written or rewritten on a set already on the part (v2.6356). */
  updateChanges(setId: string, changes: string): Promise<void>
}

const PART_COLS = 'id, development_id, job_id, name, position, current_set_id, current_set_by, current_set_at, created_by, created_at, updated_at'
const SET_COLS = 'id, part_id, name, kind, source, dated, came_at, memo, changes, link, replaces_set_id, marks_up_set_id, job_id, file_name, file_size, file_count, checked_at, check_note, created_by, created_at, updated_at'

function taken<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw r.error
  if (r.data == null) throw new Error(`Could not ${what}.`)
  return r.data as NonNullable<T>
}

export function supabaseJobPlansIo(): JobPlansIo {
  return {
    async read(jobId) {
      const jobRow = taken(
        await supabase.from('jobs_ledger').select('id, plan_part_id, development_id, job_plans_link, development:development_id(id, name)').eq('id', jobId).maybeSingle(),
        'read the job',
      )
      const dev = (Array.isArray(jobRow.development) ? jobRow.development[0] : jobRow.development) as { id: string; name: string | null } | null | undefined
      const job = { id: jobRow.id, plan_part_id: jobRow.plan_part_id, development_id: jobRow.development_id, development_name: dev?.name ?? null, job_plans_link: jobRow.job_plans_link }
      let part: PlanPartRow | null = null
      let sets: PlanSetRow[] = []
      if (job.plan_part_id) {
        const p = await supabase.from('plan_parts').select(PART_COLS).eq('id', job.plan_part_id).maybeSingle()
        if (p.error) throw p.error
        part = (p.data as PlanPartRow | null) ?? null
        if (part) {
          const s = await supabase.from('plan_sets').select(SET_COLS).eq('part_id', part.id).order('came_at', { ascending: false })
          if (s.error) throw s.error
          sets = (s.data ?? []) as PlanSetRow[]
        }
      }
      let developmentParts: OtherPart[] = []
      if (job.development_id) {
        const d = await supabase.from('plan_parts').select('id, name, current_set_id, position').eq('development_id', job.development_id).order('position').order('created_at')
        if (d.error) throw d.error
        developmentParts = (d.data ?? []).map((r) => ({ id: r.id, name: r.name, hasSet: !!r.current_set_id }))
      }
      const ids = new Set<string>()
      if (part?.current_set_by) ids.add(part.current_set_by)
      for (const s of sets) if (s.created_by) ids.add(s.created_by)
      const names: Record<string, string> = {}
      if (ids.size) {
        const u = await supabase.from('users').select('id, name').in('id', [...ids])
        for (const r of u.data ?? []) if (r.name) names[r.id] = r.name
      }
      return { job, part, sets, developmentParts, names }
    },
    async readSite(developmentId) {
      const p = await supabase.from('plan_parts').select(PART_COLS).eq('development_id', developmentId).order('position').order('created_at')
      if (p.error) throw p.error
      const parts = (p.data ?? []) as PlanPartRow[]
      let sets: PlanSetRow[] = []
      if (parts.length) {
        const s = await supabase.from('plan_sets').select(SET_COLS).in('part_id', parts.map((x) => x.id)).order('came_at', { ascending: false })
        if (s.error) throw s.error
        sets = (s.data ?? []) as PlanSetRow[]
      }
      const ids = new Set<string>()
      for (const x of parts) if (x.current_set_by) ids.add(x.current_set_by)
      for (const x of sets) if (x.created_by) ids.add(x.created_by)
      const names: Record<string, string> = {}
      if (ids.size) {
        const u = await supabase.from('users').select('id, name').in('id', [...ids])
        for (const r of u.data ?? []) if (r.name) names[r.id] = r.name
      }
      return { parts, sets, names }
    },
    async makeSitePart({ developmentId, name, position, userId }) {
      const made = taken(await supabase.from('plan_parts').insert({ development_id: developmentId, name: name.trim(), position, created_by: userId }).select(PART_COLS).single(), 'make the part')
      return made as unknown as PlanPartRow
    },
    async makePart({ jobId, developmentId, name, userId }) {
      const row = developmentId ? { development_id: developmentId, name, created_by: userId } : { job_id: jobId, name, created_by: userId }
      const made = taken(await supabase.from('plan_parts').insert(row).select(PART_COLS).single(), 'make the part')
      const named = await supabase.from('jobs_ledger').update({ plan_part_id: made.id }).eq('id', jobId)
      if (named.error) throw named.error
      return made as unknown as PlanPartRow
    },
    async pickPart(jobId, partId) {
      const r = await supabase.from('jobs_ledger').update({ plan_part_id: partId }).eq('id', jobId)
      if (r.error) throw r.error
    },
    async addSet({ partId, draft, makeCurrent, replacesSetId, marksUpSetId, jobId, userId }) {
      const made = taken(
        await supabase
          .from('plan_sets')
          .insert({
            part_id: partId,
            name: draft.name.trim(),
            kind: draft.kind,
            source: draft.source,
            dated: draft.dated || null,
            memo: draft.memo.trim(),
            changes: draft.changes.trim(),
            link: draft.link.trim(),
            replaces_set_id: replacesSetId,
            marks_up_set_id: marksUpSetId,
            job_id: jobId,
            created_by: userId,
          })
          .select(SET_COLS)
          .single(),
        'add the set',
      )
      if (makeCurrent) {
        const r = await supabase.from('plan_parts').update({ current_set_id: made.id, current_set_by: userId, current_set_at: new Date().toISOString() }).eq('id', partId)
        if (r.error) throw r.error
      }
      return made as unknown as PlanSetRow
    },
    async makeCurrent(partId, setId, userId) {
      const r = await supabase.from('plan_parts').update({ current_set_id: setId, current_set_by: userId, current_set_at: new Date().toISOString() }).eq('id', partId)
      if (r.error) throw r.error
    },
    async removeSet(setId) {
      const r = await supabase.from('plan_sets').delete().eq('id', setId)
      if (r.error) throw r.error
    },
    async updateMemo(setId, memo) {
      const r = await supabase.from('plan_sets').update({ memo }).eq('id', setId)
      if (r.error) throw r.error
    },
    async updateChanges(setId, changes) {
      const r = await supabase.from('plan_sets').update({ changes: changes.trim() }).eq('id', setId)
      if (r.error) throw r.error
    },
  }
}
