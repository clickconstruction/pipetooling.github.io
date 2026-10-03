/**
 * GC mode — design spike: Building and Closeout. The pay application a trade sends with each draw:
 * the AIA G702 (the summary page) and G703 (the continuation sheet, one row per line of the
 * statement of work). The app knows almost all of it: the contract, the lines, what was billed
 * before, the retainage, what the trade reported. The trade says only the period, its address once,
 * who signs, and the percent on any line that moved.
 *
 * The real build fills the same AIA template the Jobs Stages tab fills (`aiaG702G703Template.ts`).
 */
import type { ChangeOrder, Draw, DrawSentBack, GcProject, GcState, Partner, Sow, SovLine, TradePackage } from './gcTypes'
import { money, shortDate } from './gcWords'
import { partnerById } from './gcLookups'
import { GC_COMPANY } from './gcFixture'
import { punchCounts, punchWords } from './gcBuildingPunch'

/**
 * The general contractor's name on the "To" line. It reads the one company record in the fixture
 * (`GC_COMPANY`), so a later company changes it there (owner, 2026-10-02: one record).
 */
export const GC_COMPANY_NAME = GC_COMPANY.name

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
  /** 2: the change orders signed into the statement of work. */
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
  // Line 2: the change orders signed into the statement of work. Line 3 adds them to the original.
  const changeOrders = changeOrderLines(sow).reduce((s, l) => s + l.amount, 0)
  const sumToDate = sow.price + changeOrders
  const earnedLessRetainage = toDate - totals.retainage
  return {
    number,
    final,
    lines,
    totals,
    summary: {
      originalSum: sow.price,
      changeOrders,
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
  // The form is what the trade sent: a draw approved for less keeps what they asked in `asked`.
  const lines = draw.asked?.lines ?? draw.lines
  return payApplication(sow, draw.number, Object.fromEntries(lines.map((l) => [l.sovId, l.toPct])), draw.final === true)
}

/**
 * A draw approved for less (owner, 2026-10-02): the percent we approve on each line, never above
 * what they asked nor below what was billed before. It pays now; the rest stays theirs to ask for.
 */
export function drawApprovedLess(sow: Sow, draw: Draw, weApprove: Record<string, number>): Pick<Draw, 'lines' | 'gross' | 'retainage' | 'net'> {
  const toPct = Object.fromEntries(draw.lines.map((l) => [l.sovId, Math.min(l.toPct, weApprove[l.sovId] ?? l.toPct)]))
  const app = payApplication(sow, draw.number, toPct)
  const gross = app.totals.thisPeriod
  const retainage = (gross * sow.retainagePct) / 100
  return {
    lines: app.lines.filter((l) => l.thisPeriod > 0).map((l) => ({ sovId: l.sovId, toPct: l.pct })),
    gross,
    retainage,
    net: gross - retainage,
  }
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
export function ownCrewWork(pkg: TradePackage): OwnCrewWork | null {
  const self = pkg.selfPerform
  if (!self) return null
  const byLine = self.pctByLine
  const stages = crewStages(pkg).map((st) => ({ ...st, pct: byLine?.[st.lineId] ?? 0 }))
  // Reported by stage: the whole-trade percent follows from the stages. Otherwise the one number.
  const exact = byLine ? crewPctFromStages(pkg, byLine) : (self.pctDone ?? 0)
  return { pct: Math.round(exact), worth: self.value, done: (self.value * exact) / 100, ref: self.ref, stages, byStage: Boolean(byLine) }
}

export interface OwnCrewWork {
  /** The whole trade, as a whole percent. */
  pct: number
  worth: number
  done: number
  /** The Pipeline job our crew runs it on. */
  ref: string
  /** Each stage, its share of the trade and its percent done. */
  stages: { lineId: string; label: string; weight: number; pct: number }[]
  /** True once our crew reports by stage. */
  byStage: boolean
}

/**
 * How much of a trade each stage is worth, by its name (my default, owner unconfirmed): rough in
 * carries the most. A stage with another name gets an even share. The shares are scaled to 100.
 */
export const CREW_STAGE_WEIGHTS: Record<string, number> = { Underground: 20, 'Rough in': 35, 'Top out': 25, Trim: 20 }

export function crewStages(pkg: TradePackage): { lineId: string; label: string; weight: number }[] {
  const raw = pkg.scope.map((item) => ({ lineId: item.id, label: item.label, weight: CREW_STAGE_WEIGHTS[item.label] ?? 25 }))
  const total = raw.reduce((s, r) => s + r.weight, 0)
  return raw.map((r) => ({ ...r, weight: total === 0 ? 0 : (r.weight / total) * 100 }))
}

/** The whole-trade percent our crew's stages come to, weighed by each stage's share. */
export function crewPctFromStages(pkg: TradePackage, byLine: Record<string, number>): number {
  return crewStages(pkg).reduce((s, st) => s + (st.weight * (byLine[st.lineId] ?? 0)) / 100, 0)
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

export type CloseoutKey = 'billed' | 'accepted' | 'finalApp' | 'ownerReleased' | 'released' | 'finalWaiver'

/** We pay a trade its retainage this many days after the owner pays us ours (owner, 2026-10-02). */
export const TRADE_RETAINAGE_WAIT_DAYS = 10

/** The day after `days` days, as YYYY-MM-DD (UTC, so no time zone moves it). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/**
 * The day the owner paid us the retainage they held: the day they paid our final pay application
 * on Bill the owner. The same record Owner Billing's `ownerReleasedRetainage` reads (that file
 * imports this one, so this reads the record itself). Null: not paid yet.
 */
export function ownerRetainagePaidOn(project: GcProject): string | null {
  return project.ownerBilling?.payApps?.find((a) => a.final === true && a.paidOn !== null)?.paidOn ?? null
}

/** The first day we may pay a trade its retainage: 10 days after the owner pays us ours. Null: not paid yet. */
export function tradeRetainageOpensOn(project: GcProject): string | null {
  const paidOn = ownerRetainagePaidOn(project)
  return paidOn ? addDays(paidOn, TRADE_RETAINAGE_WAIT_DAYS) : null
}

export interface CloseoutStep {
  key: CloseoutKey
  label: string
  /** Who moves it: our office, the trade from its portal, or the owner paying us. */
  who: 'office' | 'trade' | 'owner'
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
  /** May we approve and pay their retainage now: 10 days after the owner paid us ours. */
  canPay: boolean
  /** The first day we may pay it, once the owner has paid us. Null: the owner has not yet. */
  opensOn: string | null
}

/**
 * A trade's closeout, in order (owner, 2026-10-02): every line billed; we accept the work (the
 * punch list is done); their final pay application with a conditional final release of lien, the
 * one paper asked for (our own final to the owner waits for every trade's); the owner pays us our
 * retainage and 10 days pass; we approve and pay theirs; their unconditional final release of lien.
 */
export function tradeCloseout(sow: Sow, project?: GcProject, today?: string): TradeCloseout {
  const billed = workAllBilled(sow)
  const open = sow.draws.find((d) => !d.final && d.status === 'requested')
  const finalDraw = sow.draws.find((d) => d.final) ?? null
  const held = retainageHeldNow(sow)
  const scheduled = sow.sov.reduce((s, l) => s + l.amount, 0)
  const billedPct = scheduled === 0 ? 0 : Math.round(sow.sov.reduce((s, l) => s + l.amount * l.pctBilled, 0) / scheduled)
  const accepted = Boolean(sow.acceptedOn)
  // The trade's punch list (owner, 2026-10-03): the work is accepted once every item is checked fixed.
  const pkg = project?.packages.find((k) => k.sow === sow)
  const punch = project && pkg ? punchCounts(project, pkg.id) : null
  // Without the project and today (an older caller), the owner's payment counts as not yet in.
  const paidOn = project ? ownerRetainagePaidOn(project) : null
  const opensOn = project ? tradeRetainageOpensOn(project) : null
  const paidBack = finalDraw?.status === 'paid'
  // A release already paid went past this step, whatever the dates say now.
  const waited = paidBack || (opensOn !== null && today !== undefined && opensOn <= today)
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
      detail: accepted
        ? `Accepted ${shortDate(sow.acceptedOn ?? null)}.`
        : punch && punch.total > 0
          ? punch.open + punch.fixed === 0
            ? `The punch list is done: ${punch.done} checked. Accept the work.`
            : `Punch list: ${punchWords(punch)}. Accept the work once every item is checked fixed.`
          : 'Walk the work with them. When the punch list is done, accept it.',
    },
    {
      key: 'finalApp',
      label: 'Final pay application',
      who: 'trade',
      done: finalDraw !== null,
      detail: finalDraw
        ? `Asked for ${money(finalDraw.net)} ${shortDate(finalDraw.requestedOn)}, with a conditional final release of lien.`
        : `It asks for the ${money(held)} we hold, with a conditional final release of lien.`,
    },
    {
      key: 'ownerReleased',
      label: 'The owner pays us ours',
      who: 'owner',
      done: waited,
      detail: waited
        ? `The owner paid us our retainage ${shortDate(paidOn)}.`
        : paidOn
          ? `The owner paid us ours ${shortDate(paidOn)}. Theirs can be paid ${shortDate(opensOn)}.`
          : `Theirs is paid ${TRADE_RETAINAGE_WAIT_DAYS} days after the owner pays our final pay application on Bill the owner.`,
    },
    {
      key: 'released',
      label: 'Retainage paid',
      who: 'office',
      done: paidBack,
      detail: paidBack
        ? `Paid ${money(finalDraw?.net ?? 0)}.`
        : finalDraw?.status === 'approved'
          ? 'Approved. Mark it paid.'
          : finalDraw
            ? waited
              ? 'Check the final pay application and approve it.'
              : 'Approve it once the owner has paid us and 10 days have passed.'
            : 'Waits for the final pay application.',
    },
    {
      key: 'finalWaiver',
      label: 'Unconditional final release',
      who: 'trade',
      done: paidBack && finalDraw?.waiver === 'unconditional',
      detail:
        paidBack && finalDraw?.waiver === 'unconditional'
          ? 'Their unconditional final release of lien is in.'
          : 'They sign the unconditional final release of lien once paid.',
    },
  ]
  const next = steps.find((st) => !st.done) ?? null
  return {
    steps,
    next,
    closed: next === null,
    held,
    finalDraw,
    canAskFinal: billed && accepted && finalDraw === null && !open && held > 0,
    canPay: waited,
    opensOn,
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
      return { pkg, partner: invite ? partnerById(state, invite.partnerId) : undefined, closeout: tradeCloseout(pkg.sow as Sow, project, state.today) }
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

/**
 * Can we close the job? Every trade we hire is closed out, our own crew is done, and the owner
 * has paid our final pay application. Says what is left, in words, until it can (owner, 2026-10-02: a
 * closed job leaves Building for its own section on the board).
 */
export function jobCloseout(state: GcState, project: GcProject): { ready: boolean; left: string[]; closedOn: string | null } {
  const left: string[] = []
  for (const pkg of project.packages) {
    const crew = ownCrewWork(pkg)
    if (crew) {
      if (crew.pct < 100) left.push(`${pkg.trade}: our own crew is ${crew.pct}% done.`)
      continue
    }
    if (!pkg.sow || pkg.sow.status !== 'signed') {
      left.push(`${pkg.trade}: no signed statement of work.`)
      continue
    }
    const c = tradeCloseout(pkg.sow, project, state.today)
    if (!c.closed) left.push(`${pkg.trade}: ${c.next?.label.toLowerCase() ?? 'not closed out'}.`)
  }
  if (!ownerRetainagePaidOn(project)) left.push('The owner has not paid our final pay application.')
  return { ready: left.length === 0 && !project.closedOn, left, closedOn: project.closedOn ?? null }
}

// ---------------------------------------------------------------------------------------------
// Change orders, the trade's side (Owner Billing builds the owner's side)
// ---------------------------------------------------------------------------------------------

/** The lines signed change orders added to a statement of work. */
export function changeOrderLines(sow: Sow): SovLine[] {
  return sow.sov.filter((l) => l.changeOrderId !== undefined)
}

/**
 * The contract with the trade to date: the original price plus the signed changes. The original
 * price (`sow.price`) never moves, since it is what we carry in our number to the owner; the owner's
 * change order bills the change on a line of its own.
 */
export function sowContractSum(sow: Sow): number {
  return sow.price + changeOrderLines(sow).reduce((s, l) => s + l.amount, 0)
}

/** Where a change order stands on the trade's side: with the owner, ours to send, waiting on the trade, signed. */
export type TradeChangeState = 'owner' | 'toSend' | 'sent' | 'signed'

export interface TradeChange {
  co: ChangeOrder
  state: TradeChangeState
}

/**
 * The change orders that belong to a trade we hire with a signed statement of work, and where each
 * stands. A declined one is left out. Our own crew's and our own work's have no trade side.
 */
export function tradeChangesFor(project: GcProject, pkg: TradePackage): TradeChange[] {
  if (pkg.selfPerform || pkg.sow?.status !== 'signed') return []
  return (project.changeOrders ?? [])
    .filter((co) => co.packageId === pkg.id && co.status !== 'declined')
    .map((co) => ({
      co,
      state: co.status !== 'signed' ? 'owner' : !co.tradeChange ? 'toSend' : co.tradeChange.status === 'sent' ? 'sent' : 'signed',
    }))
}

/**
 * How far the trade says a change order's work is: its line's reported percent, once the trade has
 * signed the change. Null before that. For Owner Billing's bill, the way it reads ownCrewWork.
 */
export function changeOrderTradePct(project: GcProject, co: ChangeOrder): number | null {
  if (co.tradeChange?.status !== 'signed') return null
  const pkg = project.packages.find((k) => k.id === co.packageId)
  return pkg?.sow?.sov.find((l) => l.id === co.tradeChange?.sovLineId)?.pctReported ?? null
}
