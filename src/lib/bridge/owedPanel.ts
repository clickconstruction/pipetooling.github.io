/**
 * The Money owed panel (link PR 10): owed to you by how late and owed by you
 * by when due, the balance as a waterfall (cash, owed to you, the three
 * kinds of owed by you, net position, the unbilled work, once billed), where
 * each number comes from and what can make it wrong, and the net position
 * line. Pure: the page passes the finance hook's buckets and the forecast's
 * bills.
 */

export type OwedBar = { label: string; usd: number; w: number; fill: 'blue' | 'amber' | 'red' | 'grey'; count?: number }
export type OwedWaterfallBar = { label: string; usd: number; kind: 'step' | 'total' }
export type OwedSourceRow = { input: string; from: string; risk: string; tone: 'amber' | 'green'; door: { to: string; label: string } }

export type OwedPanel = {
  aging: OwedBar[]
  due: OwedBar[]
  lateLine: string
  netLine: string
  waterfall: OwedWaterfallBar[]
  sources: OwedSourceRow[]
  closing: string
}

export type OwedPanelInput = {
  todayYmd: string
  cashUsd: number | null
  ar: { total: number; count: number; items: ReadonlyArray<{ amount: number; dateYmd: string | null }> }
  arCollections: { total: number; count: number }
  ap: { total: number; supplyTotal: number; payrollTotal: number; subLaborTotal: number; upcomingTotal: number }
  unbilled: { total: number; count: number }
  /** The forecast's scheduled outflows in the window, by day. */
  bills: ReadonlyArray<{ ymd: string; usd: number; label: string }>
  noContractJobs: number
  noPctJobs: number
  pendingClosedHours: number
  unattributedNoncard: number | null
  dayLabel: (ymd: string) => string
}

export const OWED_DOORS = {
  billing: { to: '/jobs?tab=billing', label: 'Open Billing' },
  collections: { to: '/jobs?tab=collections', label: 'Open Collections' },
  jobs: { to: '/jobs?tab=stages', label: 'Price the jobs' },
  banking: { to: '/banking', label: 'Sort' },
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  sheets: { to: '/people?tab=subs', label: 'Open sheets' },
} as const

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${Math.abs(n) >= 1000 ? `${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k` : Math.round(Math.abs(n)).toLocaleString('en-US')}`
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
const ymdAdd = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export function buildOwedPanel(input: OwedPanelInput): OwedPanel {
  // Owed to you by how late: days since the invoice was sent.
  const buckets: Array<{ label: string; min: number; max: number; fill: OwedBar['fill']; usd: number; count: number }> = [
    { label: 'current', min: -Infinity, max: 30, fill: 'blue', usd: 0, count: 0 },
    { label: '31–60 days', min: 31, max: 60, fill: 'amber', usd: 0, count: 0 },
    { label: '61–90 days', min: 61, max: 90, fill: 'red', usd: 0, count: 0 },
    { label: '90+ days', min: 91, max: Infinity, fill: 'red', usd: 0, count: 0 },
  ]
  let undated = 0
  let undatedUsd = 0
  for (const it of input.ar.items) {
    if (!(it.amount > 0)) continue
    if (!it.dateYmd) {
      undated += 1
      undatedUsd += it.amount
      continue
    }
    const age = daysBetween(it.dateYmd, input.todayYmd)
    const b = buckets.find((x) => age >= x.min && age <= x.max) ?? buckets[0]!
    b.usd += it.amount
    b.count += 1
  }
  const maxAging = Math.max(1, ...buckets.map((b) => b.usd), undatedUsd)
  const aging: OwedBar[] = buckets.map((b) => ({ label: b.label, usd: b.usd, count: b.count, w: Math.round((b.usd / maxAging) * 100), fill: b.fill }))
  if (undated > 0) aging.push({ label: 'no date', usd: undatedUsd, count: undated, w: Math.round((undatedUsd / maxAging) * 100), fill: 'grey' })

  // Owed by you by when due: the forecast's bills in the window.
  const dueBuckets: Array<{ label: string; from: string; to: string; usd: number }> = [
    { label: 'this week', from: input.todayYmd, to: ymdAdd(input.todayYmd, 6), usd: 0 },
    { label: 'next week', from: ymdAdd(input.todayYmd, 7), to: ymdAdd(input.todayYmd, 13), usd: 0 },
    { label: 'weeks 3–4', from: ymdAdd(input.todayYmd, 14), to: ymdAdd(input.todayYmd, 27), usd: 0 },
    { label: 'later', from: ymdAdd(input.todayYmd, 28), to: '9999-12-31', usd: 0 },
  ]
  for (const b of input.bills) {
    const d = dueBuckets.find((x) => b.ymd >= x.from && b.ymd <= x.to) ?? (b.ymd < input.todayYmd ? dueBuckets[0]! : null)
    if (d) d.usd += b.usd
  }
  const maxDue = Math.max(1, ...dueBuckets.map((b) => b.usd))
  const due: OwedBar[] = dueBuckets.map((b) => ({ label: b.label, usd: b.usd, w: Math.round((b.usd / maxDue) * 100), fill: 'grey' }))

  const lateUsd = buckets.slice(1).reduce((s, b) => s + b.usd, 0)
  const lateCount = buckets.slice(1).reduce((s, b) => s + b.count, 0)
  const oldest = [...buckets].reverse().find((b) => b.usd > 0)
  const twoWeeks = (dueBuckets[0]!.usd ?? 0) + (dueBuckets[1]!.usd ?? 0)
  const lateLine = `Late: ${shortK(lateUsd)} on ${lateCount} ${plural(lateCount, 'invoice', 'invoices')}${oldest && oldest.label !== 'current' ? `; the oldest ${shortK(oldest.usd)} is ${oldest.label === '90+ days' ? 'past 90 days' : oldest.label}` : ''}. Due from you in two weeks: ${shortK(twoWeeks)}${input.cashUsd != null ? `, against ${shortK(input.cashUsd)} in the bank` : ''}.`

  const cash = input.cashUsd ?? 0
  const net = cash + input.ar.total - input.ap.total
  const payroll = input.ap.payrollTotal + input.ap.upcomingTotal
  const waterfall: OwedWaterfallBar[] = [
    { label: 'cash', usd: cash, kind: 'step' },
    { label: 'owed to you', usd: input.ar.total, kind: 'step' },
    { label: 'supply bills', usd: -input.ap.supplyTotal, kind: 'step' },
    { label: 'payroll owed', usd: -payroll, kind: 'step' },
    { label: 'sub labor', usd: -input.ap.subLaborTotal, kind: 'step' },
    { label: 'net position', usd: net, kind: 'total' },
    { label: 'not yet billed', usd: input.unbilled.total, kind: 'step' },
    { label: 'once billed', usd: net + input.unbilled.total, kind: 'total' },
  ]
  const netLine = `Net position: cash ${shortK(cash)} + owed to you ${shortK(input.ar.total)} − owed by you ${shortK(input.ap.total)} = ${net >= 0 ? '+' : ''}${shortK(net)}. With the finished work billed it would be ${net + input.unbilled.total >= 0 ? '+' : ''}${shortK(net + input.unbilled.total)}.`

  const sources: OwedSourceRow[] = [
    { input: 'owed to you', from: 'invoices sent and not paid, with the jobs parked in Collections left out', risk: lateCount > 0 ? `${lateCount} ${plural(lateCount, 'is', 'are')} late and the forecast assumes they land within their pace; a payment recorded late keeps a paid invoice open` : 'nothing is late; a payment recorded late keeps a paid invoice open', tone: lateCount > 0 ? 'amber' : 'green', door: OWED_DOORS.billing },
    { input: 'collections', from: `billed jobs the office flagged as hard to collect: ${shortK(input.arCollections.total)} on ${input.arCollections.count}, shown and not counted`, risk: input.arCollections.count > 0 ? 'a parked job that pays stays parked until someone un-flags it' : 'nothing is parked', tone: input.arCollections.count > 0 ? 'amber' : 'green', door: OWED_DOORS.collections },
    { input: 'not yet billed', from: `finished work by the Stages’ ready-to-bill rows, ${shortK(input.unbilled.total)} on ${input.unbilled.count} ${plural(input.unbilled.count, 'job', 'jobs')}`, risk: input.noContractJobs > 0 || input.noPctJobs > 0 ? `${input.noContractJobs} open ${plural(input.noContractJobs, 'job has', 'jobs have')} no contract price, so finished work there reads $0; ${input.noPctJobs} have no %` : 'every open job carries a price and a %', tone: input.noContractJobs > 0 || input.noPctJobs > 0 ? 'amber' : 'green', door: OWED_DOORS.jobs },
    { input: 'supply bills', from: `supply-house invoices not yet paid, ${shortK(input.ap.supplyTotal)}`, risk: (input.unattributedNoncard ?? 0) > 0 ? `a bill paid by card and never matched stays open; ${(input.unattributedNoncard ?? 0).toLocaleString('en-US')} bank rows are not sorted` : 'every bank row is sorted', tone: (input.unattributedNoncard ?? 0) > 0 ? 'amber' : 'green', door: OWED_DOORS.banking },
    { input: 'payroll owed', from: `stubbed weeks not yet paid, plus an estimate for weeks worked and not reported, ${shortK(payroll)}`, risk: input.pendingClosedHours > 0 ? `${Math.round(input.pendingClosedHours)}h unapproved: the estimate stands in for the real figure` : 'every hour is approved', tone: input.pendingClosedHours > 0 ? 'amber' : 'green', door: OWED_DOORS.approvals },
    { input: 'sub labor', from: `sub labor sheets not yet paid, ${shortK(input.ap.subLaborTotal)}`, risk: 'a sheet filed late shows up after the week it belongs to', tone: 'amber', door: OWED_DOORS.sheets },
  ]
  const closing = `The gap between ${net >= 0 ? '+' : ''}${shortK(net)} and ${net + input.unbilled.total >= 0 ? '+' : ''}${shortK(net + input.unbilled.total)} is Bill’s pile. The gap between ${net >= 0 ? '+' : ''}${shortK(net)} and ${shortK(cash)} in the bank is Collect’s.`
  return { aging, due, lateLine, netLine, waterfall, sources, closing }
}
