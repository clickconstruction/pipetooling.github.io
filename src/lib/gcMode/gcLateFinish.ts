/**
 * GC mode design spike: the late-finish days in the contract, counted against the projected
 * finish, the Gantt's G-98 (`to-dos/gc-mode/GANTT_PLAN.md`, mock-up `to-dos/gc-mode/mockups/G-98.md`).
 * The contract's day and the projected finish were each said in their own place, and nobody put
 * them in one sentence: how many days past the contract, what they cost at the contract's fee,
 * which change orders moved the contract's day and which would, and whose door the late days lie
 * at. The customer reads the same days in their own words, never a company and never the fee.
 *
 * One call: the days come from Owner Billing's `ownerFinishRisk` (the projected finish against
 * substantial completion with signed orders' days), so the Schedule tab, Bill the customer and the
 * customer's sentence move together. Its own file, out of the barrel.
 */
import type { GcProject, GcState } from './gcTypes'
import { daysBetween } from './gcBuildingSchedule'
import { ownerFinishRisk, type OwnerFinishRisk } from './gcOwnerBillingFinish'
import { changeOrderDays, projectChangeOrders } from './gcOwnerBilling'
import { CAUSE_OF } from './gcDaysLost'
import { CUSTOMER_WHY } from './gcCustomerSchedule'
import { askedMoveIds, isTimeExtension, timeExtensionAsk, type TimeExtensionAsk } from './gcTimeExtension'
import { money, weekdayDate } from './gcWords'

export interface LateFinishOrder {
  number: number
  days: number
  /** Signed: it moved the contract's day. Sent: it would, once they sign it. */
  state: 'signed' | 'sent'
  /** The day they signed it, or the day it was sent. */
  on: string | null
}

export interface LateFinish {
  /** Owner Billing's reads: the contract's day, the projected finish, the fee a day. Every count here comes from this one call. */
  risk: OwnerFinishRisk
  /** Days the projected finish runs past the contract's day. 0: on time or early. Null: no schedule, or no substantial completion. */
  late: number | null
  /** Days to spare before the contract's day. 0 when late or on the day. */
  spare: number
  /** Late days whose reason lies at the customer's door, at most `late`: a change order to ask for. */
  customers: number
  /** Why, in the customer's words, for those days: "a decision we were waiting on from you". */
  customerWhy: string[]
  /** The contract's fee a day, as typed on Bill the customer. Null: none typed. */
  perDay: number | null
  /** Late days times the fee. Null without a fee, or nothing late. */
  atRisk: number | null
  /** Signed orders that add days, then sent ones. */
  orders: LateFinishOrder[]
  /** "At $500 a day, the 3 days cost $1,500.", or that no fee is typed. Null: nothing late and no fee. */
  money: string | null
  /** "All 3 are the customer's: a change order for them would save $1,500." Null: none of the late days are the customer's. */
  split: string | null
  /** "Change order 1 moved the contract 1 day, signed Fri Oct 2." One a change order with days. */
  orderLines: string[]
  /** The office's lines, in order: the money, whose days, the change orders. Under the Projected finish measure. */
  words: string[]
  /** The customer's lines, after their finish: whose the days are, in their words. Empty unless late. */
  customerWords: string[]
  /** Time extensions that ask for the customer's days and are not signed yet (G-141): a draft or a sent one. */
  asked: { number: number; status: 'draft' | 'sent'; days: number }[]
  /** Ask for the days (G-141): what the press would draft. Null: none of the late days are the customer's, or their moves are all asked for. */
  ask: TimeExtensionAsk | null
}

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The job's finish against its contract: the days, the money at the contract's fee, whose days they are, the change orders. */
export function lateFinish(state: GcState, project: GcProject): LateFinish {
  const risk = ownerFinishRisk(state, project)
  const late = risk.past === null ? null : Math.max(0, risk.past)
  const spare = risk.past === null ? 0 : Math.max(0, -risk.past)
  const perDay = risk.perDay

  // Days the standing moves put on the finish for a reason at the customer's door. A move that put a
  // signed change order's days on the chart is not counted: the contract already moved for it. Nor is
  // one a signed time extension asks for (G-141), for the same reason.
  const signedAsks = askedMoveIds(project, ['signed'])
  const theirs = (project.schedule?.moves ?? []).filter((m) => !m.undoneOn && !m.changeOrderId && !signedAsks.has(m.id) && CAUSE_OF[m.reason] === 'customer')
  const theirDays = theirs.reduce((sum, m) => sum + daysBetween(m.finishFrom, m.finishTo), 0)
  const customers = late ? Math.max(0, Math.min(theirDays, late)) : 0
  const customerWhy = [...new Set(theirs.filter((m) => daysBetween(m.finishFrom, m.finishTo) > 0).map((m) => CUSTOMER_WHY[m.reason]).filter(Boolean))]

  const orders: LateFinishOrder[] = projectChangeOrders(project)
    .filter((co) => changeOrderDays(co) > 0 && (co.status === 'signed' || co.status === 'sent'))
    .map((co) => ({ number: co.number, days: changeOrderDays(co), state: co.status === 'signed' ? ('signed' as const) : ('sent' as const), on: co.status === 'signed' ? co.answeredOn : co.sentOn }))
    .sort((a, b) => (a.state === b.state ? a.number - b.number : a.state === 'signed' ? -1 : 1))
  const orderLines = orders.map((o) =>
    o.state === 'signed'
      ? `Change order ${o.number} moved the contract ${days(o.days)}${o.on ? `, signed ${weekdayDate(o.on)}` : ''}.`
      : `Change order ${o.number} would move the contract ${days(o.days)} once they sign it.`,
  )

  const atRisk = late && perDay ? late * perDay : null
  const contractDay = risk.contract ? weekdayDate(risk.contract.on) : null
  const moneyLine =
    late && late > 0
      ? perDay
        ? late === 1
          ? `At ${money(perDay)} a day, that day costs ${money(perDay)}.`
          : `At ${money(perDay)} a day, the ${late} days cost ${money(late * perDay)}.`
        : 'No late fee is entered from the contract. It goes on Bill the customer.'
      : perDay && contractDay
        ? `Each day past ${contractDay} costs ${money(perDay)}.`
        : null
  const save = (n: number) => (perDay ? `save ${money(n * perDay)}` : 'move the contract')
  // Ask for the days (G-141): the time extensions out for them, and what the press would draft.
  const asked = projectChangeOrders(project).flatMap((co) =>
    isTimeExtension(co) && (co.status === 'draft' || co.status === 'sent') ? [{ number: co.number, status: co.status, days: changeOrderDays(co) }] : [],
  )
  const ask = late && customers > 0 ? timeExtensionAsk(state, project) : null
  const split =
    late && customers > 0
      ? asked.length > 0
        ? askedWords(late, customers, asked, ask)
        : customers >= late
          ? late === 1
            ? `That day is the customer's: a change order for it would ${save(1)}.`
            : `All ${late} are the customer's: a change order for them would ${save(late)}.`
          : `${customers} of those days ${customers === 1 ? 'is' : 'are'} the customer's: a change order for ${customers === 1 ? 'it' : 'them'} would ${save(customers)}.`
      : null

  const words = [moneyLine, split, ...orderLines].filter((w): w is string => Boolean(w))

  // The customer's words: whose the days are, never a company and never the fee.
  const customerWords: string[] = []
  if (late && late > 0) {
    const rest = late - customers
    const why = andList(customerWhy)
    if (customers > 0 && why) {
      customerWords.push(customers >= late ? `${late === 1 ? 'That day' : `Those ${late} days`} came from ${why}.` : `${customers} of those days came from ${why}.`)
    }
    if (rest > 0) customerWords.push(rest === late ? `We are working to make up ${late === 1 ? 'the day' : 'the days'}.` : `We are working to make up the other ${rest === 1 ? 'day' : rest}.`)
  }

  return { risk, late, spare, customers, customerWhy, perDay, atRisk, orders, money: moneyLine, split, orderLines, words, customerWords, asked, ask }
}

/**
 * The whose-days line once a time extension asks for the days (G-141): "All 4 are the customer's:
 * change order 1 asks for 5, the days their moves put on the finish. It is a draft on Bill the
 * customer." The days asked can be more than the late ones: it asks for every day their moves cost.
 */
function askedWords(late: number, customers: number, asked: LateFinish['asked'], ask: TimeExtensionAsk | null): string {
  const whose = customers >= late ? (late === 1 ? "That day is the customer's" : `All ${late} are the customer's`) : `${customers} of those days ${customers === 1 ? 'is' : 'are'} the customer's`
  const total = asked.reduce((sum, a) => sum + a.days, 0)
  const orders = asked.length === 1 ? `change order ${asked[0]?.number} asks` : `change orders ${andList(asked.map((a) => String(a.number)))} ask`
  const drafts = asked.filter((a) => a.status === 'draft')
  const draft =
    drafts.length === 0
      ? ''
      : drafts.length === asked.length
        ? asked.length === 1
          ? ' It is a draft on Bill the customer.'
          : ' They are drafts on Bill the customer.'
        : ` Change order${drafts.length === 1 ? '' : 's'} ${andList(drafts.map((a) => String(a.number)))} ${drafts.length === 1 ? 'is a draft' : 'are drafts'} on Bill the customer.`
  const since = ask ? ` Their moves since then add ${days(ask.days)}, not asked for yet.` : ''
  return `${whose}: ${orders} for ${total}, the days their moves put on the finish.${draft}${since}`
}
