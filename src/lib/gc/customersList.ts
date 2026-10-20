import { companyJobLine, companyJobLines, companyTable, lineDayWords, rowPress, type BoardCompany, type BoardContext, type BoardLine, type LineTone, type RowPress } from '../flows/board'
import { portalCellWords } from '../flows/boardRead'
import type { FlowReading } from '../flows/state'
import { BOARD_SECTION_ORDER, boardSectionOf, type BoardSection } from './boardGroups'
import type { GcCustomer, GcProject } from './types'
import { shortDate } from './words'

/**
 * The Customers list (v2.5557, the owner's ask of 2026-10-15: "a Customers list like Trade partners"): the first view
 * on Customers, a card per customer on a GC project, with the person to call, the master agreement and the portal,
 * then one row per job: its stage on the Project Board, the step it is on with its day, and the step's own press.
 * Pure: the customers and the projects are the page's (`GcState`), the steps and the days are the flow board's
 * (`useFlowBoard('customer')`), and the screen (`GcCustomersList.tsx`) only draws what this returns.
 */

/** The Project Board's section words (its `SECTIONS` in `GcBoard.tsx` carry the same five), and the Board's tone for each. */
export const SECTION_WORDS: Readonly<Record<BoardSection, string>> = {
  pursuing: 'Bidding to the customer',
  buyout: 'Buying out',
  building: 'Building',
  closed: 'Closed',
  lost: 'Lost',
}
export type SectionTone = 'amber' | 'blue' | 'green' | 'grey' | 'red'
export const SECTION_TONE: Readonly<Record<BoardSection, SectionTone>> = { pursuing: 'amber', buyout: 'blue', building: 'green', closed: 'grey', lost: 'red' }

export const NO_CUSTOMERS = 'No customer on a GC project yet. Press New project to add the first.'
export const READING = 'Reading where everyone stands…'
export const OPEN_THE_CARD = 'Open the card'
export const ALL_QUIET = 'all quiet'

export interface CustomerCardJob {
  projectId: string
  name: string
  section: BoardSection
  stageWords: string
  /** The step the job is on, else how its lane stands: "not started", "done", "declined". Empty before the flow is read. */
  standing: string
  /** Beside the step: "our move · 7 d", "waiting on someone else", "late 3 days". */
  small: string
  tone: LineTone
  /** The step's own press, keyed off its facts; null when the step is ours to move or the job has no step. */
  press: RowPress | null
  line: BoardLine | null
}

export interface CustomerCard {
  customerId: string
  contactId: string | null
  name: string
  person: string
  phone: string
  email: string
  address: string
  /** The Once lane's first step, the master agreement: signed, not yet, or lapsed, with the step's small words while on it. */
  agreement: { words: string; tone: 'done' | 'now' | 'lapsed' | ''; small: string }
  /** When they last opened their portal: "today", "3 d ago", "never"; "—" before the read. */
  portal: string
  jobs: CustomerCardJob[]
  late: number
  waiting: number
  lapsed: boolean
  off: { since: string; why: string } | null
  worst: LineTone
}

export interface CustomersListInput {
  customers: readonly GcCustomer[]
  projects: readonly GcProject[]
  /** The customer flow as read; null until it lands. */
  flow: {
    ctx: BoardContext
    companies: readonly BoardCompany[]
    readings: Readonly<Record<string, FlowReading>>
    refs: Readonly<Record<string, { customerId: string | null }>>
  } | null
  /** Each customer's last open of their page; null until read, or when the read failed. */
  pageOpens: Readonly<Record<string, string>> | null
}

const RANK: Record<LineTone, number> = { late: 0, lapsed: 1, over: 2, wait: 3, '': 4 }

function job(input: CustomersListInput, company: BoardCompany | null, p: GcProject): CustomerCardJob {
  const section = boardSectionOf(p)
  const base = { projectId: p.id, name: p.name, section, stageWords: SECTION_WORDS[section] }
  const { flow } = input
  if (!flow) return { ...base, standing: '', small: '', tone: '', press: null, line: null }
  const found = company ? companyJobLine(flow.ctx, company, p.id) : null
  if (!found) {
    const words = company ? (companyJobLines(flow.ctx, company).find((l) => l.jobId === p.id)?.words ?? 'not started') : 'not started'
    return { ...base, standing: words, small: '', tone: '', press: null, line: null }
  }
  const { line, step } = found
  const day = lineDayWords(line, flow.ctx)
  const small = [step.who === 'us' ? 'our move' : '', day].filter(Boolean).join(' · ')
  return { ...base, standing: step.name, small, tone: line.tone, press: rowPress(step, [line]), line }
}

/** One card per customer on a GC project: the ones that need a hand first, then by name, the ones off the flow at the foot. */
export function customerCards(input: CustomersListInput): CustomerCard[] {
  const { customers, projects, flow, pageOpens } = input
  const byCustomer = new Map<string, GcProject[]>()
  for (const p of projects) byCustomer.set(p.customerId, [...(byCustomer.get(p.customerId) ?? []), p])
  const cards = customers.flatMap((c): CustomerCard[] => {
    const mine = byCustomer.get(c.id)
    if (!mine?.length) return []
    const company = flow ? (flow.companies.find((x) => flow.refs[x.contactId]?.customerId === c.id) ?? null) : null
    const jobs = mine.map((p) => job(input, company, p))
    // The late first, then the jobs on a step before the ones not started, then the Board's order, then the name.
    jobs.sort((a, b) => RANK[a.tone] - RANK[b.tone] || (a.line ? 0 : 1) - (b.line ? 0 : 1) || BOARD_SECTION_ORDER.indexOf(a.section) - BOARD_SECTION_ORDER.indexOf(b.section) || a.name.localeCompare(b.name))
    const row = flow && company ? companyTable(flow.ctx, [company])[0] : undefined
    const mark = row?.track[0]
    const agreement = !flow
      ? { words: '', tone: '' as const, small: '' }
      : mark?.mark === 'done'
        ? { words: 'signed', tone: 'done' as const, small: '' }
        : mark?.mark === 'lapsed'
          ? { words: 'lapsed', tone: 'lapsed' as const, small: row?.now.small.join(' · ') ?? '' }
          : { words: 'not yet', tone: (mark?.mark === 'now' ? 'now' : '') as 'now' | '', small: mark && row && row.now.stepId === mark.stepId ? row.now.small.join(' · ') : '' }
    const portal = flow && company && pageOpens ? portalCellWords(flow.ctx.flow, flow.readings[company.contactId], pageOpens[c.id] ?? null) : '—'
    const late = jobs.filter((j) => j.tone === 'late').length
    const waiting = jobs.filter((j) => j.tone === 'wait').length
    const lapsed = company?.places.some((p) => p.state === 'lapsed') ?? false
    const worst: LineTone = late ? 'late' : lapsed ? 'lapsed' : waiting ? 'wait' : jobs.some((j) => j.tone === 'over') ? 'over' : ''
    return [{ customerId: c.id, contactId: company?.contactId ?? null, name: c.name, person: c.contact, phone: c.phone, email: c.email, address: c.address, agreement, portal, jobs, late, waiting, lapsed, off: company?.off ?? null, worst }]
  })
  const rank = (card: CustomerCard) => (card.off ? 9 : RANK[card.worst])
  return cards.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** The chip on a card's band: how the customer stands, in one phrase. */
export function headChip(card: CustomerCard): { words: string; tone: SectionTone } {
  if (card.off) return { words: `off the flow since ${shortDate(card.off.since)}`, tone: 'grey' }
  if (card.late) {
    const only = card.late === 1 ? card.jobs.find((j) => j.tone === 'late') : undefined
    return { words: only?.small || `${card.late} late`, tone: 'red' }
  }
  if (card.lapsed) return { words: 'lapsed', tone: 'amber' }
  if (card.worst === 'over') return { words: 'over usual', tone: 'amber' }
  if (card.waiting) return { words: `${card.waiting} waiting on someone else`, tone: 'blue' }
  return { words: ALL_QUIET, tone: 'grey' }
}

/** The line over the cards: how many customers, and how many need a hand or wait. */
export function listSummary(cards: readonly CustomerCard[]): string {
  const on = cards.filter((c) => !c.off)
  const parts = [`${on.length} ${on.length === 1 ? 'customer' : 'customers'} on GC projects`]
  const late = on.filter((c) => c.late > 0).length
  const lapsed = on.filter((c) => !c.late && c.lapsed).length
  const over = on.filter((c) => c.worst === 'over').length
  const waiting = on.filter((c) => !c.late && !c.lapsed && c.worst !== 'over' && c.waiting > 0).length
  const off = cards.length - on.length
  if (late) parts.push(`${late} late`)
  if (lapsed) parts.push(`${lapsed} lapsed`)
  if (over) parts.push(`${over} over usual`)
  if (waiting) parts.push(`${waiting} waiting on someone else`)
  if (off) parts.push(`${off} off the flow`)
  return parts.join(' · ')
}
