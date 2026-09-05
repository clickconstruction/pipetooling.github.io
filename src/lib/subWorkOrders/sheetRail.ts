/**
 * The sheet rail (Work Orders one-row spine, PR 2): seven dots on one line
 * for a sub sheet and the agreement behind it.
 *
 *   Drafted · Sent · Signed   ·   Work · Walk-through · Customer pays · Paid
 *   ── the office's three ──     ── the sub's four (their portal rail) ──
 *
 * One terracotta dot marks where the sheet stands. Work under way with
 * nothing signed draws the three office dots as a dashed red GAP — the gap is
 * the finding, not a chip. Declined and expired offers are gaps too: the sub
 * is still working and nothing is signed.
 *
 * Vocabulary is shared, not invented: agreement states come from
 * `buildJobWorkOrderCoverage` (workOrderCoverage.ts), sheet stages from
 * subSheetStage.ts, and the sub's four labels match subPortalI18n's rail
 * (Work · Walk-through · Customer pays · You're paid — "Paid" office-side;
 * the live portal says Walk-through, so the office does too).
 * Pure: no React, no Supabase.
 */
import type { JobWorkOrderCoverage } from './workOrderCoverage'
import type { SubSheetStage } from '../subSheetStage'

export type SheetRailStepKey = 'drafted' | 'sent' | 'signed' | 'work' | 'inspection' | 'customer_pays' | 'paid'
export type SheetRailStepState = 'done' | 'now' | 'todo' | 'gap'
export type SheetRailStep = { key: SheetRailStepKey; label: string; state: SheetRailStepState }

/** Board group = how far left the current dot sits. Work Orders sorts by this. */
export type SheetRailGroup = 'no_agreement' | 'drafted' | 'sent' | 'signed'

export const SHEET_RAIL_GROUP_LABEL: Record<SheetRailGroup, string> = {
  no_agreement: 'Working with no agreement',
  drafted: 'Drafted',
  sent: 'Sent',
  signed: 'Signed',
}

export const SHEET_RAIL_STEP_LABEL: Record<SheetRailStepKey, string> = {
  drafted: 'Drafted',
  sent: 'Sent',
  signed: 'Signed',
  work: 'Work',
  inspection: 'Walk-through',
  customer_pays: 'Customer pays',
  paid: 'Paid',
}

const STEP_ORDER: readonly SheetRailStepKey[] = ['drafted', 'sent', 'signed', 'work', 'inspection', 'customer_pays', 'paid']

export type SheetRailInput = {
  /** The agreement behind the sheet: none / draft / sent (maybe expired) / signed / declined. */
  coverage: JobWorkOrderCoverage
  /** Null when there is no sheet yet (a job-anchored draft or offer). */
  sheetStage: SubSheetStage | null
  /** `people_labor_jobs.payable_after` — set once the office queued the pay run (portal: "You're paid"). */
  payableAfter?: string | null
  /** Sheet money: agreed (items), open (items − payments − back-charges), and whether it was never priced. */
  agreed: number
  open: number
  unpriced: boolean
}

export type SheetRail = {
  steps: SheetRailStep[]
  current: SheetRailStepKey
  /** Work is happening with nothing signed (none / declined / expired). */
  gap: boolean
  group: SheetRailGroup
  /** Sort key: 0 no agreement … 6 paid. Lower = further left = needs the office sooner. */
  position: number
  /** "Work · no agreement", "Sent", "Declined · still working", "Paid" … */
  label: string
  /** The line under the label: "Sep 5 · no price", "good through Sep 12", "“too soon” · Sep 3" … */
  sublabel: string | null
  tone: 'gap' | 'now' | 'paid'
}

const stageRank = (s: SubSheetStage | null): number => (s === 'walkthrough' ? 1 : s === 'customer_pay' ? 2 : 0)

/** Which of the sub's four dots the sheet sits on (portal parity: queued for the pay run lights "Paid"). */
export function sheetMoneyStep(input: Pick<SheetRailInput, 'sheetStage' | 'payableAfter' | 'agreed' | 'open' | 'unpriced'>): Exclude<SheetRailStepKey, 'drafted' | 'sent' | 'signed'> {
  const settled = !input.unpriced && input.agreed > 0 && input.open <= 0
  const queued = input.sheetStage === 'customer_pay' && (input.payableAfter ?? '').trim() !== ''
  if (settled || queued) return 'paid'
  const r = stageRank(input.sheetStage)
  return r === 0 ? 'work' : r === 1 ? 'inspection' : 'customer_pays'
}

export function buildSheetRail(input: SheetRailInput): SheetRail {
  const c = input.coverage
  const hasSheet = input.sheetStage != null
  const moneyStep = sheetMoneyStep(input)
  const moneyIdx = STEP_ORDER.indexOf(moneyStep)

  const signed = c.kind === 'signed'
  const sentLive = c.kind === 'sent' && !c.expired
  const drafted = c.kind === 'draft'
  const gapKind: 'none' | 'declined' | 'expired' | null = c.kind === 'none' ? 'none' : c.kind === 'declined' ? 'declined' : c.kind === 'sent' && c.expired ? 'expired' : null

  // Office dots.
  let office: Record<'drafted' | 'sent' | 'signed', SheetRailStepState>
  if (signed) office = { drafted: 'done', sent: 'done', signed: 'done' }
  else if (sentLive) office = { drafted: 'done', sent: 'now', signed: 'todo' }
  else if (drafted) office = { drafted: 'now', sent: 'todo', signed: 'todo' }
  else if (gapKind === 'declined' || gapKind === 'expired') office = { drafted: 'done', sent: 'gap', signed: 'gap' }
  else office = { drafted: 'gap', sent: 'gap', signed: 'gap' }

  // The current dot: the sheet's step when signed or when nothing is signed and
  // the sheet exists (the gap case); the agreement step while a draft or offer is live.
  let current: SheetRailStepKey
  if (signed) current = hasSheet ? moneyStep : 'work'
  else if (sentLive) current = 'sent'
  else if (drafted) current = 'drafted'
  else current = hasSheet ? moneyStep : 'sent'

  const steps: SheetRailStep[] = STEP_ORDER.map((key) => {
    if (key === 'drafted' || key === 'sent' || key === 'signed') return { key, label: SHEET_RAIL_STEP_LABEL[key], state: office[key] }
    const idx = STEP_ORDER.indexOf(key)
    let state: SheetRailStepState = 'todo'
    if (signed || (gapKind != null && hasSheet)) {
      if (idx < moneyIdx) state = 'done'
      else if (idx === moneyIdx) state = moneyStep === 'paid' ? 'done' : 'now'
    }
    return { key, label: SHEET_RAIL_STEP_LABEL[key], state }
  })
  // Exactly one "now" dot, and the paid step reads as done-and-current.
  const currentStep = steps.find((s) => s.key === current)
  if (currentStep && currentStep.state !== 'done') currentStep.state = 'now'

  const gap = gapKind != null
  const group: SheetRailGroup = signed ? 'signed' : sentLive ? 'sent' : drafted ? 'drafted' : 'no_agreement'
  const position = group === 'no_agreement' ? 0 : group === 'drafted' ? 1 : group === 'sent' ? 2 : 3 + (moneyIdx - STEP_ORDER.indexOf('work'))

  const moneyLabel = SHEET_RAIL_STEP_LABEL[moneyStep]
  let label: string
  let sublabel: string | null = null
  if (signed) {
    label = hasSheet ? moneyLabel : 'Signed'
    sublabel = c.signedOn ? `signed ${c.signedOn}` : null
    if (hasSheet && moneyStep === 'paid' && input.sheetStage === 'customer_pay' && input.open > 0) sublabel = 'queued for the pay run'
  } else if (sentLive) {
    label = 'Sent'
    sublabel = [c.sentAt ? c.sentAt : null, c.expiresOn ? `good through ${c.expiresOn}` : null].filter(Boolean).join(' · ') || null
  } else if (drafted) {
    label = 'Drafted'
    sublabel = c.unpriced ? 'no price yet' : null
  } else if (gapKind === 'declined' && c.kind === 'declined') {
    label = hasSheet ? `Declined · still ${moneyStep === 'work' ? 'working' : moneyLabel.toLowerCase()}` : 'Declined'
    sublabel = c.reason ? `“${c.reason}”` : null
  } else if (gapKind === 'expired' && c.kind === 'sent') {
    label = hasSheet ? 'Offer expired · still working' : 'Offer expired'
    sublabel = c.sentAt ? `sent ${c.sentAt}` : null
  } else {
    label = hasSheet ? `${moneyLabel} · no agreement` : 'No agreement'
    sublabel = input.unpriced ? 'sheet never priced' : null
  }

  const tone: SheetRail['tone'] = gap ? 'gap' : moneyStep === 'paid' && signed ? 'paid' : 'now'
  return { steps, current, gap, group, position, label, sublabel, tone }
}

export type SheetNextButton = 'draft' | 'price' | 'send' | 'nudge' | 'reoffer' | null

export type SheetNextAction = {
  label: string
  hint: string | null
  button: SheetNextButton
  buttonLabel: string | null
}

export type SheetNextActionContext = {
  subName: string
  agreed: number
  open: number
  unpriced: boolean
  todayYmd: string
  /** Days an offer may sit before the office nudges (default 3). */
  nudgeAfterDays?: number
}

/** Calendar days between two YYYY-MM-DD strings (b − a); 0 when either is missing. */
export function daysBetweenYmd(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0
  const pa = a.slice(0, 10).split('-').map(Number)
  const pb = b.slice(0, 10).split('-').map(Number)
  if (pa.length < 3 || pb.length < 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) return 0
  const ua = Date.UTC(pa[0]!, pa[1]! - 1, pa[2]!)
  const ub = Date.UTC(pb[0]!, pb[1]! - 1, pb[2]!)
  return Math.round((ub - ua) / 86_400_000)
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * The office's end of the sub's "Done with the work?" prompt — what to do next
 * on this row, and which button sits first.
 */
export function sheetNextAction(rail: SheetRail, coverage: JobWorkOrderCoverage, ctx: SheetNextActionContext): SheetNextAction {
  const sub = ctx.subName.trim() || 'the sub'
  if (coverage.kind === 'declined') {
    return { label: 'Re-offer or re-price', hint: coverage.reason ? `${sub} said “${coverage.reason}”` : `${sub} declined`, button: 'reoffer', buttonLabel: 'Re-offer…' }
  }
  if (coverage.kind === 'sent' && coverage.expired) {
    return { label: 'Offer expired — send it again', hint: coverage.sentAt ? `sent ${coverage.sentAt}` : null, button: 'reoffer', buttonLabel: 'Re-send…' }
  }
  if (coverage.kind === 'none') {
    const hint = ctx.unpriced ? 'price the sheet, then send the order' : `${money(ctx.agreed)} of work on a handshake`
    return { label: 'Get it in writing', hint, button: 'draft', buttonLabel: 'Draft a work order…' }
  }
  if (coverage.kind === 'draft') {
    return coverage.unpriced
      ? { label: 'Price it and send', hint: 'the master’s call', button: 'price', buttonLabel: 'Price…' }
      : { label: 'Send it', hint: 'priced — it just needs to go out', button: 'send', buttonLabel: 'Send…' }
  }
  if (coverage.kind === 'sent') {
    const days = daysBetweenYmd(coverage.sentAt, ctx.todayYmd)
    const after = ctx.nudgeAfterDays ?? 3
    const label = `Waiting on ${sub}${days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}`
    return days >= after
      ? { label, hint: 'a nudge is due', button: 'nudge', buttonLabel: 'Nudge' }
      : { label, hint: coverage.expiresOn ? `good through ${coverage.expiresOn}` : null, button: null, buttonLabel: null }
  }
  // Signed: the sheet's own steps.
  switch (rail.current) {
    case 'work':
      return { label: 'Wait for “done”', hint: `${sub} taps Done on their portal`, button: null, buttonLabel: null }
    case 'inspection':
      return { label: 'Schedule the walk-through', hint: `${sub} said the work is done`, button: null, buttonLabel: null }
    case 'customer_pays':
      return { label: 'Bill and collect', hint: `${sub} is owed ${money(ctx.open)}`, button: null, buttonLabel: null }
    case 'paid':
      return ctx.open > 0
        ? { label: `Pay ${sub}`, hint: `${money(ctx.open)} queued for the pay run`, button: null, buttonLabel: null }
        : { label: 'Nothing — done', hint: null, button: null, buttonLabel: null }
    default:
      return { label: 'Signed', hint: null, button: null, buttonLabel: null }
  }
}
