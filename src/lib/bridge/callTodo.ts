import { shortK } from './headline'

/**
 * A to-do card for one thing on the card *What to do now* (punch list #334, PR 9).
 *
 * The owner refused handing whole moves to people: "assign these directly to someone as a to-do card ... not be
 * vague, but to be extremely specific."
 *
 * So each named thing can become a card of its own, in the app's own Add task window (`ChecklistAddModal`), already
 * written: one customer, one project, one job or one supply house. The title says who, what and how much. The *Done
 * when…* lines say what finished looks like, one a line, so the card reads its percent from real ticks. The link
 * opens the thing itself. The person is picked in the window; nothing is sent until its Send.
 *
 * Pure: the words only. The page turns a link's path into a full address and opens the window.
 */

/** The most *Done when…* lines a card takes (`taskCriteria.ts`). */
export const TODO_LINES_MAX = 12

export type CallTodo = {
  /** What the card is about, the same for the same thing on every visit: the page finds the card again by it. */
  key: string
  /** The card's title: who, what, how much. */
  title: string
  /** In-app paths the card links to, the thing itself first. */
  paths: string[]
  /** What finished looks like, one line each. */
  doneWhen: string[]
}

/** A name as a key part, when the thing has no id of its own. */
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`
const customerPath = (id: string): string => `/customers/${id}`
/** The job's own window, the door every *send this job as a task* uses (`checklistJobPath`). */
const jobPath = (jobId: string): string => `/jobs?jobDetail=${encodeURIComponent(jobId)}`

/** One customer to call about what they owe: a pay date for each bill, named. */
export function payerTodo(p: { payerId: string | null; name: string; usd: number; lateUsd: number; projects: ReadonlyArray<{ label: string; promisedYmd: string | null }> }): CallTodo {
  const owed = p.lateUsd > 0 ? `${shortK(p.lateUsd)} late` : `${shortK(p.usd)} open`
  // A line for each bill; the ones past the card's limit share the last line.
  const lines = (rows: ReadonlyArray<{ label: string }>, done: string): string[] => {
    const named = rows.length > TODO_LINES_MAX ? rows.slice(0, TODO_LINES_MAX - 1) : rows
    const rest = rows.length - named.length
    return [...named.map((j) => `${j.label}: ${done}`), ...(rest > 0 ? [`The other ${rest} bills: ${done}`] : [])]
  }
  const paths = p.payerId ? [customerPath(p.payerId)] : []
  const key = `payer.${p.payerId ?? slug(p.name)}`
  const noDate = p.projects.filter((j) => j.promisedYmd == null)
  // Some bill has no pay date: that is the ask, and only those bills are listed.
  if (noDate.length > 0) return { key, title: `Call ${p.name} about ${owed}. Get a pay date for each bill.`, paths, doneWhen: lines(noDate, 'pay date written down') }
  // Every bill has a day named: the call is to hear that each one still holds.
  if (p.projects.length > 0) return { key, title: `Call ${p.name} about ${owed}. Confirm each pay date still holds.`, paths, doneWhen: lines(p.projects, 'pay date confirmed') }
  return { key, title: `Call ${p.name} about ${owed}. Get a pay date for each bill.`, paths, doneWhen: ['Every bill has a pay date written down'] }
}

/** One project's bill: the day the customer will pay it. */
export function projectTodo(j: { payerName: string; jobId: string | null; label: string; usd: number; ageDays: number | null; promisedYmd: string | null; broken: boolean }, dayLabel: (ymd: string) => string): CallTodo {
  const billed = j.ageDays != null ? `, billed ${days(j.ageDays)} ago` : ''
  const owed = `${shortK(j.usd)} owed${billed}.`
  const paths = j.jobId ? [jobPath(j.jobId)] : []
  const key = `paydate.${j.jobId ?? slug(`${j.payerName} ${j.label}`)}`
  // A day that still stands: hear that it holds. A day that passed: a new one. No day: the first one.
  if (j.promisedYmd && !j.broken) return { key, title: `Confirm with ${j.payerName} that ${j.label} still pays ${dayLabel(j.promisedYmd)}. ${owed}`, paths, doneWhen: ['The day is confirmed or a new one is written down'] }
  if (j.promisedYmd) return { key, title: `Get a new pay date from ${j.payerName} for ${j.label}. They said ${dayLabel(j.promisedYmd)} and it has passed. ${owed}`, paths, doneWhen: ['The new pay date is written down on the bill'] }
  return { key, title: `Get a pay date from ${j.payerName} for ${j.label}. ${owed}`, paths, doneWhen: ['The pay date is written down on the bill'] }
}

/** One job with no percent done. */
export function pctTodo(j: { id: string; label: string; revenueUsd: number | null }): CallTodo {
  const contract = j.revenueUsd != null && j.revenueUsd > 0 ? ` It is a ${shortK(j.revenueUsd)} contract.` : ''
  return { key: `pct.${j.id}`, title: `Set the percent done on ${j.label}.${contract}`, paths: [jobPath(j.id)], doneWhen: ['The job has a percent done'] }
}

/** One job with no price. */
export function priceTodo(j: { id: string; label: string }): CallTodo {
  return { key: `price.${j.id}`, title: `Put a price on ${j.label}. Its hours earn nothing until then.`, paths: [jobPath(j.id)], doneWhen: ['The job has a price'] }
}

/** One job with finished work and no bill. */
export function billTodo(j: { id: string; label: string; usd: number }): CallTodo {
  return { key: `bill.${j.id}`, title: `Bill ${j.label}. ${shortK(j.usd)} is finished and not billed.`, paths: [jobPath(j.id)], doneWhen: ['The bill is sent'] }
}

/** One supply house with bills coming due: ask for more days. */
export function supplyTodo(b: { housePath: string | null; name: string; usd: number; dueYmd: string | null; bills: number }, dayLabel: (ymd: string) => string): CallTodo {
  const due = b.dueYmd ? ` due ${dayLabel(b.dueYmd)}` : ''
  const count = b.bills > 1 ? `, on ${b.bills} bills` : ''
  return { key: `supply.${slug(b.name)}${b.dueYmd ? `.${b.dueYmd}` : ''}`, title: `Ask ${b.name} for more days on ${shortK(b.usd)}${due}${count}.`, paths: b.housePath ? [b.housePath] : [], doneWhen: [`${b.name} has said yes or no`, 'The new due day is on the bills'] }
}

/** The query word a Bridge to-do's first link carries, so the page can find the card again. */
export const TODO_TAG_PARAM = 'todo'

/**
 * The card's links as in-app paths, the first one tagged with the card's key. A card with no page of its own links
 * to the Bridge, so it still carries its tag. The tag rides in the link because a card has no field for it.
 */
export function todoLinkPaths(todo: CallTodo): string[] {
  const first = todo.paths[0] ?? '/bridge'
  const tagged = `${first}${first.includes('?') ? '&' : '?'}${TODO_TAG_PARAM}=${encodeURIComponent(todo.key)}`
  return [tagged, ...todo.paths.slice(1)]
}

/** The card's foot: how a line reaches a person. */
export const TODO_FOOT = 'Press a grey check to hand that line to one person. A blue check is with someone.'
