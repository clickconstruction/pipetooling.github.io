/**
 * One person's flow, read and pressed (Messages cut 4's first screens): their contact, their kind's flow, their rows
 * through `flow_rows` (days and marks, for the office), their holds, reminders sent, step notes and thread's last lines,
 * what we owe them (cut 2's `contact_owed`), and the eight presses (`20261012120000_messages_flows.sql`). The hook (`useFlowPerson`) and the smokes read through
 * this one file, so a test mocks it whole.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { flowFromRows, type FlowStepRow } from './editor'
import type { FlowKind } from './facts'
import type { FlowRows } from './load'
import { loadCustomerPortalReadBack } from '../portal/customerPortalViewsIo'
import type { HoldRow, OwedRow, PortalReadBackRow, PressJob, SentRow, StepNoteRow, ThreadLineRow } from './person'
import type { CompanyPaperRow } from '../gc/companyPapers'
import { loadQualifications, type QualificationsOf } from '../hiring/qualificationsIo'
import type { Qualifications } from '../hiring/tradeScale'
import type { CandidateRow } from './candidateLoad'
import { flowFirst } from './nudgeRunInputs'
import type { ResidentialRows } from './residentialLoad'
import { NO_PIPELINE_ROWS, PIPELINE_SELECTS, residentialRowsOf, type PipelineRows } from './residentialRows'
import { SEED_FLOWS } from './seed'
import type { SubPersonRows } from './subOnboardingLoad'
import type { FlowDef } from './state'

/** The contact as the panel names them; `customer_id` is a residential customer's record (v2.6232). */
export type FlowContact = { id: string; kind: FlowKind; name: string | null; goes_by: string | null; team_prospect_id?: string | null; person_id?: string | null; customer_id?: string | null }

export type FlowPersonRead = {
  contact: FlowContact
  flow: FlowDef
  rows: FlowRows
  holds: HoldRow[]
  sent: SentRow[]
  notes: StepNoteRow[]
  lines: ThreadLineRow[]
  /** A customer's page as cut 8 reads it back (`customerPortalViewsIo`); null for anyone else, or when it cannot be read. */
  portal?: PortalReadBackRow | null
  /** What we owe them and have not done (cut 2's `contact_owed`). */
  owed?: OwedRow[]
}

export type { PressJob }

type Answer<T> = { data: T | null; error: unknown }
// The flows' tables and functions are not in the generated types until they regen after the push.
const table = (name: string) => supabase.from(name as never)
const call = <T>(fn: string, args: Record<string, unknown>) => supabase.rpc(fn as never, args as never) as unknown as Promise<Answer<T>>

function check<T>(a: Answer<T>, what: string): T {
  if (a.error) throw new Error(`${what}: ${formatErrorMessage(a.error)}`)
  return a.data as T
}

/** The contact a company's or a customer's window is for: the record's own person (no name of their own). */
export async function findFlowContactId(by: { gcCompanyId?: string | null; customerId?: string | null }): Promise<string | null> {
  const [column, id] = by.gcCompanyId ? ['gc_company_id', by.gcCompanyId] : by.customerId ? ['customer_id', by.customerId] : [null, null]
  if (!column || !id) return null
  const a = (await table('contacts').select('id, name').eq(column, id).order('name', { nullsFirst: true }).limit(1)) as unknown as Answer<{ id: string }[]>
  return check(a, 'Their contact')?.[0]?.id ?? null
}

/** Their kind's flow as the office edited it; the seed's until the flows are on the database. */
export async function readFlowDef(kind: FlowKind): Promise<FlowDef> {
  try {
    const a = (await table('flow_steps').select('*, flows!inner(kind)').eq('flows.kind', kind)) as unknown as Answer<FlowStepRow[]>
    const rows = a.error ? [] : (a.data ?? [])
    return rows.length ? withSeedOnceLane(flowFromRows(kind, rows)) : SEED_FLOWS[kind]
  } catch {
    return SEED_FLOWS[kind]
  }
}

/** Their qualifications, failing soft: a read the table refuses (or a table not yet pushed) leaves the step unmarked and the flow stands. */
async function qualificationsOf(who: QualificationsOf): Promise<Qualifications | null> {
  try {
    return await loadQualifications(who)
  } catch {
    return null
  }
}

/**
 * The sub flow's Once lane (spike, 2026-10-23) lives in the seed until its migration adds the steps to `flow_steps`:
 * a sub flow read from the table without one borrows the seed's, so the thread's side shows it now. Retire with the
 * migration.
 */
function withSeedOnceLane(flow: FlowDef): FlowDef {
  if (flow.kind !== 'sub' || flow.lanes.some((l) => l.lane === 'once')) return flow
  return { ...flow, lanes: [...SEED_FLOWS.sub.lanes.filter((l) => l.lane === 'once'), ...flow.lanes] }
}

/** The reads under way, by contact: two readers at once (the side's panel and cut 3's strip) share one. */
const reading = new Map<string, Promise<FlowPersonRead>>()

/** Everything the panel and the card read for one contact; a second reader while it reads gets the same read. */
export function readFlowPerson(contactId: string): Promise<FlowPersonRead> {
  const under = reading.get(contactId)
  if (under) return under
  const read = readFlowPersonOnce(contactId).finally(() => reading.delete(contactId))
  reading.set(contactId, read)
  return read
}

async function readFlowPersonOnce(contactId: string): Promise<FlowPersonRead> {
  const [contactA, rowsA, holdsA, sentA, notesA, linesA, owedA] = await Promise.all([
    table('contacts').select('id, kind, name, goes_by, team_prospect_id, person_id, customer_id').eq('id', contactId).maybeSingle() as unknown as Promise<Answer<FlowContact>>,
    call<FlowRows>('flow_rows', { p_contact: contactId }),
    table('nudge_holds').select('id, step_key, project_id, jobs_ledger_id, until_on, released_at').eq('contact_id', contactId) as unknown as Promise<Answer<HoldRow[]>>,
    table('nudge_sent').select('step_key, project_id, jobs_ledger_id, sent_at, sent_by').eq('contact_id', contactId) as unknown as Promise<Answer<SentRow[]>>,
    table('messages')
      .select('step_key, project_id, jobs_ledger_id, who_user_id, body, at')
      .eq('contact_id', contactId)
      .not('step_key', 'is', null) as unknown as Promise<Answer<StepNoteRow[]>>,
    table('messages').select('direction, at').eq('contact_id', contactId).order('at', { ascending: false }).limit(50) as unknown as Promise<
      Answer<ThreadLineRow[]>
    >,
    table('contact_owed').select('contact_id, done_at').eq('contact_id', contactId).is('done_at', null) as unknown as Promise<Answer<OwedRow[]>>,
  ])
  const contact = check(contactA, 'Their contact')
  if (!contact) throw new Error('Their contact: not found')
  const rows = check(rowsA, 'Their flow')
  // A candidate's stamps read their row on the Team hiring board (spike); `flow_rows` does not carry it yet.
  if (contact.kind === 'candidate' && contact.team_prospect_id) {
    const board = (await table('team_prospects')
      .select('status, rating_ability, rating_drive, rating_integrity, last_contact, trial_started_at, created_at, updated_at')
      .eq('id', contact.team_prospect_id)
      .maybeSingle()) as unknown as Answer<CandidateRow>
    rows.candidate = check(board, 'Their row on the hiring board')
    rows.qualifications = await qualificationsOf({ teamProspectId: contact.team_prospect_id })
  }
  // A roster sub's Once lane (spike) reads their People record, their papers and their sheets; `flow_rows` carries none of them yet.
  if (contact.kind === 'sub' && contact.person_id) {
    const [personA, papersA, sheetsA] = await Promise.all([
      table('people').select('created_at, archived_at').eq('id', contact.person_id).maybeSingle() as unknown as Promise<Answer<SubPersonRows['person']>>,
      table('person_contract_documents').select('id, company_id, doc_type, status, sent_at, signed_at, expires_at, created_at').eq('person_id', contact.person_id) as unknown as Promise<
        Answer<CompanyPaperRow[]>
      >,
      table('people_labor_job_assignees').select('people_labor_jobs(done_at)').eq('person_id', contact.person_id) as unknown as Promise<Answer<Array<{ people_labor_jobs: { done_at: string | null } | null }>>>,
    ])
    rows.subPerson = {
      person: check(personA, 'Their People record'),
      papers: check(papersA, 'Their papers') ?? [],
      sheets: (check(sheetsA, 'Their sheets') ?? []).flatMap((a) => (a.people_labor_jobs ? [a.people_labor_jobs] : [])),
    }
    rows.qualifications = await qualificationsOf({ personId: contact.person_id })
  }
  // A residential customer's steps read their Pipeline rows (v2.6232): `flow_rows` carries days and marks and never an
  // amount, so their jobs, blocks, clock-ins, reports, estimates, moves, bills, payments and texts are read here.
  if (contact.kind === 'residential') rows.residential = await residentialOf(contact, rows)
  return {
    contact,
    flow: await readFlowDef(contact.kind),
    rows,
    portal: contact.kind === 'customer' ? await portalOf(rows.card?.customer_id ?? null) : null,
    holds: check(holdsA, 'Their holds') ?? [],
    sent: check(sentA, 'Their reminders') ?? [],
    notes: check(notesA, 'Their notes') ?? [],
    lines: check(linesA, 'Their thread') ?? [],
    owed: check(owedA, 'What we owe them') ?? [],
  }
}

/** An RPC the reader may not be allowed, read soft: a refusal or a lost signal leaves it null, and a bill's due day unset. */
async function softCall(fn: string): Promise<unknown> {
  try {
    const a = await call<unknown>(fn, {})
    return a.error ? null : a.data
  } catch {
    return null
  }
}

/**
 * One residential customer's Pipeline rows (`residentialLoad.ts`'s `ResidentialRows`), the columns `PIPELINE_SELECTS`
 * names: the jobs they are the customer on and the ones the office tied to them (`contact_jobs.jobs_ledger_id`),
 * everything on those jobs, their own texts out, and the two pay-day RPCs the Stages tab calls (soft: a role the gate
 * refuses reads no pace, and the bill's due day stays unset). A table the reader may not read fails with its reason.
 */
async function residentialOf(contact: FlowContact, rows: FlowRows): Promise<ResidentialRows> {
  const customerId = contact.customer_id ?? rows.card?.customer_id ?? null
  const jobsRead = (customerId ? table('jobs_ledger').select(PIPELINE_SELECTS.jobs).eq('customer_id', customerId) : Promise.resolve({ data: [], error: null })) as unknown as Promise<Answer<PipelineRows['jobs'][number][]>>
  const [jobsA, tiesA, textsA, paySpeeds, promisedPay] = await Promise.all([
    jobsRead,
    table('contact_jobs').select(PIPELINE_SELECTS.contactJobs).eq('contact_id', contact.id).not('jobs_ledger_id', 'is', null) as unknown as Promise<Answer<PipelineRows['contactJobs'][number][]>>,
    table('messages').select(PIPELINE_SELECTS.texts).eq('contact_id', contact.id).eq('channel', 'text').eq('direction', 'out') as unknown as Promise<Answer<PipelineRows['texts'][number][]>>,
    softCall('get_billed_customer_pay_speeds'),
    softCall('list_job_promised_pay_dates'),
  ])
  const own = check(jobsA, 'Their jobs') ?? []
  const contactJobs = check(tiesA, 'Their jobs') ?? []
  const tiedIds = contactJobs.flatMap((t) => (t.jobs_ledger_id && !own.some((j) => j.id === t.jobs_ledger_id) ? [t.jobs_ledger_id] : []))
  const tied = tiedIds.length ? (check((await table('jobs_ledger').select(PIPELINE_SELECTS.jobs).in('id', tiedIds)) as unknown as Answer<PipelineRows['jobs'][number][]>, 'Their jobs') ?? []) : []
  const jobs = [...own, ...tied]
  const ids = jobs.map((j) => j.id)
  const on = <T>(name: string, select: string, column: string, what: string): Promise<T[]> =>
    ids.length ? (table(name).select(select).in(column, ids) as unknown as Promise<Answer<T[]>>).then((a) => check(a, what) ?? []) : Promise.resolve([])
  const [blocks, clockSessions, reports, estimates, statusEvents, invoices, payments] = await Promise.all([
    on<PipelineRows['blocks'][number]>('job_schedule_blocks', PIPELINE_SELECTS.blocks, 'job_id', 'Their visits'),
    on<PipelineRows['clockSessions'][number]>('clock_sessions', PIPELINE_SELECTS.clockSessions, 'job_ledger_id', 'Their visits'),
    on<PipelineRows['reports'][number]>('reports', PIPELINE_SELECTS.reports, 'job_ledger_id', 'Their reports'),
    on<PipelineRows['estimates'][number]>('estimates', PIPELINE_SELECTS.estimates, 'job_ledger_id', 'Their estimates'),
    on<PipelineRows['statusEvents'][number]>('job_status_events', PIPELINE_SELECTS.statusEvents, 'job_id', 'Their jobs'),
    on<PipelineRows['invoices'][number]>('jobs_ledger_invoices', PIPELINE_SELECTS.invoices, 'job_id', 'Their bills'),
    on<PipelineRows['payments'][number]>('jobs_ledger_payments', PIPELINE_SELECTS.payments, 'job_id', 'Their payments'),
  ])
  return residentialRowsOf(
    { ...NO_PIPELINE_ROWS, jobs, contactJobs, blocks, clockSessions, reports, estimates, statusEvents, invoices, payments, texts: check(textsA, 'Their texts') ?? [], paySpeeds, promisedPay },
    { contact: rows.contact, firstName: flowFirst(contact, rows.card), customerId, userNames: rows.userNames, skips: rows.skips },
  )
}

/** A customer's page, read back; the card goes without it when it cannot be read (the flow itself still reads). */
async function portalOf(customerId: string | null): Promise<PortalReadBackRow | null> {
  if (!customerId) return null
  try {
    return (await loadCustomerPortalReadBack([customerId])).get(customerId) ?? null
  } catch {
    return null
  }
}

/** The press's job as `contact_job_check` takes it: a GC project, a residential customer's Pipeline job (v2.6016), or none on the Once lane. */
const job = (j: PressJob) =>
  j.projectId ? { p_job_kind: 'project', p_job_id: j.projectId } : j.jobsLedgerId ? { p_job_kind: 'pipeline', p_job_id: j.jobsLedgerId } : { p_job_kind: null, p_job_id: null }

/** The presses on a person's place, each as the signed-in user. */
export const flowPresses = {
  addNote: async (contactId: string, stepId: string, at: PressJob, note: string) =>
    check(await call<string>('flow_add_note', { p_contact: contactId, p_step: stepId, ...job(at), p_note: note }), 'Add a note'),
  skip: async (contactId: string, stepId: string, at: PressJob, why: string) =>
    check(await call<string>('flow_skip_step', { p_contact: contactId, p_step: stepId, ...job(at), p_why: why }), 'Skip for them'),
  unskip: async (skipId: string) => check(await call<null>('flow_unskip_step', { p_skip: skipId }), 'Put it back'),
  holdUntil: async (contactId: string, stepId: string, at: PressJob, until: string) =>
    check(await call<string>('nudge_hold_until', { p_contact: contactId, p_step: stepId, ...job(at), p_until: until }), 'Hold until'),
  letGo: async (holdId: string) => check(await call<null>('nudge_let_go', { p_hold: holdId }), 'Let it go'),
  remindNow: async (contactId: string, stepId: string, at: PressJob, how: 'text' | 'call' | 'email', round: string | null) =>
    check(await call<string>('nudge_record_sent', { p_contact: contactId, p_step: stepId, ...job(at), p_round: round, p_how: how, p_message: null }), 'Remind now'),
  setOff: async (contactId: string, why: string) => check(await call<null>('contact_set_off', { p_contact: contactId, p_why: why }), 'Take off the flow'),
  putBackOn: async (contactId: string) => check(await call<null>('contact_put_back_on', { p_contact: contactId }), 'Put back on the flow'),
}
