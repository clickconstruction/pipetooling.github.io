/**
 * GC mode — design spike: Building and Closeout. The pay application a trade sends with each draw:
 * the AIA G702 (the summary page) and G703 (the continuation sheet, one row per line of the
 * statement of work). The app knows almost all of it: the contract, the lines, what was billed
 * before, the retainage, what the trade reported. The trade says only the period, its address once,
 * who signs, and the percent on any line that moved.
 *
 * The real build fills the same AIA template the Jobs Stages tab fills (`aiaG702G703Template.ts`).
 */
import type { Draw, DrawSentBack, GcProject, GcState, Partner, Sow, TradePackage } from './gcTypes'
import { money, shortDate } from './gcWords'
import { partnerById } from './gcLookups'

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
  /** The retainage release: every line at 100%, nothing held, line 8 is what was held. */
  final: boolean
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
 * A final application releases the retainage: nothing is held, so line 8 is what was held before.
 */
export function payApplication(sow: Sow, number: number, toPct: Record<string, number>, final = false): PayApplication {
  const rate = final ? 0 : sow.retainagePct / 100
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
    final,
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
  return payApplication(sow, draw.number, Object.fromEntries(draw.lines.map((l) => [l.sovId, l.toPct])), draw.final === true)
}

/** The final pay application a trade can send now: the next number, every line at 100%. */
export function finalPayApplication(sow: Sow): PayApplication {
  return payApplication(sow, sow.draws.length + 1, {}, true)
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

// ---------------------------------------------------------------------------------------------
// Our own crew: a trade we do ourselves, built on the Pipeline
// ---------------------------------------------------------------------------------------------

/**
 * Our own crew's work on a trade we do ourselves: one percent for the whole trade, the same
 * number Bill the owner bills from (`selfPerform.pctDone`, set by `selfReport`). The real build
 * reads it from the trade's Pipeline job. No draws, no retainage, no waivers: we pay our own crew
 * through payroll. Null for a trade we hire out.
 */
export function ownCrewWork(pkg: TradePackage): { pct: number; worth: number; done: number; ref: string } | null {
  const self = pkg.selfPerform
  if (!self) return null
  const pct = self.pctDone ?? 0
  return { pct, worth: self.value, done: (self.value * pct) / 100, ref: self.ref }
}

// ---------------------------------------------------------------------------------------------
// The office sends a pay application back
// ---------------------------------------------------------------------------------------------

/** The pay application we sent back that the trade has not sent again yet. Null: none waiting. */
export function sentBackOpen(sow: Sow): DrawSentBack | null {
  const next = sow.draws.length + 1
  const list = sow.sentBack ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const back = list[i]
    if (back && back.draw.number === next) return back
  }
  return null
}

/** How many times pay application `number` went back to the trade. 0: never. */
export function timesSentBack(sow: Sow, number: number): number {
  return (sow.sentBack ?? []).filter((b) => b.draw.number === number).length
}

/**
 * The resend starts from what they asked for, with the percent we see on each line we flagged,
 * and what they typed last time. They sign again: a new amount needs a new waiver.
 */
export function resendPayAppDraft(sow: Sow, partner: Partner, back: DrawSentBack): PayAppInput {
  const asked = new Map(back.draw.lines.map((l) => [l.sovId, l.toPct]))
  const weSee = new Map(back.lines.map((l) => [l.sovId, l.weSee]))
  const known = payAppKnown(partner)
  const typed = back.draw.payApp
  return {
    toPct: Object.fromEntries(sow.sov.map((l) => [l.id, weSee.get(l.id) ?? asked.get(l.id) ?? l.pctReported])),
    periodTo: typed?.periodTo ?? '',
    address: typed?.address || known.address,
    license: typed?.license || known.license,
    signedBy: typed?.signedBy || known.signedBy,
    signedTitle: typed?.signedTitle ?? '',
    waiverSigned: false,
  }
}

// ---------------------------------------------------------------------------------------------
// Closeout: retainage release and the final waivers
// ---------------------------------------------------------------------------------------------

/**
 * What we hold on a trade right now: the retainage on every approved draw, less a release once it
 * is paid. (sowMoney counts a release as soon as it is approved; the money leaves when it is paid.)
 */
export function retainageHeldNow(sow: Sow): number {
  const held = sow.draws.filter((d) => !d.final && d.status !== 'requested').reduce((s, d) => s + d.retainage, 0)
  const released = sow.draws.filter((d) => d.final && d.status === 'paid').reduce((s, d) => s + d.net, 0)
  return held - released
}

/** Every line billed at 100% and approved: the work is all paid for except the retainage. */
export function workAllBilled(sow: Sow): boolean {
  return sow.sov.length > 0 && sow.sov.every((l) => l.pctBilled >= 100)
}

export type CloseoutKey = 'billed' | 'accepted' | 'warranty' | 'finalApp' | 'released' | 'finalWaiver'

export interface CloseoutStep {
  key: CloseoutKey
  label: string
  /** Who moves it: our office, or the trade from its portal. */
  who: 'office' | 'trade'
  done: boolean
  detail: string
}

export interface TradeCloseout {
  steps: CloseoutStep[]
  /** The first step not done. Null once the trade is closed out. */
  next: CloseoutStep | null
  closed: boolean
  held: number
  /** The retainage release, once the trade has asked for it. */
  finalDraw: Draw | null
  /** May the trade send its final pay application now? */
  canAskFinal: boolean
}

/**
 * A trade's closeout, in order: every line billed, we accept the work (the punch list is done),
 * their warranty letter, their final pay application with a conditional waiver on final payment,
 * we approve and pay the retainage, then their unconditional waiver on final payment.
 */
export function tradeCloseout(sow: Sow): TradeCloseout {
  const billed = workAllBilled(sow)
  const open = sow.draws.find((d) => !d.final && d.status === 'requested')
  const finalDraw = sow.draws.find((d) => d.final) ?? null
  const held = retainageHeldNow(sow)
  const scheduled = sow.sov.reduce((s, l) => s + l.amount, 0)
  const billedPct = scheduled === 0 ? 0 : Math.round(sow.sov.reduce((s, l) => s + l.amount * l.pctBilled, 0) / scheduled)
  const accepted = Boolean(sow.acceptedOn)
  const warranty = Boolean(sow.warrantyOn)
  const steps: CloseoutStep[] = [
    {
      key: 'billed',
      label: 'Every line billed',
      who: 'trade',
      done: billed,
      detail: billed ? 'All the work is billed and approved.' : open ? `${billedPct}% billed. Draw ${open.number} is waiting on us.` : `${billedPct}% billed so far.`,
    },
    {
      key: 'accepted',
      label: 'We accept the work',
      who: 'office',
      done: accepted,
      detail: accepted ? `Accepted ${shortDate(sow.acceptedOn ?? null)}.` : 'Walk the work with them. When the punch list is done, accept it.',
    },
    {
      key: 'warranty',
      label: 'Warranty letter',
      who: 'trade',
      done: warranty,
      detail: warranty ? `In ${shortDate(sow.warrantyOn ?? null)}.` : 'They send it from their portal.',
    },
    {
      key: 'finalApp',
      label: 'Final pay application',
      who: 'trade',
      done: finalDraw !== null,
      detail: finalDraw
        ? `Asked for ${money(finalDraw.net)} ${shortDate(finalDraw.requestedOn)}, with a conditional waiver on final payment.`
        : `It asks for the ${money(held)} we hold.`,
    },
    {
      key: 'released',
      label: 'Retainage paid',
      who: 'office',
      done: finalDraw?.status === 'paid',
      detail:
        finalDraw?.status === 'paid'
          ? `Paid ${money(finalDraw.net)}.`
          : finalDraw?.status === 'approved'
            ? 'Approved. Mark it paid.'
            : finalDraw
              ? 'Check the final pay application and approve it.'
              : 'Waits for the final pay application.',
    },
    {
      key: 'finalWaiver',
      label: 'Final waiver',
      who: 'trade',
      done: finalDraw?.status === 'paid' && finalDraw.waiver === 'unconditional',
      detail:
        finalDraw?.status === 'paid' && finalDraw.waiver === 'unconditional'
          ? 'Their unconditional waiver on final payment is in.'
          : 'They sign the unconditional waiver on final payment once paid.',
    },
  ]
  const next = steps.find((st) => !st.done) ?? null
  return {
    steps,
    next,
    closed: next === null,
    held,
    finalDraw,
    canAskFinal: billed && accepted && warranty && finalDraw === null && !open && held > 0,
  }
}

export interface CloseoutRow {
  pkg: TradePackage
  partner: Partner | undefined
  closeout: TradeCloseout
}

/** The Closeout tab: every trade with a statement of work, what we still hold, what we have paid back. */
export function projectCloseout(state: GcState, project: GcProject) {
  const rows: CloseoutRow[] = project.packages
    .filter((pkg) => pkg.sow?.status === 'signed')
    .map((pkg) => {
      const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      return { pkg, partner: invite ? partnerById(state, invite.partnerId) : undefined, closeout: tradeCloseout(pkg.sow as Sow) }
    })
  const released = rows.reduce((s, r) => s + (r.closeout.finalDraw?.status === 'paid' ? r.closeout.finalDraw.net : 0), 0)
  return {
    rows,
    /** Trades with a statement of work not signed yet: nothing to close out. */
    notStarted: project.packages.filter((pkg) => pkg.sow && pkg.sow.status !== 'signed'),
    ours: project.packages.filter((pkg) => pkg.selfPerform),
    held: rows.reduce((s, r) => s + r.closeout.held, 0),
    released,
    closed: rows.filter((r) => r.closeout.closed).length,
  }
}
