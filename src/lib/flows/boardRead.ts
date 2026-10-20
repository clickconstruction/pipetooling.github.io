/**
 * The boards' read (Messages cut 4, wave 2): `flow_rows_kind`'s answer, one entry per contact of a kind, turned into
 * the companies Trade partners and Customers draw (`board.ts`) and the job papers window's rows (`jobPapers.ts`).
 * Pure: `useFlowBoard` calls the definer and hands its answer in. Each entry is `flow_rows`' shape (`load.ts`'s
 * `FlowRows`) with a `card` of the names the boards print, since the facts sit behind doors an assistant cannot open.
 */
import { calendarYmdInAppTzFromIso, todayYmdInAppTz, ymdDaysBetween } from '../../utils/dateUtils'
import { firstName } from '../contacts/kernel'
import type { BoardCompany } from './board'
import type { FlowKind } from './facts'
import { gridColumns, type JobPaperCompany } from './jobPapers'
import { flowStampsFor, type FlowRows, type ProjectRow } from './load'
import { flat, paperRead, perJobJobs, placesOf, readFlow, stepReading, type FlowDef, type FlowReading } from './state'

/** What the boards print of a contact. */
export type ContactCard = {
  /** Their name on the record: "Greg Paulk", "Dr. Priya Raman". */
  name: string
  goes_by: string | null
  /** A trade partner's company, a customer's or an architect's firm; null when they are the record. */
  company: string | null
  /** The trades on the company's record. */
  trades: string[]
  /** The records the person's own windows open by: a trade's company, a customer's or an architect's customer. */
  gc_company_id: string | null
  customer_id: string | null
}

/** One contact's entry in `flow_rows_kind`: `flow_rows`' rows, the names, and each project's name. */
export type FlowRowsEntry = Omit<FlowRows, 'projects'> & {
  card: ContactCard
  projects?: readonly (ProjectRow & { name?: string | null })[]
}

/** `flow_rows_kind(p_kind, p_project)`: every contact of a kind, keyed by contact id. */
export type FlowRowsKindAnswer = Readonly<Record<string, FlowRowsEntry>>

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The definer's answer, checked: an entry with no contact is left out, a card missing a field reads empty. */
export function parseFlowRowsKind(raw: unknown): FlowRowsKindAnswer {
  if (!isObject(raw)) return {}
  const out: Record<string, FlowRowsEntry> = {}
  for (const [id, v] of Object.entries(raw)) {
    if (!isObject(v) || !isObject(v.contact) || typeof v.contact.id !== 'string') continue
    const card = isObject(v.card) ? v.card : {}
    out[id] = {
      ...(v as unknown as FlowRowsEntry),
      card: {
        name: str(card.name) ?? '',
        goes_by: str(card.goes_by),
        company: str(card.company),
        trades: Array.isArray(card.trades) ? card.trades.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [],
        gc_company_id: str(card.gc_company_id) ?? (isObject(v.company) ? str(v.company.id) : null),
        customer_id: str(card.customer_id),
      },
    }
  }
  return out
}

/** A board's company from one contact's reading: the places, the Once lane's done steps, and how each job's lane stands. */
export function boardCompanyOf(flow: FlowDef, contactId: string, card: ContactCard, reading: FlowReading): BoardCompany {
  const once = flow.lanes.filter((l) => l.lane !== 'per_job').flatMap((l) => l.steps)
  const jobs = perJobJobs(reading)
  const name = card.company ?? card.name
  const ended = jobs.flatMap((j) => (j.ended ? [[j.jobId, j.ended] as const] : []))
  return {
    contactId,
    name: name || 'No name yet',
    personName: card.company && card.name && card.name !== card.company ? card.name : null,
    // A company with nobody named has no first name: "Remind Kerr Electric", never "Remind Kerr".
    firstName: card.name && card.name !== card.company ? firstName({ name: card.name, goesBy: card.goes_by }) || null : null,
    trades: card.trades,
    jobIds: jobs.map((j) => j.jobId),
    defaultJobId: reading.defaultJobId,
    off: reading.off ? { since: reading.off.since, why: reading.off.why } : null,
    places: placesOf(reading),
    onceDone: once.filter((s) => stepReading(reading, s.id, null)?.state === 'done').map((s) => s.id),
    jobsDone: jobs.filter((j) => j.started && !j.headStepId && !j.ended).map((j) => j.jobId),
    ...(ended.length ? { jobsEnded: Object.fromEntries(ended) } : {}),
  }
}

/** A job papers window's company: the board's company, with each of its flow's papers read for that job. */
export function jobPaperCompanyOf(flow: FlowDef, company: BoardCompany, reading: FlowReading, jobId: string): JobPaperCompany {
  return { ...company, kind: flow.kind, reads: Object.fromEntries(gridColumns(flow).map((c) => [c.paper, paperRead(reading, c.paper, jobId)])) }
}

export interface BoardRead {
  kind: FlowKind
  companies: BoardCompany[]
  /** Each contact's reading, for the step card and the papers window. */
  readings: Readonly<Record<string, FlowReading>>
  /** Every job a company is on, by project id, with its name. */
  jobs: Readonly<Record<string, { name: string }>>
  /** What we call each contact, for "waiting on Jonah". */
  firstNames: Readonly<Record<string, string>>
  /** The records each contact's own windows open by, until the thread window does. */
  refs: Readonly<Record<string, { companyId: string | null; customerId: string | null }>>
}

/** The whole board: each contact read on the flow, A to Z by the name the board prints. */
export function readBoard(flow: FlowDef, answer: FlowRowsKindAnswer, now: Date): BoardRead {
  const companies: BoardCompany[] = []
  const readings: Record<string, FlowReading> = {}
  const jobs: Record<string, { name: string }> = {}
  const firstNames: Record<string, string> = {}
  const refs: Record<string, { companyId: string | null; customerId: string | null }> = {}
  for (const [id, entry] of Object.entries(answer)) {
    if (entry.contact.kind !== flow.kind) continue
    refs[id] = { companyId: entry.card.gc_company_id, customerId: entry.card.customer_id }
    for (const p of entry.projects ?? []) jobs[p.project_id] = { name: str(p.name) ?? jobs[p.project_id]?.name ?? 'A job with no name' }
    const reading = readFlow(flow, flowStampsFor(flow.kind, entry as FlowRows, now), now)
    readings[id] = reading
    const company = boardCompanyOf(flow, id, entry.card, reading)
    if (company.firstName) firstNames[id] = company.firstName
    companies.push(company)
  }
  companies.sort((a, b) => a.name.localeCompare(b.name))
  return { kind: flow.kind, companies, readings, jobs, firstNames, refs }
}

/**
 * `customer_portal_views`' answer (helper 8, cut 8) as each customer's last outside open of their page: the row with
 * no paper. A customer with no such row has never opened it, so is left out.
 */
export function pageOpensByCustomer(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!Array.isArray(raw)) return out
  for (const r of raw) {
    if (!isObject(r) || r.paper_kind != null) continue
    const id = str(r.customer_id)
    const at = str(r.last_opened_at)
    if (id && at && (!out[id] || at > out[id]!)) out[id] = at
  }
  return out
}

/**
 * By company's Portal column. A trade partner's is their Portal opened step: "opened", else "never". A customer's is
 * the last outside open of their page (`customer_portal_views`, the row with no paper): "today", "N d ago", or "never".
 */
export function portalCellWords(flow: FlowDef, reading: FlowReading | undefined, lastOpenedAt: string | null, now: Date = new Date()): string {
  const portalStep = flat(flow).find((s) => s.facts.includes('portal_opened'))
  if (portalStep) return reading && stepReading(reading, portalStep.id, null)?.state === 'done' ? 'opened' : 'never'
  if (!lastOpenedAt) return 'never'
  const days = ymdDaysBetween(calendarYmdInAppTzFromIso(lastOpenedAt), todayYmdInAppTz(now))
  return days == null ? 'never' : days <= 0 ? 'today' : `${days} d ago`
}
