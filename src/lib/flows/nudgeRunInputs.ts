/**
 * Messages, cut 5: everyone's flow for the morning run of the reminders the app sends itself (`messages-nudge-dispatch`),
 * from the rows the run reads set-wise as the service role. The run hands `input` to `planNudgeRun` (`nudgeDispatch.ts`)
 * and sends each text to the number in `channelIds`. Pure.
 *
 * Each person is put together the way their own panel puts them together (`useFlowPerson` → `personFlowFrom`): their
 * kind's flow as the office edited it, or the seed's; their flow rows; their holds, reminders sent and step notes; their
 * thread's newest 50 lines; what we owe them; and a customer's page as cut 8 reads it back. So the run reads a person the
 * way Follow up and the step card read them, and sends only what they would show as due.
 *
 * The owner's switch is `app_settings` `messages_nudge_app_sends_v1`: one key per step id under its kind, `true` to let
 * the app send that step's reminder (`{ "trade": { "portal": true } }`). Anything else is off, and the seed is `{}`, so
 * every step is off until the owner turns one on (`BUILD_PLAN.md` section 7, decision 3). The kinds nest because a step
 * id is unique only within its kind's flow: the sub flow brings `asked`, `onsite` and `yes` again.
 */
import { APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1 } from '../appSettingsKeys'
import { firstName, type ContactKind } from '../contacts/names'
import { billPapers, type Paper, type PaperInvoiceRow, type PaperJobRow, type PaperPaymentRow } from '../messages/papers'
import type { QuickReply, QuickReplyFor, QuickReplyScope } from '../quickReplies/kernel'
import { flowFromRows, type FlowStepRow } from './editor'
import { FLOW_KINDS, contactFlowKindOf, flowContactKind, type FlowKind } from './facts'
import type { FlowCard, FlowRows } from './load'
import type { AppSends, NudgeOffered, NudgeRunInput, NudgeSent, TextNumber } from './nudgeDispatch'
import type { NudgeOptions, PersonFlow } from './nudges'
import { jobOfMark, personFlowFrom, type HoldRow, type OwedRow, type PortalReadBackRow, type SentRow, type StepNoteRow, type ThreadLineRow } from './person'
import { residentialRowsOf, type PipelineRows } from './residentialRows'
import { SEED_FLOWS } from './seed'
import type { FlowDef, NudgeHow } from './state'

/** The `app_settings` key of the owner's switch (`20261014012000_messages_nudge_settings.sql`). */
export const APP_SENDS_SETTING_KEY = APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1

/** How many of a person's newest thread lines their panel reads (`flowPersonIo`), so the run reads the same. */
export const PERSON_LINES = 50

// ---------- the rows, as the run selects them ----------

/**
 * `contacts`: who they are, their contact's kind (never a flow's: a homeowner's is `customer`, and `nudgeRunReads` tells
 * their flow from the card's `customer_type`, v2.6394), Follow up's snooze (set only while `state` is `snoozed`), and a
 * customer's record (v2.6232).
 */
export type RunContactRow = { id: string; kind: ContactKind; name: string | null; goes_by: string | null; snoozed_until: string | null; prefers?: string | null; customer_id?: string | null }
/** `flow_steps` with its flow's kind (`flows(kind)`), as `readFlowDef` reads one kind. */
export type RunStepRow = FlowStepRow & { flows: { kind: string } | null }
export type RunHoldRow = HoldRow & { contact_id: string }
/** `nudge_sent`, with how it went and who sent it. */
export type RunSentRow = SentRow & { contact_id: string; how: NudgeHow; by_user_id: string | null }
export type RunNoteRow = StepNoteRow & { contact_id: string }
/** A `messages` line: whose it is, when, and the number or address it came or went on. */
export type RunLineRow = ThreadLineRow & { contact_id: string; channel_id: string | null }
/** `contact_channels`: a number or an address, and when a number sent STOP. */
export type RunChannelRow = {
  id: string
  contact_id: string
  kind: 'phone' | 'email'
  value: string
  opted_out_at: string | null
  created_at: string
  /** When the office made it their usual (punch list #118, v2.6699); the run reads it first. Unset from an older read. */
  usual_at?: string | null
}
/** `quick_replies`. */
export type RunQuickReplyRow = {
  id: string
  text: string
  for_kind: QuickReplyFor
  step_key: string | null
  scope: QuickReplyScope
  added_by: string | null
  added_at: string
  removed_at: string | null
}
/** `quick_reply_uses`: one press. */
export type RunQuickReplyUseRow = { quick_reply_id: string; user_id: string | null }
/** An open `nudge_offers` row (v2.5595): a text waiting on Today's sends, so the run never prepares a second. */
export type RunOfferRow = { contact_id: string; step_key: string; bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }
/** `jobs_ledger`, as the reply box's paper read selects it (`messages/papersIo.ts`), with whose job it is. */
export type RunBillJobRow = PaperJobRow & { customer_id: string | null }
/**
 * The residential customers' bills (punch list #124, v2.6224): their Pipeline jobs, every bill on them and every payment,
 * what `billPapers` needs to say which bill is open and what is left on it, the way the reply box does at a press.
 */
export interface RunBillRows {
  jobs: readonly RunBillJobRow[]
  invoices: readonly PaperInvoiceRow[]
  payments: readonly PaperPaymentRow[]
}

export interface NudgeRunRows {
  contacts: readonly RunContactRow[]
  /** `flow_rows_for(ids)`: each contact's rows, by contact id. */
  flowRows: Readonly<Partial<Record<string, FlowRows>>>
  steps: readonly RunStepRow[]
  holds: readonly RunHoldRow[]
  sent: readonly RunSentRow[]
  notes: readonly RunNoteRow[]
  /** Their thread's lines, any number of them: each person's newest `PERSON_LINES` are read. */
  lines: readonly RunLineRow[]
  owed: readonly OwedRow[]
  channels: readonly RunChannelRow[]
  quickReplies: readonly RunQuickReplyRow[]
  uses?: readonly RunQuickReplyUseRow[]
  /** A customer's page as cut 8 reads it back, by customer id. */
  portals?: Readonly<Partial<Record<string, PortalReadBackRow>>>
  /** A customer's live portal link, by customer id, when the run can give one. */
  customerLinks?: Readonly<Partial<Record<string, string>>>
  /** The switch's `app_settings` `value_text` as stored, or its value already parsed. */
  appSends: unknown
  /** The texts waiting on Today's sends (`nudge_offers`, open), when the run reads them. */
  offers?: readonly RunOfferRow[]
  /**
   * The residential customers' Pipeline rows, everyone's at once (v2.6232, `residentialRows.ts`), when the run reads
   * them: each residential contact's are cut out by their customer id and contact id, and their steps read from them.
   */
  pipeline?: PipelineRows
  /** The residential customers' jobs, bills and payments, when the run reads them, for `{amount}` and `{bill}` (v2.6224). */
  bills?: RunBillRows
}

/** A text number with the `contact_channels` row the send writes the line on. */
export type RunNumber = TextNumber & { channelId: string | null }

export interface NudgeRunReads {
  input: NudgeRunInput
  /** The number each text goes to, by contact. */
  channelIds: Partial<Record<string, string>>
  /**
   * Contacts whose flow rows did not come back, whose kind has no flow, or whose flow did not read, for the run's log.
   * The run leaves them out and goes on with everyone else.
   */
  unread: string[]
}

/**
 * The contacts the morning reads, and the GC customers it holds (v2.6394). A contact's flow is their kind's, and the
 * residential one for a `customer` contact whose customers row says residential, told from the card `flow_rows_for`
 * carries (`contactFlowKindOf`). A customer contact on the GC customer flow is held: the run cannot read their page yet,
 * so the function leaves them out of `nudgeRunReads` and the summary counts them (*Customers wait until the run can read
 * their page*). A homeowner whose card has no `customer_type` yet (the client deployed before the migration's push) is
 * held the same way, so nothing new goes before the push. Everyone else runs as before.
 */
export function runContactsOf<C extends Pick<RunContactRow, 'id' | 'kind'>>(contacts: readonly C[], flowRows: Readonly<Partial<Record<string, Pick<FlowRows, 'card'>>>>): { run: C[]; customersHeld: number } {
  const run: C[] = []
  let customersHeld = 0
  for (const c of contacts) {
    if (contactFlowKindOf(c.kind, flowRows[c.id]?.card?.customer_type) === 'customer') customersHeld++
    else run.push(c)
  }
  return { run, customersHeld }
}

// ---------- the pieces ----------

/** The stored text read as JSON; null when it does not read. */
const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * The owner's switch as stored (`value_text`, or its value already parsed): only a `true` (sends) or an `'offer'`
 * (offers, v2.5595) under a known kind and a step id turns a step on. Text that does not read as JSON is off for every
 * step.
 */
export function appSendsFrom(stored: unknown): AppSends {
  const out: AppSends = {}
  const value = typeof stored === 'string' ? parsed(stored) : stored
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const kind of FLOW_KINDS) {
    const steps = (value as Record<string, unknown>)[kind]
    if (!steps || typeof steps !== 'object' || Array.isArray(steps)) continue
    const on = Object.entries(steps as Record<string, unknown>).filter(([, v]) => v === true || v === 'offer')
    if (on.length) out[kind] = Object.fromEntries(on.map(([id, v]) => [id, v === 'offer' ? 'offer' : true]))
  }
  return out
}

/**
 * Each customer's bills as the reply box offers them, by customer id: the open ones first, the newest billed first
 * (`billPapers`, the box's own kernel). A customer with no bill has no entry. The jobs, bills and payments are each
 * customer's own, so a bill never reads another customer's payments.
 */
export function billPapersByCustomer(bills: RunBillRows): Map<string, Paper[]> {
  const out = new Map<string, Paper[]>()
  const jobsByCustomer = new Map<string, RunBillJobRow[]>()
  for (const j of bills.jobs) {
    if (!j.customer_id) continue
    const list = jobsByCustomer.get(j.customer_id) ?? []
    list.push(j)
    jobsByCustomer.set(j.customer_id, list)
  }
  for (const [customerId, jobs] of jobsByCustomer) {
    const ids = new Set(jobs.map((j) => j.id))
    const papers = billPapers({ jobs, invoices: bills.invoices.filter((i) => ids.has(i.job_id)), payments: bills.payments.filter((p) => p.job_id != null && ids.has(p.job_id)) })
    if (papers.length) out.set(customerId, papers)
  }
  return out
}

/** The texts waiting on Today's sends, by person, step and job. */
export function offeredFrom(rows: readonly RunOfferRow[]): NudgeOffered[] {
  return rows.map((r) => ({ contactId: r.contact_id, stepId: r.step_key, jobId: r.bid_id ?? r.project_id ?? r.jobs_ledger_id ?? null }))
}

/** Each kind's flow as the office edited it, or the seed's for a kind with no steps on the database (`readFlowDef`). */
export function flowsByKind(steps: readonly RunStepRow[]): Record<FlowKind, FlowDef> {
  const out = {} as Record<FlowKind, FlowDef>
  for (const kind of FLOW_KINDS) {
    const rows = steps.filter((s) => s.flows?.kind === kind)
    out[kind] = rows.length ? flowFromRows(kind, rows) : SEED_FLOWS[kind]
  }
  return out
}

/** What we call them on their flow: the name they go by, else their first name, else their company, else "them". */
export function flowFirst(contact: { kind: ContactKind | FlowKind; name: string | null; goes_by: string | null }, card: FlowCard | null | undefined): string {
  const first = firstName({ name: contact.name ?? card?.name ?? '', goesBy: contact.goes_by ?? card?.goes_by ?? null, kind: flowContactKind(contact.kind) })
  return first || card?.company || 'them'
}

/** A person's newest lines, as many as their panel reads. */
export function newestLines<T extends ThreadLineRow>(lines: readonly T[], n = PERSON_LINES): T[] {
  return [...lines].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, n)
}

/**
 * The number a reminder goes to: of their numbers that never sent STOP, the usual the office starred (punch list
 * #118, the newest star when two meet), else the one their thread last carried a line on, else the first added. With
 * every number stopped, the newest of them, so the run says it was stopped. With none, no number. An address is never
 * a text number. The same order as `replyRecipient`'s (`messages/compose.ts`), so the thread, the sheets and the
 * morning run agree.
 */
export function textNumberOf(channels: readonly RunChannelRow[], lines: readonly RunLineRow[] = []): RunNumber {
  const phones = channels.filter((c) => c.kind === 'phone')
  if (!phones.length) return { number: null, optedOut: false, channelId: null }
  const open = phones.filter((c) => !c.opted_out_at)
  if (!open.length) {
    const last = [...phones].sort((a, b) => (a.opted_out_at! < b.opted_out_at! ? 1 : -1))[0]!
    return { number: last.value, optedOut: true, channelId: last.id }
  }
  const usual = open.filter((c) => c.usual_at).sort((a, b) => (a.usual_at! < b.usual_at! ? 1 : -1))[0]
  if (usual) return { number: usual.value, optedOut: false, channelId: usual.id }
  const lastOn = (id: string) => lines.reduce((t, l) => (l.channel_id === id && l.at > t ? l.at : t), '')
  const pick = [...open].sort((a, b) => {
    const la = lastOn(a.id)
    const lb = lastOn(b.id)
    if (la !== lb) return la < lb ? 1 : -1
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id.localeCompare(b.id)
  })[0]!
  return { number: pick.value, optedOut: false, channelId: pick.id }
}

/**
 * A trade partner's live page from the office's preview of it (`flow_rows`' `previewPath`, `/t/<token>?preview=1`):
 * the same page without the preview mark, on the app's address. Anything else gives no link.
 */
export function portalLinkOf(previewPath: string | null | undefined, origin: string): string | null {
  if (!previewPath || !previewPath.startsWith('/t/')) return null
  const url = new URL(previewPath, 'https://app.invalid')
  url.searchParams.delete('preview')
  const base = origin.replace(/\/+$/, '')
  if (!base) return null
  return `${base}${url.pathname}${url.search}`
}

/** The team's quick replies, as the strip reads them. The app has no lines of its own, so a line marked mine is left out. */
export function quickRepliesFrom(rows: readonly RunQuickReplyRow[], uses: readonly RunQuickReplyUseRow[] = []): QuickReply[] {
  const counts = new Map<string, Record<string, number>>()
  for (const u of uses) {
    const byUser = counts.get(u.quick_reply_id) ?? {}
    const who = u.user_id ?? ''
    byUser[who] = (byUser[who] ?? 0) + 1
    counts.set(u.quick_reply_id, byUser)
  }
  return rows
    .filter((r) => r.scope === 'team')
    .map((r) => ({
      id: r.id,
      text: r.text,
      for: r.for_kind,
      stepId: r.step_key,
      scope: r.scope,
      addedBy: r.added_by ?? '',
      addedAt: Date.parse(r.added_at),
      removed: r.removed_at != null,
      uses: counts.get(r.id) ?? {},
      lastUsed: null,
    }))
}

/** The reminders sent, as the run reads them: the job is the GC project or the Pipeline job, as the marks read it (`marksFrom`). */
export function nudgeSentFrom(rows: readonly RunSentRow[]): NudgeSent[] {
  return rows.map((r) => ({
    contactId: r.contact_id,
    stepId: r.step_key,
    jobId: jobOfMark(r),
    at: r.sent_at,
    by: r.sent_by === 'app' ? 'app' : (r.by_user_id ?? 'person'),
    how: r.how,
  }))
}

// ---------- the run's input ----------

const byContact = <T extends { contact_id: string }>(rows: readonly T[]): Map<string, T[]> => {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const list = out.get(r.contact_id) ?? []
    list.push(r)
    out.set(r.contact_id, list)
  }
  return out
}

/** Everyone's flow and everything `planNudgeRun` reads, from the morning's rows. */
/**
 * `walkKitContactId` (punch list #142 PR 6): the walk kit's contact, left out of the morning entirely while a walk is
 * set up, so the run never texts or offers a reminder to the company's own number. Not counted as unread.
 */
export function nudgeRunReads(rows: NudgeRunRows, now: Date, opts: { origin: string; options?: NudgeOptions; walkKitContactId?: string | null }): NudgeRunReads {
  const flows = flowsByKind(rows.steps)
  const holds = byContact(rows.holds)
  const sent = byContact(rows.sent)
  const notes = byContact(rows.notes)
  const lines = byContact(rows.lines)
  const channels = byContact(rows.channels)
  const people: PersonFlow[] = []
  const numbers: Partial<Record<string, TextNumber>> = {}
  const channelIds: Partial<Record<string, string>> = {}
  const links: Partial<Record<string, string>> = {}
  const snoozed: Partial<Record<string, string>> = {}
  const prefers: NonNullable<NudgeRunInput['prefers']> = {}
  const papers: NonNullable<NudgeRunInput['papers']> = {}
  const billsByCustomer = rows.bills ? billPapersByCustomer(rows.bills) : null
  const unread: string[] = []
  for (const contact of rows.contacts) {
    if (opts.walkKitContactId && contact.id === opts.walkKitContactId) continue
    const flowRows = rows.flowRows[contact.id]
    // Their flow is their contact's kind's, and the residential one for a customer contact whose customers row says
    // residential, read from the card (v2.6394, `runContactsOf` holds the GC customers before this read).
    const kind = contactFlowKindOf(contact.kind, flowRows?.card?.customer_type)
    const flow = flows[kind]
    if (!flowRows || !flow) {
      unread.push(contact.id)
      continue
    }
    const theirLines = lines.get(contact.id) ?? []
    // A residential contact's record is on the contact itself; `flow_rows` names a customer's and an architect's on the card.
    const customerId = flowRows.card?.customer_id ?? contact.customer_id ?? null
    const first = flowFirst(contact, flowRows.card)
    // One person whose flow does not read is left out and counted, never the whole morning (2026-11-03).
    let person: PersonFlow
    try {
      // A residential customer's steps read their Pipeline rows (v2.6232), cut from everyone's as their own panel reads them.
      const rowsOf =
        kind === 'residential' && rows.pipeline
          ? { ...flowRows, residential: residentialRowsOf(rows.pipeline, { contact: flowRows.contact, firstName: first, customerId, userNames: flowRows.userNames, skips: flowRows.skips }) }
          : flowRows
      person = personFlowFrom({
        id: contact.id,
        first,
        flow,
        rows: rowsOf,
        now,
        holds: holds.get(contact.id) ?? [],
        sent: sent.get(contact.id) ?? [],
        notes: notes.get(contact.id) ?? [],
        lines: newestLines(theirLines),
        owed: rows.owed,
        portal: kind === 'customer' && customerId ? (rows.portals?.[customerId] ?? null) : null,
      })
    } catch {
      unread.push(contact.id)
      continue
    }
    people.push(person)
    const number = textNumberOf(channels.get(contact.id) ?? [], theirLines)
    numbers[contact.id] = { number: number.number, optedOut: number.optedOut }
    if (number.channelId && !number.optedOut) channelIds[contact.id] = number.channelId
    const link = kind === 'customer' ? (customerId ? rows.customerLinks?.[customerId] : null) : portalLinkOf(flowRows.previewPath, opts.origin)
    if (link) links[contact.id] = link
    if (contact.snoozed_until) snoozed[contact.id] = contact.snoozed_until
    if (contact.prefers === 'text' || contact.prefers === 'email' || contact.prefers === 'either') prefers[contact.id] = contact.prefers
    // A residential customer's bills, for the Paid reminder's {amount} and {bill} (v2.6224); the box reads them by the customer too.
    const bills = kind === 'residential' && customerId ? billsByCustomer?.get(customerId) : undefined
    if (bills?.length) papers[contact.id] = bills
  }
  return {
    input: {
      people,
      now,
      appSends: appSendsFrom(rows.appSends),
      sent: nudgeSentFrom(rows.sent),
      numbers,
      quickReplies: quickRepliesFrom(rows.quickReplies, rows.uses),
      links,
      options: opts.options,
      snoozed,
      offered: offeredFrom(rows.offers ?? []),
      prefers,
      papers,
    },
    channelIds,
    unread,
  }
}
