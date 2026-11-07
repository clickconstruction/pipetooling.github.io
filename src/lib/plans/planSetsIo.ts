/**
 * Plan sets by part (punch list #239, PR 2): the reads and writes behind the job window's Plans section,
 * over the tables of migration `20261101210000`. The screen takes this io so its tests run over a fake.
 * Every write is a plain table write under the caller's RLS; the mirror onto `job_plans_link` is the
 * database's own trigger, so nothing here touches the job's old link.
 */
import { supabase } from '../supabase'
import type { NewSetDraft, OtherPart, PlanPartRow, PlanSetRow } from './planSets'
import { PAPER_KINDS, type PaperDraft, type PaperRequest } from '../papers/papers'
import { askRow, type AskLane } from '../developments/ask'
import { sendAsk } from '../developments/askWrites'

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

export type PapersRead = { rows: PlanSetRow[]; requests: PaperRequest[] }

export type KeepPaperArgs = {
  partId: string
  draft: PaperDraft
  owed: boolean
  /** The job it is kept on, with its label for the question's words; null when kept on the site. */
  jobId: string | null
  jobLabel: string | null
  /** The development the part is on (or the job's), for the question; null for a job outside any development. */
  developmentId: string | null
  siteName: string
  userId: string | null
}

export interface JobPlansIo {
  read(jobId: string): Promise<JobPlansRead>
  /** The papers on these parts and the questions they raised (the papers train). */
  readPapers(partIds: ReadonlyArray<string>): Promise<PapersRead>
  /** Keep a paper, asking its question first when it has one; the History line is the database's trigger. */
  keepPaper(args: KeepPaperArgs): Promise<PlanSetRow>
  /** An owed paper came: the link lands and owed clears. */
  markPaperCame(setId: string, link: string): Promise<void>
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
  /** A paper onto another part of the site (v2.6632): the set it went with stays behind, so it goes on the new part itself. */
  movePaper(setId: string, partId: string): Promise<void>
  updateMemo(setId: string, memo: string): Promise<void>
  /** What changed from the set before it, written or rewritten on a set already on the part (v2.6356). */
  updateChanges(setId: string, changes: string): Promise<void>
}

const PART_COLS = 'id, development_id, job_id, name, position, current_set_id, current_set_by, current_set_at, created_by, created_at, updated_at'
const SET_COLS = 'id, part_id, name, kind, source, dated, came_at, memo, link, replaces_set_id, marks_up_set_id, job_id, file_name, file_size, file_count, checked_at, check_note, owed, ask_lane, ask_request_id, created_by, created_at, updated_at'

function taken<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw r.error
  if (r.data == null) throw new Error(`Could not ${what}.`)
  return r.data as NonNullable<T>
}

/**
 * A read takes a set's row whole: a client deployed ahead of its migration's push still reads, and a column the ledger
 * lacks yet (v2.6356's `changes`) is simply absent, where a named column would have PostgREST refuse the read with a 400.
 */
const SET_READ = '*'

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
          const s = await supabase.from('plan_sets').select(SET_READ).eq('part_id', part.id).order('came_at', { ascending: false })
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
    async readPapers(partIds) {
      if (partIds.length === 0) return { rows: [], requests: [] }
      const s = await supabase.from('plan_sets').select(SET_COLS).in('part_id', [...partIds]).in('kind', PAPER_KINDS.map((k) => k.kind)).order('came_at', { ascending: false })
      if (s.error) throw s.error
      const rows = (s.data ?? []) as PlanSetRow[]
      const est = rows.filter((r) => r.ask_lane === 'estimators' && r.ask_request_id).map((r) => r.ask_request_id as string)
      const dis = rows.filter((r) => r.ask_lane === 'dispatch' && r.ask_request_id).map((r) => r.ask_request_id as string)
      const requests: PaperRequest[] = []
      if (est.length) {
        const r = await supabase.from('estimator_requests').select('id, title, status, created_at, closed_at, closed_note').in('id', est)
        for (const x of r.data ?? []) requests.push({ ...(x as Omit<PaperRequest, 'lane'>), lane: 'estimators' })
      }
      if (dis.length) {
        const r = await supabase.from('dispatch_requests').select('id, title, status, created_at, closed_at, closed_note').in('id', dis)
        for (const x of r.data ?? []) requests.push({ ...(x as Omit<PaperRequest, 'lane'>), lane: 'dispatch' })
      }
      return { rows, requests }
    },
    async keepPaper({ partId, draft, owed, jobId, jobLabel, developmentId, siteName, userId }) {
      let askLane: AskLane | null = null
      let askId: string | null = null
      if ((draft.asks || owed) && draft.askWords.trim() && userId) {
        askLane = draft.askLane
        const about = jobId ? { kind: 'job' as const, id: jobId, label: jobLabel ?? 'the job' } : { kind: 'site' as const }
        const sent = await sendAsk(askLane, askRow({ lane: askLane, about, title: draft.askWords.trim() }, developmentId, siteName, userId))
        askId = sent.id
      }
      const made = taken(
        await supabase
          .from('plan_sets')
          .insert({
            part_id: partId,
            name: draft.name.trim(),
            kind: draft.kind,
            source: draft.from,
            dated: null,
            came_at: `${draft.cameOn}T12:00:00`,
            memo: draft.memo.trim(),
            link: owed ? '' : draft.link.trim(),
            marks_up_set_id: draft.goesWithSetId,
            replaces_set_id: draft.replacesPaperId,
            job_id: jobId,
            owed,
            ask_lane: askLane,
            ask_request_id: askId,
            created_by: userId,
          })
          .select(SET_COLS)
          .single(),
        'keep the paper',
      )
      return made as unknown as PlanSetRow
    },
    async markPaperCame(setId, link) {
      const r = await supabase.from('plan_sets').update({ owed: false, link: link.trim(), came_at: new Date().toISOString() }).eq('id', setId)
      if (r.error) throw r.error
    },
    async readSite(developmentId) {
      const p = await supabase.from('plan_parts').select(PART_COLS).eq('development_id', developmentId).order('position').order('created_at')
      if (p.error) throw p.error
      const parts = (p.data ?? []) as PlanPartRow[]
      let sets: PlanSetRow[] = []
      if (parts.length) {
        const s = await supabase.from('plan_sets').select(SET_READ).in('part_id', parts.map((x) => x.id)).order('came_at', { ascending: false })
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
      const changes = (draft.changes ?? '').trim()
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
            // Sent only when written, so a set with none still saves while the column's push is minutes behind the deploy.
            ...(changes ? { changes } : {}),
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
    async movePaper(setId, partId) {
      const r = await supabase.from('plan_sets').update({ part_id: partId, marks_up_set_id: null }).eq('id', setId)
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
