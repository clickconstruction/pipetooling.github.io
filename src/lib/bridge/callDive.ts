import { shortK } from './headline'
import type { WeekMove } from './weekCall'
import { billTodo, payerTodo, pctTodo, priceTodo, projectTodo, supplyTodo, type CallTodo } from './callTodo'
import { chargeCell } from './pctFacts'

/**
 * What is behind a move on the card *What to do now* (punch list #334, PR 8). The owner, of the card: "I can't easily
 * dive in and it's not very actionable". A move was one sentence with a count, and a small arrow to a page.
 *
 * Each move names the real things it stands for, and carries one press that opens the place to act on them. Asked
 * whether each named thing should be its own press, straight to that one: "Yes, press each one". So a customer opens
 * the Collect window on that customer, a job opens that job, and a supply house opens that house on its due day.
 * *Chase the late invoices* lists the customers to call and opens the Collect window. *Bill the finished jobs* lists
 * the jobs and opens the Bill window. The supply bills are named and open behind Money.
 *
 * On the customers to call, the owner asked to "mark when we are getting paid and see when we were promised to get
 * paid by these different customers and their different projects", with the app's existing tools. So a customer's
 * line says the day they named, or that they named none, and opens to its projects, each with what is owed, its own
 * promised day, and a press that opens the app's own sheet for a customer's word (`SetPromisedPayDateModal`).
 *
 * Of the press *Open the jobs* on the percent move: it "just opens the jobs page ... should we just remove the
 * button?" So that press is gone. Each job named carries its own *Set the percent*, which opens the app's percent
 * window for that job where the reader stands (`FieldPctUpdateModal`). A move's list shows its first few and then
 * every one on a press, so no job is left behind a page.
 *
 * Of the look: "Visually, I don't like how this looks, but I like how it functions." So a line also carries its facts
 * as cells under the move's headings (`DiveRow`, `DiveColumns`), which `BridgeMoveTable.tsx` draws as a table.
 *
 * Each thing also carries its to-do card (punch list #334, PR 9; `callTodo.ts`), for the check that hands that one
 * line to one person.
 *
 * A job with no percent says its hours and who worked them (punch list #334, PR 10; `jobHours.ts`). The hours are a
 * press of their own, which opens the detail: a percent is judged from them.
 *
 * It also says what we are charging, or that the job has no price, and the last day it was worked, by whom, and
 * whether that day is a clocked one or a scheduled one (v2.7221; `pctFacts.ts`). The percent window carries the rest.
 * The last day worked leads with how long ago it was, and the people sit under it in soft words (v2.7245).
 * Under its name it says where it is, street and city (v2.7232), and so does a job with no price (v2.7243).
 *
 * Nothing is counted here. Every list is handed in from what the page has already read, in the order it is given.
 *
 * Pure. Kept apart from `weekCall.ts`, which is copied to the edge functions: the weekly email does not draw this.
 */

/** How many things a move names before "and N more". */
export const DIVE_SHOWN = 3

/** Where a press goes: a step's window (on one customer, when it names one), the Money door, or a page of the app. */
export type DiveTarget =
  | { kind: 'desk'; stage: 'collect' | 'bill' | 'build'; payerKey?: string }
  | { kind: 'money' }
  | { kind: 'page'; to: string }
  /** The sheet that writes down a customer's word on one job's bill: the day they named, or that they say they paid. */
  | { kind: 'promise'; jobId: string; jobLabel: string; ymd: string | null; context: string }
  /** The app's percent window for one job. */
  | { kind: 'pct'; job: DivePctJob }
  /** The app's Add task window, written for this one thing (`callTodo.ts`). */
  | { kind: 'todo'; todo: CallTodo }
  /** The hours behind one job and whose they are (`jobHours.ts`), with the percent window one press on. */
  | { kind: 'hours'; jobId: string; jobLabel: string; pctJob: DivePctJob | null }

/**
 * One cell of a line drawn as a table row. `text` is the cell under its column's heading; `phone` is the same fact
 * with its unit, for a phone where there is no heading over it.
 */
export type DiveCell = { text: string; phone?: string; muted?: boolean; warn?: boolean; /** Soft words under the cell's own: who worked a job, under the day it was last worked (v2.7245). */ sub?: string; /** A cell that opens its own detail, and what a screen reader hears on it. */ target?: DiveTarget; label?: string }
/** A line's cells: two short figures and one run of words, under `DiveColumns`. */
export type DiveRow = { a?: DiveCell; b?: DiveCell; text?: DiveCell }
/** The headings over a move's lines. An empty heading is a column the move does not use. */
export type DiveColumns = { name: string; a: string; b: string; text: string }

/** A job as the percent window takes it. */
export type DivePctJob = { id: string; hcpNumber: string; jobName: string; label: string }

/** One project under a customer: what is owed on it, the day they named for it, and the press that sets one. */
export type DiveProject = { key: string; title: string; detail: string; press: { label: string; target: DiveTarget } | null; /** The to-do card for this one project. */ todo?: CallTodo; /** The same facts as cells, under the customer's headings. */ row?: DiveRow }

/** One named thing. Its own press goes straight to it: that customer in the Collect window, that job, that supply house. */
export type DiveItem = {
  title: string
  detail: string
  target: DiveTarget
  /** A customer's projects, largest first. */
  projects?: DiveProject[]
  /** A second press on the row that acts where the reader stands: *Set the percent*. */
  press?: { label: string; target: DiveTarget }
  /** The to-do card for this one thing, for the check that hands it to a person. */
  todo?: CallTodo
  /** The line's facts as cells, for the card that draws a table. */
  row?: DiveRow
  /** A line under the name that says which thing this is: a job's street and city (v2.7232). */
  sub?: string
}

/** The page that opens one job. */
export const jobPage = (jobId: string): string => `/jobs?tab=stages&edit=${jobId}`
/** The page that opens one supply house, on the bills that fall due on a day when the press names one. */
export const supplyHousePage = (houseId: string, dueYmd?: string | null): string => `/materials?tab=supply-houses&house=${houseId}${dueYmd ? `&due=${dueYmd}` : ''}`

export type MoveDive = {
  /** Every thing behind the move. The row draws the first `shown` and the rest on a press. */
  items: DiveItem[]
  shown: number
  /** The move's own press, and what it opens. Null when every item acts by itself and a page would add nothing. */
  press: string | null
  target: DiveTarget | null
  /** The headings over the lines' cells. Absent for a move with no list. */
  columns?: DiveColumns
}

export type DiveFacts = {
  /** The customers to call, most pressing first (the Collect window's own cut). */
  payers: ReadonlyArray<{
    key: string
    /** The customer's own record, for the card's link; null for a payer known by name alone. */
    payerId?: string | null
    name: string
    lateUsd: number
    usd: number
    oldestAgeDays: number | null
    /** The day the customer named, and whether it has passed unpaid. Absent when the page has not read promises. */
    promise?: { state: 'none' | 'promised' | 'broken'; ymd: string | null }
    /** The customer's open bills, a row a project. */
    projects?: ReadonlyArray<{ key: string; jobId: string | null; label: string; usd: number; ageDays: number | null; broken: boolean; promisedYmd: string | null; promisedBy: string | null }>
  }>
  /** Finished work with no bill, largest first. */
  billJobs: ReadonlyArray<{ id: string; label: string; usd: number }>
  noPctJobs: ReadonlyArray<{
    id: string
    label: string
    revenueUsd: number | null
    /** The job as the percent window takes it; absent when the page cannot hand it one, and the row then opens the job. */
    pctJob?: DivePctJob | null
    /** The percent set on the page this visit; the row stays where it was and says so. */
    setPct?: number | null
    /** The job's hours and who worked them, in a few words (`jobHoursLine`). Absent until they are read. */
    hoursLine?: string | null
    /** The same as cells: the hours as a figure, with its unit for a phone, and the people. */
    hoursCell?: { text: string; phone: string; by: string } | null
    /** The last day worked, which reading it is, and who (`lastWorkedCell`). Absent until read: the line keeps its people. */
    lastWorked?: { text: string; phone: string; muted: boolean; /** Who has worked the job, in soft words under the day (v2.7245). */ sub?: string } | null
    /** Where the job is, as its street and city (`streetAndCity`). Absent until read, or when the job has none. */
    address?: string | null
  }>
  noPriceJobs: ReadonlyArray<{ id: string; label: string; /** Where the job is, as its street and city (v2.7243). Absent until read, or when the job has none. */ address?: string | null }>
  /** What falls due on the day the cash call names, one row a supply house, largest first. */
  supplyBills: ReadonlyArray<{ houseId: string | null; name: string; usd: number; dueYmd: string | null; bills: number }>
  dayLabel: (ymd: string) => string
}

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`

/** A pay date as a cell: the day they named, a day that passed, or none yet. */
const payDateCell = (ymd: string | null, broken: boolean, dayLabel: (ymd: string) => string): DiveCell => (ymd ? (broken ? { text: `Said ${dayLabel(ymd)}, passed`, warn: true } : { text: `Said ${dayLabel(ymd)}` }) : { text: 'None yet', muted: true })
const ageCell = (n: number | null, phone: (d: string) => string): DiveCell | undefined => (n != null ? { text: days(n), phone: phone(days(n)), muted: true } : undefined)

const listed = <T>(rows: ReadonlyArray<T>, item: (row: T) => DiveItem): Pick<MoveDive, 'items' | 'shown'> => ({ items: rows.map(item), shown: DIVE_SHOWN })

/** What a customer has said about paying, over all their bills: the day they named, a day that passed, or none. */
export function payerPromiseWords(promise: { state: 'none' | 'promised' | 'broken'; ymd: string | null }, dayLabel: (ymd: string) => string): string {
  if (promise.state === 'broken' && promise.ymd) return `They said ${dayLabel(promise.ymd)}. That day has passed.`
  if (promise.state === 'promised' && promise.ymd) return `They said ${dayLabel(promise.ymd)}.`
  return 'No pay date yet.'
}

type ProjectFact = NonNullable<DiveFacts['payers'][number]['projects']>[number]

/** One project's line: what is owed, how long ago it was billed, the day they named, and the press that sets one. */
function projectOf(j: ProjectFact, payerName: string, dayLabel: (ymd: string) => string): DiveProject {
  const billed = j.ageDays != null ? ` Billed ${days(j.ageDays)} ago.` : ''
  const word = j.promisedYmd ? (j.broken ? `They said ${dayLabel(j.promisedYmd)}. That day has passed.` : `They said ${dayLabel(j.promisedYmd)}${j.promisedBy ? `, written down by ${j.promisedBy}` : ''}.`) : 'No pay date yet.'
  return {
    key: j.key,
    row: { a: { text: shortK(j.usd), phone: `${shortK(j.usd)} owed` }, b: ageCell(j.ageDays, (d) => `billed ${d} ago`), text: payDateCell(j.promisedYmd, j.broken, dayLabel) },
    title: j.label,
    detail: `${shortK(j.usd)} owed.${billed} ${word}`,
    todo: projectTodo({ payerName, jobId: j.jobId, label: j.label, usd: j.usd, ageDays: j.ageDays, promisedYmd: j.promisedYmd, broken: j.broken }, dayLabel),
    // A bill with no job on it has nothing for the sheet to write to.
    press: j.jobId ? { label: j.promisedYmd ? 'Change the pay date' : 'Set a pay date', target: { kind: 'promise', jobId: j.jobId, jobLabel: `${payerName} · ${j.label}`, ymd: j.promisedYmd, context: `${shortK(j.usd)} owed.${billed}` } } : null,
  }
}

/** The move the cash call adds for the supply houses. It has no number of its own, so it is known by its words. */
export const isSupplyMove = (move: Pick<WeekMove, 'key' | 'title'>): boolean => move.key === 'other' && /supply houses/i.test(move.title)

/**
 * The things behind one move and the press that opens them. Null for a move the page cannot name anything for and
 * has no place to send: the move is then its heading alone.
 */
export function moveDive(move: Pick<WeekMove, 'key' | 'title' | 'door'>, facts: DiveFacts | null): MoveDive | null {
  if (!facts) return null
  if (move.key === 'chase') {
    return {
      ...listed(facts.payers, (p) => {
        const money = p.lateUsd > 0 ? `${shortK(p.lateUsd)} late.${p.oldestAgeDays != null ? ` Oldest bill ${days(p.oldestAgeDays)}.` : ''}` : `${shortK(p.usd)} open.${p.oldestAgeDays != null ? ` Oldest bill ${days(p.oldestAgeDays)}.` : ''}`
        const word = p.promise ? ` ${payerPromiseWords(p.promise, facts.dayLabel)}` : ''
        const projects = (p.projects ?? []).map((j) => projectOf(j, p.name, facts.dayLabel))
        const todo = payerTodo({ payerId: p.payerId ?? null, name: p.name, usd: p.usd, lateUsd: p.lateUsd, projects: (p.projects ?? []).map((j) => ({ label: j.label, promisedYmd: j.promisedYmd })) })
        const row: DiveRow = {
          // Nothing late yet: what is open, said as open so the column's heading does not call it late.
          a: p.lateUsd > 0 ? { text: shortK(p.lateUsd), phone: `${shortK(p.lateUsd)} late` } : { text: `${shortK(p.usd)} open`, muted: true },
          b: ageCell(p.oldestAgeDays, (d) => `oldest bill ${d}`),
          ...(p.promise ? { text: payDateCell(p.promise.state === 'none' ? null : p.promise.ymd, p.promise.state === 'broken', facts.dayLabel) } : {}),
        }
        return { title: p.name, target: { kind: 'desk', stage: 'collect', payerKey: p.key }, detail: `${money}${word}`, todo, ...(projects.length > 0 ? { projects } : {}), row }
      }),
      press: 'See who to call',
      columns: { name: 'Customer', a: 'Late', b: 'Oldest bill', text: 'Pay date' },
      target: { kind: 'desk', stage: 'collect' },
    }
  }
  if (move.key === 'bill') {
    return { ...listed(facts.billJobs, (j) => ({ title: j.label, detail: `${shortK(j.usd)} finished, not billed.`, target: { kind: 'page', to: jobPage(j.id) }, todo: billTodo(j), row: { a: { text: shortK(j.usd), phone: `${shortK(j.usd)} to bill` } } })), press: 'See what to bill', target: { kind: 'desk', stage: 'bill' }, columns: { name: 'Job', a: 'To bill', b: '', text: '' } }
  }
  if (move.key === 'pct') {
    if (facts.noPctJobs.length === 0) return null
    // Each job sets its percent where the reader stands, so the move carries no press of its own.
    return {
      ...listed(facts.noPctJobs, (j) => {
        const contract = j.revenueUsd != null && j.revenueUsd > 0 ? `${shortK(j.revenueUsd)} contract. ` : ''
        const press = j.pctJob ? { press: { label: j.setPct != null ? 'Change the percent' : 'Set the percent', target: { kind: 'pct' as const, job: j.pctJob } } } : {}
        // A job set on this visit needs no card.
        const todo = j.setPct == null ? { todo: pctTodo(j) } : {}
        // The hours are what a percent is judged from: the cell says them, and it opens who worked them and when.
        const hoursTarget = { kind: 'hours' as const, jobId: j.id, jobLabel: j.label, pctJob: j.pctJob ?? null }
        // What we are charging, or that there is no price: never a blank where a figure belongs, and never $0.
        const charge = chargeCell({ chargeUsd: j.revenueUsd != null && j.revenueUsd > 0 ? j.revenueUsd : null })
        const row: DiveRow = {
          ...(j.hoursCell ? { a: { text: j.hoursCell.text, phone: j.hoursCell.phone, target: hoursTarget, label: `See the hours on ${j.label}: ${j.hoursLine ?? j.hoursCell.phone}` } } : {}),
          b: charge.warn ? { text: charge.text, phone: charge.phone, warn: true } : { text: charge.text, phone: charge.phone, muted: true },
          // A percent set on this visit says so where the people were. Else the last day worked, and until that is
          // read, the people with hours.
          ...(j.setPct != null ? { text: { text: `Set to ${Math.round(j.setPct)}% just now` } } : j.lastWorked ? { text: { text: j.lastWorked.text, phone: j.lastWorked.phone, ...(j.lastWorked.sub ? { sub: j.lastWorked.sub } : {}), ...(j.lastWorked.muted ? { muted: true } : {}) } } : j.hoursCell?.by ? { text: { text: j.hoursCell.by, muted: true } } : {}),
        }
        // The place under the name: the owner knows a job by where it is.
        return { title: j.label, detail: `${contract}${j.setPct != null ? `Set to ${Math.round(j.setPct)}% just now.` : 'No percent set.'}`, target: { kind: 'page', to: jobPage(j.id) }, ...press, ...todo, row, ...(j.address ? { sub: j.address } : {}) }
      }),
      press: null,
      target: null,
      columns: { name: 'Job', a: 'Hours', b: 'Contract', text: facts.noPctJobs.some((j) => j.lastWorked) ? 'Last worked' : 'Worked by' },
    }
  }
  if (move.key === 'price') {
    if (facts.noPriceJobs.length === 0) return null
    // A price is set on the job itself, and each job named opens there. A press to the Jobs page would add nothing.
    return { ...listed(facts.noPriceJobs, (j) => ({ title: j.label, detail: 'No price set.', target: { kind: 'page', to: jobPage(j.id) }, todo: priceTodo(j), ...(j.address ? { sub: j.address } : {}) })), press: null, target: null, columns: { name: 'Job', a: '', b: '', text: '' } }
  }
  if (move.key === 'approve') {
    // Hours are not a list of things; the press is the whole of it.
    return move.door ? { items: [], shown: DIVE_SHOWN, press: 'Open approvals', target: { kind: 'page', to: move.door.to } } : null
  }
  if (isSupplyMove(move)) {
    return { ...listed(facts.supplyBills, (b) => ({ title: b.name, detail: `${shortK(b.usd)}${b.dueYmd ? ` due ${facts.dayLabel(b.dueYmd)}` : ''}${b.bills > 1 ? `, on ${b.bills} bills` : ''}.`, target: b.houseId ? { kind: 'page', to: supplyHousePage(b.houseId, b.dueYmd) } : { kind: 'money' }, todo: supplyTodo({ housePath: b.houseId ? supplyHousePage(b.houseId, b.dueYmd) : null, name: b.name, usd: b.usd, dueYmd: b.dueYmd, bills: b.bills }, facts.dayLabel), row: { a: { text: shortK(b.usd), phone: `${shortK(b.usd)} due` }, b: { text: String(b.bills), phone: b.bills === 1 ? '1 bill' : `${b.bills} bills`, muted: true }, ...(b.dueYmd ? { text: { text: facts.dayLabel(b.dueYmd) } } : {}) } })), press: 'See the bills', target: { kind: 'money' }, columns: { name: 'Supply house', a: 'Due', b: 'Bills', text: 'Due day' } }
  }
  return null
}
