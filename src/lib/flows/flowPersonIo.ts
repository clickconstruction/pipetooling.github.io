/**
 * One person's flow, read and pressed (Messages cut 4's first screens): their contact, their kind's flow, their rows
 * through `flow_rows` (days and marks, for the office), their holds, reminders sent, step notes and thread's last lines,
 * and the eight presses (`20261012120000_messages_flows.sql`). The hook (`useFlowPerson`) and the smokes read through
 * this one file, so a test mocks it whole.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { flowFromRows, type FlowStepRow } from './editor'
import type { FlowKind } from './facts'
import type { FlowRows } from './load'
import type { HoldRow, SentRow, StepNoteRow, ThreadLineRow } from './person'
import { SEED_FLOWS } from './seed'
import type { FlowDef } from './state'

/** The contact as the panel names them. */
export type FlowContact = { id: string; kind: FlowKind; name: string | null; goes_by: string | null }

export type FlowPersonRead = {
  contact: FlowContact
  flow: FlowDef
  rows: FlowRows
  holds: HoldRow[]
  sent: SentRow[]
  notes: StepNoteRow[]
  lines: ThreadLineRow[]
}

/** A press's job: a GC project, or none on the Once lane. */
export type PressJob = { projectId: string | null }

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
    return rows.length ? flowFromRows(kind, rows) : SEED_FLOWS[kind]
  } catch {
    return SEED_FLOWS[kind]
  }
}

/** Everything the panel and the card read for one contact. */
export async function readFlowPerson(contactId: string): Promise<FlowPersonRead> {
  const [contactA, rowsA, holdsA, sentA, notesA, linesA] = await Promise.all([
    table('contacts').select('id, kind, name, goes_by').eq('id', contactId).maybeSingle() as unknown as Promise<Answer<FlowContact>>,
    call<FlowRows>('flow_rows', { p_contact: contactId }),
    table('nudge_holds').select('id, step_key, project_id, until_on, released_at').eq('contact_id', contactId) as unknown as Promise<Answer<HoldRow[]>>,
    table('nudge_sent').select('step_key, project_id, sent_at, sent_by').eq('contact_id', contactId) as unknown as Promise<Answer<SentRow[]>>,
    table('messages')
      .select('step_key, project_id, who_user_id, body, at')
      .eq('contact_id', contactId)
      .not('step_key', 'is', null) as unknown as Promise<Answer<StepNoteRow[]>>,
    table('messages').select('direction, at').eq('contact_id', contactId).order('at', { ascending: false }).limit(50) as unknown as Promise<
      Answer<ThreadLineRow[]>
    >,
  ])
  const contact = check(contactA, 'Their contact')
  if (!contact) throw new Error('Their contact: not found')
  return {
    contact,
    flow: await readFlowDef(contact.kind),
    rows: check(rowsA, 'Their flow'),
    holds: check(holdsA, 'Their holds') ?? [],
    sent: check(sentA, 'Their reminders') ?? [],
    notes: check(notesA, 'Their notes') ?? [],
    lines: check(linesA, 'Their thread') ?? [],
  }
}

const job = (j: PressJob) => (j.projectId ? { p_job_kind: 'project', p_job_id: j.projectId } : { p_job_kind: null, p_job_id: null })

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
