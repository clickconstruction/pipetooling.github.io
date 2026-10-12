/**
 * Messages, cut 8c: the trade partner's first page, *Where you are with Click Construction*, first on its portal's home.
 * It reads the company's trade flow rows (`gc-trade-portal`'s `flow`, built by `_shared/gcTradeFlow.ts`) with the flow's
 * own kernels: `flowStampsFor`, `readFlow`, `portalLanes`, then `portalPage`. The flow is the seed's until the flows
 * editor keeps the office's.
 *
 * - Where a press lands: a step on a job opens the job; a paper of the company's own (the master agreement, the W-9,
 *   the certificate) opens its line in Paperwork, as Needs you did.
 * - Which of Needs you's to-dos the page now carries, so none shows twice: the master agreement, the W-9, the
 *   certificate, a quote due or late, a statement of work to sign, a draw to ask for and the final waiver. Each leaves
 *   Needs you only while the page shows it as theirs, so nothing is lost when the two read a step differently.
 * Pure.
 */
import type { TradeFlowRows } from '../../../supabase/functions/_shared/gcTradeFlow'
import { PORTAL_GC_LETTERHEAD } from '../../../supabase/functions/_shared/portalLetterhead'
import { flowStampsFor, type FlowRows } from '../flows/load'
import { portalPage, type PortalPage, type PortalPageSection, type PortalStepReading } from '../flows/portalPage'
import { portalLanes } from '../flows/portalSteps'
import { SEED_FLOWS } from '../flows/seed'
import { readFlow } from '../flows/state'
import { GC_COMPANY } from '../gc/company'
import type { PortalTodo } from '../gc/portal'
import type { PaperworkLine } from '../gc/tradePortalPage'
import type { PortalLang } from './pageWords'

const LISTS = [
  'contactJobs',
  'portalLinks',
  'tradeMessages',
  'papers',
  'invites',
  'packages',
  'quotes',
  'askLines',
  'sows',
  'draws',
  'tradeFiles',
  'projects',
  'skips',
] as const satisfies readonly (keyof TradeFlowRows)[]

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The answer's `flow` as the page reads it, or null: an older function, or a flow that did not read. */
export function parseTradeFlow(v: unknown): TradeFlowRows | null {
  if (!isObject(v) || !isObject(v.contact) || !isObject(v.company)) return null
  if (typeof v.contact.id !== 'string' || typeof v.company.id !== 'string') return null
  return LISTS.every((k) => Array.isArray(v[k])) ? (v as unknown as TradeFlowRows) : null
}

/** Midday on the page's day in Chicago, the moment the page reads its flow at: the day the function answered for. */
export function todayNoon(today: string): Date {
  return new Date(`${today}T17:00:00Z`)
}

/** The company's first page in one language. `jobNames` names each job by its id; a job with none stays off. */
export function tradeFirstPage(flow: TradeFlowRows, jobNames: Readonly<Record<string, string>>, now: Date, lang: PortalLang): PortalPage {
  const rows: FlowRows = flow
  const def = SEED_FLOWS.trade
  const reading = readFlow(def, flowStampsFor('trade', rows, now), now)
  return portalPage(lang, { company: GC_COMPANY.name, phone: PORTAL_GC_LETTERHEAD.phone, off: !!reading.off, lanes: portalLanes(def, reading, jobNames) })
}

/** Where a press on the page lands. */
export type TradePagePress = { kind: 'paperwork'; line: PaperworkLine } | { kind: 'project'; projectId: string }

const OWN_PAPERS: readonly string[] = ['msa', 'w9', 'coi']

/** A row's press: theirs or ran out, on a job or on one of the company's own papers. Anything else presses nothing. */
export function tradePagePress(section: PortalPageSection, row: PortalStepReading): TradePagePress | null {
  if (row.kind !== 'yours' && row.kind !== 'ranOut') return null
  if (section.jobId) return { kind: 'project', projectId: section.jobId }
  return row.paper && OWN_PAPERS.includes(row.paper) ? { kind: 'paperwork', line: row.paper as PaperworkLine } : null
}

/** A job's to-do the page carries, by the key's ending, with the step that carries it. */
const JOB_TODOS: Readonly<Record<string, string>> = { send: 'ask', late: 'ask', sow: 'sow', draw: 'draws', finalwaiver: 'closeout' }

const theirs = (row: PortalStepReading) => row.kind === 'yours' || row.kind === 'ranOut'

/** Needs you without the to-dos the page shows as theirs: each thing to do shows once. */
export function withoutPageTodos(todos: readonly PortalTodo[], page: PortalPage): PortalTodo[] {
  const own = new Set<string>(page.sections.filter((s) => s.lane === 'once').flatMap((s) => s.rows.filter(theirs).flatMap((r) => ('paper' in r && r.paper ? [r.paper] : []))))
  const onJob = (projectId: string, stepId: string) =>
    page.sections.some((s) => s.jobId === projectId && s.rows.some((r) => r.id === stepId && theirs(r)))
  return todos.filter((t) => {
    if (OWN_PAPERS.includes(t.key)) return !own.has(t.key)
    const m = /^[^:]+:(\w+)$/.exec(t.key)
    const step = m ? JOB_TODOS[m[1] ?? ''] : undefined
    return !(step && t.projectId && onJob(t.projectId, step))
  })
}
