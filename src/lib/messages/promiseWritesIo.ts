/**
 * The write-throughs' hands (punch list #421, PR 4): after a heard day is written on its line (`write_down_heard`), the
 * read that fills `PromiseAt` and the writers `runPromiseWrites` wants, each through the verb its place already has.
 * The kernel (`promiseWrites.ts`) says what goes where and why a write is skipped; this file only reads and writes.
 *
 * The read is the line's job (its name, and whether it is a bid, a GC job or a Pipeline job), the company's open ask on
 * that GC job for a quote, and the flow's standing holds for the person, each soft: a read that fails leaves its piece
 * empty, and the kernel says what was skipped. The writers are the Board's own (`logGcAskContact`,
 * `recordGcTradePromise`), the bid's contact log (`bids_submission_entries`) and the flow's hold (`nudge_hold_until`).
 * A payment never comes here: it is written on the job from #129's sheet. Nothing here rejects: the line's day is
 * already written, so a failure is said in words after it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact } from '../contacts/kernel'
import { logGcAskContact, recordGcTradePromise } from '../gc/gcIo'
import { supabase } from '../supabase'
import { checkSupabaseError, formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { jobRefOf } from './jobKeys'
import { promiseWriteThrough, runPromiseWrites, throughWords, type PromiseAt, type PromiseWriters, type WrittenPromise } from './promiseWrites'
import type { HeardPromiseKind } from './promises'

/** What the press hands over once the line is written. */
export interface HeardThroughInput {
  message: { id: string; channel: string; at: string; jobId: string | null }
  contact: Pick<Contact, 'id' | 'kind' | 'name' | 'goesBy' | 'company' | 'trade' | 'gcCompanyId'>
  kind: HeardPromiseKind
  writes: WrittenPromise['writes']
  ymd: string
  /** The words already written for the line: "Written down. Their quote by Wed Nov 25." */
  written: string
  by: { userId: string; name: string }
  todayYmd: string
  nowIso: string
}

/** An ask still open: asked or opened, not yet quoted or turned down. */
const OPEN_ASK = ['invited', 'opened']

/** The kinds whose write-through is a hold on the flow. */
const HOLD_KINDS: ReadonlySet<string> = new Set(['decision', 'access', 'answer', 'cert'])

/** The line's job by name: a bid's project, a GC job's name, a Pipeline job's name. Null when it cannot be read. */
async function jobNameOf(db: SupabaseClient, ref: ReturnType<typeof jobRefOf>): Promise<string | null> {
  if (!ref) return null
  try {
    if (ref.kind === 'bid') {
      const r = await db.from('bids').select('project_name').eq('id', ref.id).maybeSingle()
      return ((r.data as { project_name: string | null } | null)?.project_name ?? '').trim() || null
    }
    if (ref.kind === 'project') {
      const r = await db.from('projects').select('name').eq('id', ref.id).maybeSingle()
      return ((r.data as { name: string | null } | null)?.name ?? '').trim() || null
    }
    const r = await db.from('jobs_ledger').select('job_name').eq('id', ref.id).maybeSingle()
    return ((r.data as { job_name: string | null } | null)?.job_name ?? '').trim() || null
  } catch {
    return null
  }
}

/** The company's open ask on a GC job, for a quote: the first still asked or opened. Null when there is none. */
async function openAskOf(db: SupabaseClient, companyId: string, projectId: string): Promise<string | null> {
  try {
    const packages = await db.from('gc_trade_packages').select('id').eq('project_id', projectId)
    const ids = ((packages.data ?? []) as { id: string }[]).map((p) => p.id)
    if (packages.error || ids.length === 0) return null
    const invites = await db.from('gc_invites').select('id').eq('company_id', companyId).in('package_id', ids).in('status', OPEN_ASK).limit(1)
    return ((invites.data ?? []) as { id: string }[])[0]?.id ?? null
  } catch {
    return null
  }
}

/** The flow's standing holds for the person on GC jobs, by `${step}|${projectId}`. */
async function holdsOf(db: SupabaseClient, contactId: string): Promise<Record<string, string>> {
  try {
    const r = await db.from('nudge_holds').select('step_key, project_id, until_on').eq('contact_id', contactId).is('released_at', null).not('project_id', 'is', null)
    const out: Record<string, string> = {}
    for (const h of (r.data ?? []) as { step_key: string; project_id: string; until_on: string }[]) {
      const key = `${h.step_key}|${h.project_id}`
      if (!out[key] || out[key]! < h.until_on) out[key] = h.until_on
    }
    return out
  } catch {
    return {}
  }
}

/** Everything the kernel reads for one written line. */
export async function loadPromiseAt(input: HeardThroughInput, client: unknown = supabase): Promise<PromiseAt> {
  const db = client as SupabaseClient
  const ref = jobRefOf(input.message.jobId)
  const projectId = ref?.kind === 'project' ? ref.id : null
  const companyId = input.contact.gcCompanyId ?? null
  const [jobName, askInviteId, holds] = await Promise.all([
    jobNameOf(db, ref),
    input.kind === 'quote' && companyId && projectId ? openAskOf(db, companyId, projectId) : Promise.resolve(null),
    HOLD_KINDS.has(input.kind) ? holdsOf(db, input.contact.id) : Promise.resolve({}),
  ])
  const c = input.contact
  return {
    line: {
      channel: input.message.channel,
      onYmd: calendarYmdInAppTzFromIso(input.message.at) || input.todayYmd,
      bidId: ref?.kind === 'bid' ? ref.id : null,
      projectId,
      jobName,
      pipelineJob: ref?.kind === 'pipeline',
    },
    person: { kind: c.kind, name: c.name, goesBy: c.goesBy, company: c.company || null, trade: c.trade ?? null, contactId: c.id, companyId },
    askInviteId,
    billingJobId: null,
    holds,
    todayYmd: input.todayYmd,
    nowIso: input.nowIso,
    by: { userId: input.by.userId, name: input.by.name, moneyTeam: false },
  }
}

/** Each write through the verb its place already has. */
export function supabasePromiseWriters(byName: string, client: unknown = supabase): PromiseWriters {
  const db = client as SupabaseClient
  return {
    askDay: (w) => logGcAskContact({ companyId: w.companyId, inviteId: w.inviteId, on: w.on, byName, how: w.how, note: w.note, promisedBy: w.promisedBy }),
    tradePromise: (w) => recordGcTradePromise({ companyId: w.companyId, kind: w.promise, projectId: w.projectId, packageId: null, dueOn: w.dueOn, what: w.what }),
    payment: async () => {
      throw new Error('A payment is written on the job from its sheet.')
    },
    bidFollowup: async (w) => {
      checkSupabaseError(await db.from('bids_submission_entries').insert(w.entry), 'set the bid’s follow-up day')
    },
    hold: async (w) => {
      checkSupabaseError(await db.rpc('nudge_hold_until', { p_contact: w.contactId, p_step: w.stepId, p_job_kind: 'project', p_job_id: w.jobId, p_until: w.until }), 'hold the reminder')
    },
  }
}

/**
 * The write-throughs for a line already written, and the words to say after: where each write went, every skip, or a
 * refusal's own words. Never rejects: a read or a write that fails is said, and the line's day stands.
 */
export async function writeHeardThrough(
  input: HeardThroughInput,
  client: unknown = supabase,
  writers: PromiseWriters = supabasePromiseWriters(input.by.name, client),
): Promise<{ words: string; tone: 'success' | 'info' | 'error' }> {
  try {
    const at = await loadPromiseAt(input, client)
    const through = promiseWriteThrough({ kind: input.kind, dayYmd: input.ymd, writes: input.writes }, at)
    const run = await runPromiseWrites(through.writes, writers, (e) => formatErrorMessage(e))
    return throughWords(input.written, run, through.skips)
  } catch (e) {
    return { words: `${input.written} Nothing else was written. ${formatErrorMessage(e)}`, tone: 'info' }
  }
}
