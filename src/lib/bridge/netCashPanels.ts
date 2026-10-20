/**
 * The net position and cash breakdowns (link PR 11): behind a press on each
 * chart. Net position: what moved it over the window as a waterfall (the
 * start, the change in cash, in owed to you, in owed by you, today), four
 * source rows (the cash row red when the chart's figure and the bank's
 * disagree), and the line against the paper profit. Cash: where the window's
 * cash comes from and goes as a waterfall (the bank today, the receipts by
 * how sure they are, the bills by kind, the end of the window), eight source
 * rows, and the lowest-point line. Pure.
 */
import type { NetPositionDay } from './netPosition'

export type PanelBar = { label: string; usd: number; kind: 'step' | 'total'; fill?: 'green' | 'grey' | 'amber' | 'blue' | 'red' }
export type PanelSourceRow = { input: string; from: string; risk: string; tone: 'amber' | 'green' | 'red'; door: { to: string; label: string } }

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k` : Math.round(Math.abs(n)).toLocaleString('en-US')}`
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${shortK(n)}`

export const NET_DOORS = {
  banking: { to: '/banking', label: 'Sort' },
  billing: { to: '/jobs?tab=billing', label: 'Open Billing' },
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  bridge: { to: '/bridge', label: 'The window' },
} as const

export type NetPanel = { waterfall: PanelBar[]; sources: PanelSourceRow[]; paper: string; startLabel: string }

export function buildNetPanel(input: {
  history: ReadonlyArray<NetPositionDay>
  startLabel: string
  bankUsd: number | null
  typedRolledUsd: number | null
  typedLabel: string | null
  pendingClosedHours: number
  paperProfitUsd: number | null
  billingLagUsd: number | null
  costGapUsd: number | null
}): NetPanel | null {
  const first = input.history[0]
  const last = input.history[input.history.length - 1]
  if (!first || !last) return null
  const dCash = last.cashUsd - first.cashUsd
  const dAr = last.arUsd - first.arUsd
  const dAp = last.apUsd - first.apUsd
  const waterfall: PanelBar[] = [
    { label: input.startLabel, usd: first.netUsd, kind: 'total', fill: 'blue' },
    { label: 'cash', usd: dCash, kind: 'step' },
    { label: 'owed to you', usd: dAr, kind: 'step' },
    { label: dAp >= 0 ? 'owed by you grew' : 'owed by you fell', usd: -dAp, kind: 'step' },
    { label: 'today', usd: last.netUsd, kind: 'total', fill: 'blue' },
  ]
  const twoFigures = input.bankUsd != null && input.typedRolledUsd != null && Math.abs(input.bankUsd - input.typedRolledUsd) >= 1000
  const sources: PanelSourceRow[] = [
    {
      input: 'cash',
      from: input.bankUsd != null ? 'the bank’s balance today, walked back through the ledger’s bank flows' : `the figure typed ${input.typedLabel ?? 'earlier'}, rolled forward and back by the bank flows the app has`,
      risk: twoFigures ? `the bank reads ${shortK(input.bankUsd as number)} and the typed figure rolled through the ledger reads ${shortK(input.typedRolledUsd as number)}: ${shortK(Math.abs((input.bankUsd as number) - (input.typedRolledUsd as number)))} of flows are not in the app, so the line’s past may sit that far off` : input.bankUsd != null ? 'the bank is read; the line’s past is only as good as the sorted flows' : 'the bank could not be read; the typed figure stands',
      tone: twoFigures ? 'red' : input.bankUsd != null ? 'green' : 'amber',
      door: NET_DOORS.banking,
    },
    { input: 'owed to you', from: 'invoices sent and not paid, by day, with Collections left out', risk: 'a payment recorded late keeps the line high on days it should not be', tone: 'amber', door: NET_DOORS.billing },
    { input: 'owed by you', from: 'supply bills, payroll owed and sub labor, by day', risk: input.pendingClosedHours > 0 ? `the payroll part is an estimate while ${Math.round(input.pendingClosedHours)}h wait for approval` : 'every hour is approved', tone: input.pendingClosedHours > 0 ? 'amber' : 'green', door: NET_DOORS.approvals },
    { input: 'the start', from: `${input.startLabel}, the first day of the page’s window`, risk: 'move the start and the change moves with it; it is the page’s window, not a quarter', tone: 'amber', door: NET_DOORS.bridge },
  ]
  const delta = last.netUsd - first.netUsd
  const paper =
    input.paperProfitUsd != null && input.billingLagUsd != null && input.costGapUsd != null
      ? `Against the paper: profit for the same weeks says ${signed(input.paperProfitUsd)}; net position says ${signed(delta)}. The ${shortK(Math.abs(input.paperProfitUsd - delta))} between them is ${signed(input.billingLagUsd)} earned and not invoiced, less ${shortK(Math.abs(input.costGapUsd))} of costs the paper misses. Net position moves when Bill moves.`
      : `Net position moved ${signed(delta)} since ${input.startLabel}. It moves when Bill moves.`
  return { waterfall, sources, paper, startLabel: input.startLabel }
}

export type CashPanel = { waterfall: PanelBar[]; sources: PanelSourceRow[]; lowest: string }

export const CASH_DOORS = {
  bank: { to: '/bridge', label: 'Read again' },
  billing: { to: '/jobs?tab=billing', label: 'Open Billing' },
  banking: { to: '/banking', label: 'Sort' },
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  sheets: { to: '/people?tab=subs', label: 'Open sheets' },
  floor: { to: '/bridge', label: 'The floor' },
} as const

export function buildCashPanel(input: {
  cashTodayUsd: number
  bankSynced: boolean
  typedLabel: string | null
  confidence: { promisedUsd: number; paceUsd: number; lateUsd: number; lateCount: number; totalUsd: number }
  bills: ReadonlyArray<{ usd: number; label: string }>
  dailyDrainUsd: number
  daysAhead: number
  endUsd: number
  lowestUsd: number
  lowestLabel: string
  floorUsd: number
  clearsFloor: boolean
  daysUnderFloor: number
  payrollWeeklyEstUsd: number
  pendingClosedHours: number
  unattributedNoncard: number | null
  doubtfulUsd: number
  doubtfulCount: number
  collectionsUsd: number
  collectionsCount: number
  carryLabel: string | null
  carryUsd: number | null
}): CashPanel {
  const supply = input.bills.filter((b) => /supply/i.test(b.label)).reduce((s, b) => s + b.usd, 0)
  const payroll = input.bills.filter((b) => /payroll/i.test(b.label)).reduce((s, b) => s + b.usd, 0)
  const sub = input.bills.filter((b) => /sub labor/i.test(b.label)).reduce((s, b) => s + b.usd, 0)
  const other = input.bills.reduce((s, b) => s + b.usd, 0) - supply - payroll - sub
  const drain = input.dailyDrainUsd * input.daysAhead
  const c = input.confidence
  const waterfall: PanelBar[] = [
    { label: 'bank today', usd: input.cashTodayUsd, kind: 'total', fill: 'blue' },
    { label: 'promised', usd: c.promisedUsd, kind: 'step', fill: 'green' },
    { label: 'by pace', usd: c.paceUsd, kind: 'step', fill: 'blue' },
    { label: 'late, assumed', usd: c.lateUsd, kind: 'step', fill: 'amber' },
    { label: 'supply bills', usd: -supply, kind: 'step' },
    { label: 'payroll', usd: -payroll, kind: 'step' },
    { label: 'sub labor', usd: -sub, kind: 'step' },
    { label: 'office parts', usd: -(drain + other), kind: 'step' },
    { label: 'end of window', usd: input.endUsd, kind: 'total', fill: 'blue' },
  ]
  const lateShare = c.totalUsd > 0 ? Math.round((c.lateUsd / c.totalUsd) * 100) : 0
  const sources: PanelSourceRow[] = [
    { input: 'bank today', from: input.bankSynced ? 'the bank’s balance over its API, read when the page opened' : `the figure typed ${input.typedLabel ?? 'earlier'}, rolled forward through the bank flows since`, risk: input.bankSynced ? 'the bank may not be the whole bank; a typed figure that disagrees is shown under the chart' : 'the bank could not be read; the typed figure may be days old', tone: input.bankSynced ? 'green' : 'amber', door: CASH_DOORS.bank },
    { input: 'promised', from: 'invoices where the customer gave a pay date', risk: c.promisedUsd < c.totalUsd * 0.1 ? `almost none carry a date: ${shortK(c.promisedUsd)} of ${shortK(c.totalUsd)}` : 'a promise can slip', tone: c.promisedUsd < c.totalUsd * 0.1 ? 'amber' : 'green', door: CASH_DOORS.billing },
    { input: 'by pace', from: 'open invoices placed on the day this customer, or the company, usually pays', risk: 'pace is an average; one slow customer moves a week', tone: 'amber', door: CASH_DOORS.billing },
    { input: 'late, assumed', from: `${c.lateCount} late ${c.lateCount === 1 ? 'invoice' : 'invoices'} assumed to land within their pace: ${shortK(c.lateUsd)}, ${lateShare}% of the window`, risk: `if they slip past ${input.carryLabel ?? 'the day they land'} the floor breaks for longer; ${input.doubtfulCount} past 60 days (${shortK(input.doubtfulUsd)}) and collections (${shortK(input.collectionsUsd)}) are not counted`, tone: lateShare >= 50 ? 'red' : 'amber', door: CASH_DOORS.billing },
    { input: 'supply bills', from: 'unpaid supply-house invoices on their due dates', risk: (input.unattributedNoncard ?? 0) > 0 ? `a bill paid by card and never matched is counted twice; ${(input.unattributedNoncard ?? 0).toLocaleString('en-US')} bank rows are not sorted` : 'every bank row is sorted', tone: (input.unattributedNoncard ?? 0) > 0 ? 'amber' : 'green', door: CASH_DOORS.banking },
    { input: 'payroll', from: `Fridays at ${shortK(input.payrollWeeklyEstUsd)} a week, estimated from the approved hours`, risk: input.pendingClosedHours > 0 ? `${Math.round(input.pendingClosedHours)}h unapproved: the real Friday is bigger` : 'every hour is approved', tone: input.pendingClosedHours > 0 ? 'amber' : 'green', door: CASH_DOORS.approvals },
    { input: 'sub labor', from: 'sub sheets owed, on a 14-day horizon', risk: 'a sheet filed late lands late', tone: 'amber', door: CASH_DOORS.sheets },
    { input: 'the floor', from: `a setting: ${shortK(input.floorUsd)}`, risk: input.floorUsd < input.payrollWeeklyEstUsd ? `one Friday payroll alone is ${shortK(input.payrollWeeklyEstUsd)}; the line can clear the floor on a Thursday and miss Friday` : 'a floor nobody has moved since it was set', tone: input.floorUsd < input.payrollWeeklyEstUsd ? 'amber' : 'green', door: CASH_DOORS.floor },
  ]
  const lowest = input.clearsFloor
    ? `The lowest point is ${shortK(input.lowestUsd)} on ${input.lowestLabel}, above the ${shortK(input.floorUsd)} floor.${input.carryLabel && input.carryUsd != null ? ` ${shortK(input.carryUsd)} lands ${input.carryLabel} if the late invoices hold their pace.` : ''} The window’s cash is Bill’s; the week’s is Collect’s.`
    : `The lowest point is ${shortK(input.lowestUsd)} on ${input.lowestLabel}, ${input.daysUnderFloor} ${input.daysUnderFloor === 1 ? 'day' : 'days'} under the floor.${input.carryLabel && input.carryUsd != null ? ` It is a timing gap: ${shortK(input.carryUsd)} lands ${input.carryLabel} if the late invoices hold their pace.` : ''} The week’s cash is Collect’s work; the window’s cash is Bill’s. Capital is the symptom, not the link.`
  return { waterfall, sources, lowest }
}
