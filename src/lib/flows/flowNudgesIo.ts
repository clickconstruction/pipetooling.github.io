/**
 * Follow up's Nudges from the flow, its reads (Messages cut 4, wave 2). Everyone of the three kinds with the rows their
 * flows read (`flow_rows_kind`, helper 6's `loadFlowRowsKind`), then the reads a reminder needs beside them: each standing
 * hold (`nudge_holds`), each reminder sent (`nudge_sent`), the team's notes on a step (`messages` with a `step_key`), the
 * thread's recent lines (`messages`), for quiet days and whose court it is, what we owe them (cut 2's `contact_owed`, an
 * open row a debt) and a customer's page read back (cut 8's `loadCustomerPortalReadBack`). The lead, 2026-10-12: these
 * are office reads, so no definer; if a board of everyone is slow, helper 4 folds them into a batch read. Each person
 * is built by helper 4's `personFlowFrom`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { firstName } from '../contacts/kernel'
import { loadCustomerPortalReadBack } from '../portal/customerPortalViewsIo'
import type { ContactCard, FlowRowsKindAnswer } from './boardRead'
import type { FlowKind } from './facts'
import { loadFlowDef, loadFlowRowsKind } from './flowsIo'
import type { FlowRows } from './load'
import type { PersonFlow } from './nudges'
import { personFlowFrom, type HoldRow, type OwedRow, type PortalReadBackRow, type SentRow, type StepNoteRow, type ThreadLineRow } from './person'
import type { FlowDef } from './state'

// Untyped until the types regenerate after the flows' push.
const db = supabase as unknown as SupabaseClient

/** The kinds a reminder goes to: a number nobody has named has no flow of steps to nudge. */
export const NUDGE_KINDS = ['customer', 'trade', 'arch'] as const satisfies readonly FlowKind[]
export type NudgeKind = (typeof NUDGE_KINDS)[number]

/** The thread's lines read back this far, for quiet days and whose court it is. */
export const LINE_DAYS = 120

/** What the section prints of a person, by contact id. */
export interface NudgePerson {
  name: string
  first: string
  kind: NudgeKind
}

export interface NudgeBatch {
  people: PersonFlow[]
  names: ReadonlyMap<string, NudgePerson>
  /** Each kind's flow, for the steps' names. */
  flows: Readonly<Record<NudgeKind, FlowDef>>
}

/**
 * What the section and the reminder call someone: their first name when the card names a person, else the company, as
 * the boards do ("Text Kerr Electric", never "Text Kerr").
 */
export function nudgeNamesOf(card: Pick<ContactCard, 'name' | 'goes_by' | 'company'>): { name: string; first: string } {
  const person = card.name && card.name !== card.company ? firstName({ name: card.name, goesBy: card.goes_by }) : ''
  const name = card.company || card.name || 'No name yet'
  return { name, first: person || card.company || card.name || 'them' }
}

type Keyed<T> = T & { contact_id: string }

/** The rows of a list for one contact, without its key. */
function byContact<T>(rows: readonly Keyed<T>[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const { contact_id: id, ...rest } = r
    out.set(id, [...(out.get(id) ?? []), rest as unknown as T])
  }
  return out
}

/** A read the batch can do without: an empty list when it fails, so one table behind cannot hide every reminder. */
async function orNone<T>(read: () => Promise<T[] | null>): Promise<T[]> {
  try {
    return (await read()) ?? []
  } catch {
    return []
  }
}

/** Everyone on the three flows, as Follow up's reminders read them. */
export async function loadNudgeBatch(now: Date): Promise<NudgeBatch> {
  const [defs, answers] = await Promise.all([
    Promise.all(NUDGE_KINDS.map((k) => loadFlowDef(k))),
    Promise.all(NUDGE_KINDS.map((k) => loadFlowRowsKind(k))),
  ])
  const flows = Object.fromEntries(NUDGE_KINDS.map((k, i) => [k, defs[i]])) as Record<NudgeKind, FlowDef>
  const entries = NUDGE_KINDS.flatMap((k, i) =>
    Object.entries((answers[i] ?? {}) as FlowRowsKindAnswer)
      .filter(([, e]) => e.contact.kind === k)
      .map(([id, e]) => ({ id, kind: k, entry: e })),
  )
  const ids = entries.map((e) => e.id)
  if (!ids.length) return { people: [], names: new Map(), flows }
  const since = new Date(now.getTime() - LINE_DAYS * 86_400_000).toISOString()
  // Only a customer has a page to read back; a trade partner's and an architect's portal stay unread here.
  const customerIds = entries.flatMap(({ kind, entry }) => (kind === 'customer' && entry.card.customer_id ? [entry.card.customer_id] : []))
  const [holds, sent, notes, lines, owed, readBack] = await Promise.all([
    orNone(() =>
      withSupabaseRetry<Keyed<HoldRow>[]>(
        () => db.from('nudge_holds').select('id, contact_id, step_key, project_id, jobs_ledger_id, until_on, released_at').in('contact_id', ids).is('released_at', null),
        'read the holds',
      ),
    ),
    orNone(() =>
      withSupabaseRetry<Keyed<SentRow>[]>(
        () => db.from('nudge_sent').select('contact_id, step_key, project_id, jobs_ledger_id, sent_at, sent_by').in('contact_id', ids).gte('sent_at', since),
        'read the reminders sent',
      ),
    ),
    orNone(() =>
      withSupabaseRetry<Keyed<StepNoteRow>[]>(
        () => db.from('messages').select('contact_id, step_key, project_id, who_user_id, body, at').in('contact_id', ids).not('step_key', 'is', null),
        'read the notes on steps',
      ),
    ),
    orNone(() =>
      withSupabaseRetry<Keyed<ThreadLineRow>[]>(
        () => db.from('messages').select('contact_id, direction, at').in('contact_id', ids).in('direction', ['in', 'out']).gte('at', since),
        'read the threads',
      ),
    ),
    orNone(() =>
      withSupabaseRetry<OwedRow[]>(() => db.from('contact_owed').select('contact_id, done_at').in('contact_id', ids).is('done_at', null), 'read what we owe'),
    ),
    loadCustomerPortalReadBack(customerIds).catch((): ReadonlyMap<string, PortalReadBackRow> => new Map()),
  ])
  const holdsOf = byContact<HoldRow>(holds)
  const sentOf = byContact<SentRow>(sent)
  const notesOf = byContact<StepNoteRow>(notes)
  const linesOf = byContact<ThreadLineRow>(lines)
  // Each person's own owed rows, with their key, as helper 4's oweFrom reads them.
  const owedOf = new Map<string, OwedRow[]>()
  for (const o of owed) owedOf.set(o.contact_id, [...(owedOf.get(o.contact_id) ?? []), o])
  const names = new Map<string, NudgePerson>()
  const people = entries.map(({ id, kind, entry }) => {
    const { name, first } = nudgeNamesOf(entry.card)
    names.set(id, { name, first, kind })
    return personFlowFrom({
      id,
      first,
      flow: flows[kind],
      rows: entry as unknown as FlowRows,
      now,
      holds: holdsOf.get(id) ?? [],
      sent: sentOf.get(id) ?? [],
      notes: notesOf.get(id) ?? [],
      lines: linesOf.get(id) ?? [],
      owed: owedOf.get(id) ?? [],
      portal: kind === 'customer' && entry.card.customer_id ? (readBack.get(entry.card.customer_id) ?? null) : null,
    })
  })
  return { people, names, flows }
}
