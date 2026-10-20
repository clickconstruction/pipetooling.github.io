/**
 * The three resources (link PR 6): Decision, Capital and Talent — a stage is
 * slow because one of these is short. Each reads a gauge, one line, and
 * whether it throttles the link or shows its symptom. Pure.
 */
import type { StageId } from './stageFlow'

export type ResourceId = 'decision' | 'capital' | 'talent'

export const RESOURCE_META: Record<ResourceId, { name: string; kind: string; action: string }> = {
  decision: { name: 'Decision', kind: 'bottlenecks at the leadership level', action: 'decide today' },
  capital: { name: 'Capital', kind: 'not enough money', action: 'keep cash above the floor' },
  talent: { name: 'Talent', kind: 'not enough people', action: 'staff the slow step' },
}

export type ResourcesInput = {
  linkId: StageId | null
  /** What waits on the owner. */
  pendingHours: number
  pendingSessions: number
  unpricedJobs: number
  noPctJobs: number
  unsortedBankRows: number
  bidsNoValue: number
  /** Cash: the bank's balance and the forecast's lowest point against the floor. */
  bankUsd: number | null
  bankSynced: boolean
  lowestUsd: number | null
  lowestLabel: string | null
  floorUsd: number
  clearsFloor: boolean | null
  /** People: who clocked field time in the last 7 days, who sent a bill in the window. */
  fieldPeople: number
  fieldHours7d: number
  billers: number
  /** Bills sent in the window with no sender recorded; when nobody is named, one person is read from the bills. */
  billsWithoutSender?: number
}

export type ResourceReading = {
  id: ResourceId
  name: string
  kind: string
  action: string
  gauge: string
  tone: 'red' | 'amber' | 'green' | 'muted'
  oneLine: string
  badge: 'throttles the link' | 'symptom of the link' | 'not short'
  throttles: boolean
}

const money = (n: number): string => `$${Math.abs(n) >= 100_000 ? `${Math.round(Math.abs(n) / 1000)}k` : Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(1).replace(/\.0$/, '')}k` : Math.round(Math.abs(n)).toLocaleString('en-US')}`
const signed = (n: number): string => `${n < 0 ? '−' : ''}${money(n)}`
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

export function buildResources(input: ResourcesInput): ResourceReading[] {
  const piles: string[] = []
  if (input.pendingHours > 0) piles.push(`${Math.round(input.pendingHours)}h to approve`)
  if (input.unpricedJobs > 0) piles.push(`${input.unpricedJobs} ${plural(input.unpricedJobs, 'price', 'prices')}`)
  if (input.noPctJobs > 0) piles.push(`${input.noPctJobs} ${plural(input.noPctJobs, 'percent', 'percents')}`)
  if (input.unsortedBankRows > 0) piles.push(`${input.unsortedBankRows.toLocaleString('en-US')} bank ${plural(input.unsortedBankRows, 'row', 'rows')}`)
  if (input.bidsNoValue > 0) piles.push(`${input.bidsNoValue} ${plural(input.bidsNoValue, 'bid', 'bids')} with no value`)
  const decisionThrottles = piles.length > 0 && (input.linkId === 'bill' || input.linkId === 'build' || input.linkId === 'collect')
  const decision: ResourceReading = {
    id: 'decision',
    ...RESOURCE_META.decision,
    gauge: piles.length ? `${piles.length} ${plural(piles.length, 'pile', 'piles')} on you` : 'nothing waits on you',
    tone: piles.length >= 3 ? 'amber' : piles.length ? 'muted' : 'green',
    oneLine: piles.length ? `${piles.join(', ')}; ${input.linkId === 'bill' ? 'prices and bank sorting slow the biller' : input.linkId === 'build' ? 'the percents and prices make the pile a guess' : 'each one holds a stage downstream of you'}` : 'every pile that waits on the owner is clear',
    badge: piles.length ? (decisionThrottles ? 'throttles the link' : 'symptom of the link') : 'not short',
    throttles: decisionThrottles,
  }

  const under = input.clearsFloor === false
  const capital: ResourceReading = {
    id: 'capital',
    ...RESOURCE_META.capital,
    gauge: input.bankUsd != null ? `${signed(input.bankUsd)} in the bank` : 'the bank is not read',
    tone: under ? 'red' : input.clearsFloor ? 'green' : 'muted',
    oneLine:
      input.lowestUsd != null && input.lowestLabel
        ? `lowest point ${signed(input.lowestUsd)} on ${input.lowestLabel} against a ${money(input.floorUsd)} floor; ${under ? 'red, but the symptom of Bill and Collect' : 'clears the floor'}${input.bankSynced ? '' : ' · from the typed figure'}`
        : 'no forecast until cash on hand is read',
    badge: 'symptom of the link',
    throttles: false,
  }

  // Bills went out with no sender on them: somebody billed, so read one person rather than none.
  const byTheBills = input.billers === 0 && (input.billsWithoutSender ?? 0) > 0
  const billers = byTheBills ? 1 : input.billers
  const talentThrottles = input.linkId === 'bill' || input.linkId === 'collect' ? billers <= 1 : input.linkId === 'build' ? input.fieldPeople < 5 : false
  const talent: ResourceReading = {
    id: 'talent',
    ...RESOURCE_META.talent,
    gauge: `${input.fieldPeople} in the field · ${billers} billing${byTheBills ? ', by the bills' : ''}`,
    tone: talentThrottles ? 'amber' : 'muted',
    oneLine:
      input.linkId === 'bill' || input.linkId === 'collect'
        ? `the field is staffed, ${Math.round(input.fieldHours7d)}h this week; billing is ${billers === 1 ? 'one person with other work on her desk' : `${billers} people`}`
        : input.linkId === 'build'
          ? `${input.fieldPeople} in the field, ${Math.round(input.fieldHours7d)}h this week; the field sets the pace`
          : `${input.fieldPeople} in the field, ${Math.round(input.fieldHours7d)}h this week; ${billers} billing`,
    badge: talentThrottles ? 'throttles the link' : 'not short',
    throttles: talentThrottles,
  }
  return [decision, capital, talent]
}
