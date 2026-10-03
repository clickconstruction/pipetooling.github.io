/**
 * GC mode — design spike: Building and Closeout. The pay application a trade sends with each draw:
 * the AIA G702 (the summary page) and G703 (the continuation sheet, one row per line of the
 * statement of work). The app knows almost all of it: the contract, the lines, what was billed
 * before, the retainage, what the trade reported. The trade says only the period, its address once,
 * who signs, and the percent on any line that moved.
 *
 * The real build fills the same AIA template the Jobs Stages tab fills (`aiaG702G703Template.ts`).
 */
import type { Draw, Partner, Sow } from './gcTypes'

/**
 * The general contractor's name on the "To" line, as the portal and the plans email already say it.
 * One company for now (owner, 2026-10-02): change it here.
 */
export const GC_COMPANY_NAME = 'Click Construction'

/** What only the trade can say on a pay application. Everything else comes from the job. */
export interface PayAppInput {
  /** Percent done per line of the statement of work. A line left out keeps what they reported. */
  toPct: Record<string, number>
  /** The last day this draw covers. */
  periodTo: string
  /** Their mailing address. Asked once, then kept on their company. */
  address: string
  /** Their license line. Optional. */
  license: string
  signedBy: string
  signedTitle: string
  /** The conditional lien waiver for this amount, signed with the application. */
  waiverSigned: boolean
}

/** One row of the G703. Letters are the AIA columns. */
export interface PayAppLine {
  item: number
  sovId: string
  label: string
  /** C: the line's value in the statement of work. */
  scheduled: number
  /** D: work billed on earlier applications. */
  fromPrevious: number
  /** E: work done this period. */
  thisPeriod: number
  /** F: materials stored on site, not yet in place. Always 0 in the prototype. */
  stored: number
  /** G: D + E + F. */
  toDate: number
  /** G ÷ C, as a percent. */
  pct: number
  /** H: C − G. */
  balance: number
  /** I: retainage held on G. */
  retainage: number
}

/** The G702's numbered lines. */
export interface PayAppSummary {
  /** 1 */
  originalSum: number
  /** 2. No change orders in the prototype yet. */
  changeOrders: number
  /** 3 */
  sumToDate: number
  /** 4: the G703's column G total. */
  completedToDate: number
  /** 5 */
  retainagePct: number
  retainage: number
  /** 6 */
  earnedLessRetainage: number
  /** 7: what earlier applications were certified for. */
  previousCertificates: number
  /** 8: what this draw asks for. */
  currentDue: number
  /** 9 */
  balanceToFinish: number
}

export interface PayApplication {
  number: number
  lines: PayAppLine[]
  /** The G703's grand total row. */
  totals: Omit<PayAppLine, 'item' | 'sovId' | 'label' | 'pct'> & { pct: number }
  summary: PayAppSummary
}

/** A line's percent billed before application `number`: the highest any earlier draw took it to. */
function pctBefore(sow: Sow, sovId: string, number: number): number {
  let pct = 0
  for (const d of sow.draws) {
    if (d.number >= number) continue
    const line = d.lines.find((l) => l.sovId === sovId)
    if (line && line.toPct > pct) pct = line.toPct
  }
  return pct
}

/**
 * The G702 and G703 for application `number` on a statement of work. Earlier applications come
 * from the draws before it; `toPct` is what this one claims per line (a past draw passes its own
 * lines, a new one passes the trade's draft). A line cannot go below what was billed before.
 */
export function payApplication(sow: Sow, number: number, toPct: Record<string, number>): PayApplication {
  const rate = sow.retainagePct / 100
  const lines: PayAppLine[] = sow.sov.map((l, i) => {
    const before = pctBefore(sow, l.id, number)
    const now = Math.max(before, Math.min(100, toPct[l.id] ?? before))
    const fromPrevious = (l.amount * before) / 100
    const toDate = (l.amount * now) / 100
    return {
      item: i + 1,
      sovId: l.id,
      label: l.label,
      scheduled: l.amount,
      fromPrevious,
      thisPeriod: toDate - fromPrevious,
      stored: 0,
      toDate,
      pct: now,
      balance: l.amount - toDate,
      retainage: toDate * rate,
    }
  })
  const sum = (pick: (l: PayAppLine) => number) => lines.reduce((s, l) => s + pick(l), 0)
  const scheduled = sum((l) => l.scheduled)
  const toDate = sum((l) => l.toDate)
  const totals = {
    scheduled,
    fromPrevious: sum((l) => l.fromPrevious),
    thisPeriod: sum((l) => l.thisPeriod),
    stored: sum((l) => l.stored),
    toDate,
    pct: scheduled === 0 ? 0 : Math.round((toDate / scheduled) * 100),
    balance: sum((l) => l.balance),
    retainage: sum((l) => l.retainage),
  }
  const previousCertificates = sow.draws.filter((d) => d.number < number).reduce((s, d) => s + d.net, 0)
  const sumToDate = sow.price
  const earnedLessRetainage = toDate - totals.retainage
  return {
    number,
    lines,
    totals,
    summary: {
      originalSum: sow.price,
      changeOrders: 0,
      sumToDate,
      completedToDate: toDate,
      retainagePct: sow.retainagePct,
      retainage: totals.retainage,
      earnedLessRetainage,
      previousCertificates,
      currentDue: earnedLessRetainage - previousCertificates,
      balanceToFinish: sumToDate - earnedLessRetainage,
    },
  }
}

/** A new application starts from what the trade last reported on each line. */
export function payAppDraftPcts(sow: Sow): Record<string, number> {
  return Object.fromEntries(sow.sov.map((l) => [l.id, l.pctReported]))
}

/** A past draw's application, rebuilt from the draws: what the office opens from the Draws tab. */
export function payApplicationForDraw(sow: Sow, draw: Draw): PayApplication {
  return payApplication(sow, draw.number, Object.fromEntries(draw.lines.map((l) => [l.sovId, l.toPct])))
}

/** The four steps on the pay application's rail. The paper beside them marks what each one fills. */
export type PayAppStepKey = 'work' | 'details' | 'sign' | 'send'

export interface PayAppStep {
  n: number
  key: PayAppStepKey
  state: 'done' | 'now' | 'wait'
}

export function payAppSteps(app: PayApplication, input: PayAppInput): { steps: PayAppStep[]; ready: boolean } {
  const done: Record<PayAppStepKey, boolean> = {
    work: app.summary.currentDue > 0,
    details: input.periodTo !== '' && input.address.trim() !== '',
    sign: input.signedBy.trim() !== '' && input.signedTitle.trim() !== '' && input.waiverSigned,
    send: false,
  }
  const keys: PayAppStepKey[] = ['work', 'details', 'sign', 'send']
  const ready = done.work && done.details && done.sign
  // The first step not done is the one to do. Later ones wait, but stay open to fill in any order.
  const first = keys.find((k) => !done[k]) ?? 'send'
  return {
    steps: keys.map((key, i) => ({ n: i + 1, key, state: done[key] ? 'done' : key === first ? 'now' : 'wait' })),
    ready,
  }
}

/** What the trade's company already has on file for the pay application. */
export function payAppKnown(partner: Partner): { address: string; license: string; signedBy: string } {
  return { address: partner.address ?? '', license: partner.license ?? '', signedBy: partner.contact }
}

/** A new pay application: the percents they reported, what their company has on file, the rest blank. */
export function newPayAppDraft(sow: Sow, partner: Partner): PayAppInput {
  const known = payAppKnown(partner)
  return {
    toPct: payAppDraftPcts(sow),
    periodTo: '',
    address: known.address,
    license: known.license,
    signedBy: known.signedBy,
    signedTitle: '',
    waiverSigned: false,
  }
}
