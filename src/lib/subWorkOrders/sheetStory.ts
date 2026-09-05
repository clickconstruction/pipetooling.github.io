/**
 * The sheet story (Work Orders one-row spine, PR 6): click the rail, get one
 * row per dot with the facts behind it — dates, who, portal vs office, the
 * note, what the sub sees, and the office's move on the step that is live.
 * Nothing new is stored; this assembles what the work order row, the sheet's
 * stage stamps, the Activity feed's Sub labor lines, the job's bill and the
 * payments already hold. Pure: no React, no Supabase.
 */
import type { JobWorkOrderCoverage } from './workOrderCoverage'
import type { SheetRail, SheetRailStepKey, SheetRailStepState } from './sheetRail'
import { SHEET_RAIL_STEP_LABEL, daysBetweenYmd } from './sheetRail'
import { normalizeSubSheetStage, type SubSheetStage } from '../subSheetStage'

export type SheetStoryFact = { k?: string; text: string; quote?: boolean }
export type SheetStoryChip = { label: string; tone: 'gap' | 'amber' | 'green' | 'violet' | 'gray' }
export type SheetStoryAction =
  | 'draft'
  | 'open_order'
  | 'view_record'
  | 'reoffer'
  | 'nudge'
  | 'to_walkthrough'
  | 'to_customer_pays'
  | 'back_to_work'
  | 'back_to_walkthrough'
  | 'set_payable_after'
  | 'open_sheet'

export const SHEET_STORY_ACTION_LABEL: Record<SheetStoryAction, string> = {
  draft: 'Draft a work order…',
  open_order: 'Open the order ›',
  view_record: 'View record ›',
  reoffer: 'Re-offer…',
  nudge: 'Nudge',
  to_walkthrough: 'Move to Walk-through',
  to_customer_pays: 'Passed → Customer pays',
  back_to_work: 'Step back to Work',
  back_to_walkthrough: 'Step back to Walk-through',
  set_payable_after: 'Set payable after…',
  open_sheet: 'Sheet ›',
}

export type SheetStoryRow = {
  key: SheetRailStepKey
  label: string
  state: SheetRailStepState
  /** The office's three dots are small; the sub's four are big. */
  office: boolean
  chip: SheetStoryChip | null
  facts: SheetStoryFact[]
  /** The portal's own sentence for this step, when the sub can see it. */
  sees: string | null
  /** The first action is the primary one. */
  actions: SheetStoryAction[]
}

export type SheetStoryOrder = {
  status: string
  amount: number | null
  created_at: string
  createdByName?: string | null
  offered_at: string | null
  offer_expires_at: string | null
  signed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  decline_reason: string | null
  record_id: string | null
  signer_printed_name: string | null
  signer_signature_mode: string | null
}

export type SheetStoryStageEvent = {
  occurred_at: string
  from: SubSheetStage | null
  to: SubSheetStage | null
  source: 'office' | 'portal' | 'auto' | null
  note: string | null
  actorName: string | null
}

export type SheetStoryInput = {
  sheet: {
    assigned_to_name: string
    job_number: string | null
    address: string | null
    job_date: string | null
    created_at: string | null
    stage: string | null
    stage_changed_at?: string | null
    stage_source?: string | null
    stage_note?: string | null
    payable_after?: string | null
    pay_hold_reason?: string | null
    items?: Array<{ fixture?: string | null; is_fixed?: boolean; direct_labor_amount?: number | null }>
    payments?: Array<{ amount: number; memo?: string | null; created_at?: string | null; payment_date?: string | null }>
  }
  money: { agreed: number; paid: number; open: number; unpriced: boolean }
  coverage: JobWorkOrderCoverage
  rail: SheetRail
  order: SheetStoryOrder | null
  /** The Pipeline job behind the sheet's number, or null when it is not in the Pipeline. */
  job: { hcp_number: string; customer_name: string | null; status: string | null; revenue: number | null; billsOut: number; billsPaid: number } | null
  /** Sub labor stage lines from the job's Activity feed, oldest first. */
  events: SheetStoryStageEvent[]
  paperwork: { msaSignedOn: string | null; gcStanding: 'current' | 'behind' | 'unsigned' | 'none'; coiExpiresOn: string | null } | null
  portal: { hasLink: boolean }
  crewPay: boolean
  todayYmd: string
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ymd = (v: string | null | undefined) => (v ?? '').slice(0, 10) || null
const when = (iso: string | null | undefined): string => {
  if (!iso) return ''
  // A bare YYYY-MM-DD is a calendar day, not a UTC instant — build it locally so it never shifts a day.
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const d = dayOnly ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3])) : new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = /T\d{2}:\d{2}/.test(iso) ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''
  return time ? `${date}, ${time}` : date
}
const sourceWord = (s: SheetStoryStageEvent['source']) => (s === 'portal' ? 'from the portal' : s === 'auto' ? 'automatically' : 'office')

/** The portal's sentences (subPortalI18n, English) so the office reads what the sub reads. */
export const SUB_SEES: Record<'work' | 'walkthrough' | 'customer_pay' | 'queued' | 'offer', string> = {
  offer: 'the offer card — scope, price, “Sign to accept this work”.',
  work: '“Finish up, then tell us below and we\'ll come walk it.” with ✓ My work here is done.',
  walkthrough: '“You told us the work\'s done. We\'ll schedule the walk-through and let you know.”',
  customer_pay: '“Passed the walk-through. The customer\'s payment is the last thing between you and this money…”',
  queued: '“Queued for the pay run — the date is right below.”',
}

export function buildSheetStory(input: SheetStoryInput): SheetStoryRow[] {
  const { sheet, money: m, coverage: c, rail, order, job, events, paperwork, crewPay } = input
  const stateOf = (key: SheetRailStepKey): SheetRailStepState => rail.steps.find((s) => s.key === key)?.state ?? 'todo'
  const stage = normalizeSubSheetStage(sheet.stage)
  const current = rail.current
  const subName = sheet.assigned_to_name.trim() || 'the sub'
  const rows: SheetStoryRow[] = []

  if (!crewPay) {
    // Drafted
    const drafted: SheetStoryRow = { key: 'drafted', label: 'Drafted', state: stateOf('drafted'), office: true, chip: null, facts: [], sees: null, actions: [] }
    if (c.kind === 'none') {
      drafted.chip = { label: 'nothing drafted', tone: 'gap' }
      drafted.facts.push({ text: m.unpriced ? 'No work order exists for this sheet, and the sheet itself has no price yet.' : `No work order exists for this sheet. ${money(m.agreed)} of work is on a handshake.` })
      drafted.sees = 'nothing — no offer card on their portal.'
      drafted.actions.push('draft')
    } else if (order) {
      drafted.chip = c.kind === 'draft' ? { label: c.unpriced ? 'no price yet' : 'priced, not sent', tone: 'amber' } : { label: 'done', tone: 'gray' }
      drafted.facts.push({ k: when(order.created_at), text: `drafted${order.createdByName ? ` by ${order.createdByName}` : ''}${order.amount == null ? ' · price left blank' : ` · ${money(Number(order.amount))}`}` })
      if (c.kind === 'draft') drafted.actions.push('open_order')
    }
    rows.push(drafted)

    // Sent
    const sent: SheetStoryRow = { key: 'sent', label: 'Sent', state: stateOf('sent'), office: true, chip: null, facts: [], sees: null, actions: [] }
    if (c.kind === 'none') sent.facts.push({ text: '—' })
    else if (c.kind === 'draft') sent.facts.push({ text: c.unpriced ? 'Not sent yet — price it first.' : 'Priced — it just needs to go out.' })
    else if (order?.offered_at) {
      const expired = c.kind === 'sent' && c.expired
      sent.chip = expired ? { label: 'offer expired', tone: 'gap' } : c.kind === 'sent' ? { label: `waiting ${Math.max(0, daysBetweenYmd(ymd(order.offered_at), input.todayYmd))} day${daysBetweenYmd(ymd(order.offered_at), input.todayYmd) === 1 ? '' : 's'}`, tone: 'amber' } : { label: 'done', tone: 'gray' }
      sent.facts.push({ k: when(order.offered_at), text: `to ${subName}'s portal${order.offer_expires_at ? ` · good through ${ymd(order.offer_expires_at)}` : ''}${expired ? ' — expired' : ''}` })
      if (c.kind === 'sent') {
        sent.sees = SUB_SEES.offer
        sent.actions.push(expired ? 'reoffer' : 'nudge')
      }
    }
    if (c.kind === 'declined' && order) {
      sent.chip = { label: 'declined', tone: 'gap' }
      sent.facts.push({ k: when(order.declined_at), text: `${subName} declined${order.decline_reason ? '' : '.'}` })
      if (order.decline_reason) sent.facts.push({ text: `“${order.decline_reason}”`, quote: true })
      sent.actions.push('reoffer')
    }
    rows.push(sent)

    // Signed
    const signed: SheetStoryRow = { key: 'signed', label: 'Signed', state: stateOf('signed'), office: true, chip: null, facts: [], sees: null, actions: [] }
    if (c.kind === 'signed' && order) {
      const at = order.signed_at ?? order.accepted_at
      const paper = !order.signed_at && !order.signer_printed_name
      const mode = order.signer_signature_mode === 'draw' ? 'drawn' : order.signer_signature_mode === 'type' ? 'typed' : null
      signed.chip = { label: order.record_id ?? 'signed', tone: 'green' }
      signed.facts.push({ k: when(at), text: paper ? 'signed on paper, marked by the office' : `on the portal${mode ? ` · ${mode} signature` : ''}${order.signer_printed_name ? ` “${order.signer_printed_name}”` : ''}` })
      signed.actions.push('view_record')
    } else if (c.kind === 'draft' || c.kind === 'sent') {
      signed.facts.push({ text: c.kind === 'sent' ? 'Waiting on their signature.' : 'After it is sent.' })
    } else {
      signed.facts.push({ text: '—' })
    }
    if (paperwork) {
      const bits = [
        paperwork.msaSignedOn ? `MSA signed ${ymd(paperwork.msaSignedOn)}` : 'no MSA on file',
        paperwork.gcStanding === 'current' ? 'General Conditions current' : paperwork.gcStanding === 'behind' ? 'General Conditions behind' : paperwork.gcStanding === 'unsigned' ? 'General Conditions not signed' : null,
        paperwork.coiExpiresOn ? `COI through ${ymd(paperwork.coiExpiresOn)}` : 'no COI on file',
      ].filter(Boolean)
      signed.facts.push({ k: 'Binds under', text: bits.join(' · ') })
    }
    rows.push(signed)
  }

  // Work
  const work: SheetStoryRow = { key: 'work', label: SHEET_RAIL_STEP_LABEL.work, state: stateOf('work'), office: false, chip: null, facts: [], sees: null, actions: [] }
  const started = sheet.job_date ?? ymd(sheet.created_at)
  const items = sheet.items ?? []
  const fixed = items.filter((i) => i.is_fixed || i.direct_labor_amount != null).length
  work.facts.push({ k: 'Started', text: started ? `${when(started)} — ${sheet.created_at ? 'sheet created' : 'sheet dated'}${m.unpriced ? '' : ''}` : 'no date on the sheet' })
  work.facts.push({ k: 'Scope on the sheet', text: items.length === 0 ? 'no line items yet' : `${items.length} line item${items.length === 1 ? '' : 's'}${fixed ? ` · ${fixed} fixed-price` : ''} · ${m.unpriced ? 'unpriced' : money(m.agreed)}` })
  if (current === 'work') {
    const days = started ? daysBetweenYmd(started, input.todayYmd) : 0
    work.chip = { label: `current${days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}`, tone: 'amber' }
    work.sees = SUB_SEES.work
    work.actions.push('to_walkthrough', 'open_sheet')
  }
  rows.push(work)

  // Walk-through
  const walk: SheetStoryRow = { key: 'inspection', label: SHEET_RAIL_STEP_LABEL.inspection, state: stateOf('inspection'), office: false, chip: null, facts: [], sees: null, actions: [] }
  const toWalk = [...events].reverse().find((e) => e.to === 'walkthrough')
  if (toWalk) {
    walk.facts.push({ k: when(toWalk.occurred_at), text: toWalk.source === 'portal' ? `${subName} tapped My work here is done on the portal` : `moved to Walk-through${toWalk.actorName ? ` by ${toWalk.actorName}` : ''} (${sourceWord(toWalk.source)})` })
    if (toWalk.note) walk.facts.push({ text: `“${toWalk.note}”`, quote: true })
  } else if (stage === 'walkthrough' && sheet.stage_changed_at) {
    walk.facts.push({ k: when(sheet.stage_changed_at), text: sheet.stage_source === 'portal' ? `${subName} said the work is done (portal)` : 'moved here by the office' })
    if (sheet.stage_note) walk.facts.push({ text: `“${sheet.stage_note}”`, quote: true })
  } else {
    walk.facts.push({ text: 'When the sub taps Done, the date and their note land here; you schedule the walk.' })
  }
  if (current === 'inspection') {
    const since = toWalk ? ymd(toWalk.occurred_at) : ymd(sheet.stage_changed_at)
    const days = since ? daysBetweenYmd(since, input.todayYmd) : 0
    walk.chip = { label: `current${days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}`, tone: 'violet' }
    walk.facts.push({ k: 'Next', text: 'schedule the walk-through' })
    walk.sees = SUB_SEES.walkthrough
    walk.actions.push('to_customer_pays', 'back_to_work')
  }
  rows.push(walk)

  // Customer pays
  const pays: SheetStoryRow = { key: 'customer_pays', label: SHEET_RAIL_STEP_LABEL.customer_pays, state: stateOf('customer_pays'), office: false, chip: null, facts: [], sees: null, actions: [] }
  if (job) {
    const statusWord = (job.status ?? '').replace(/_/g, ' ') || 'no status'
    pays.facts.push({ text: `Job ${job.hcp_number} is ${statusWord}${job.revenue != null && job.revenue > 0 ? ` · contract ${money(job.revenue)}` : ''} · ${job.billsOut === 0 ? 'nothing billed yet' : `${job.billsPaid} of ${job.billsOut} bill${job.billsOut === 1 ? '' : 's'} paid`}` })
  } else {
    pays.facts.push({ text: "No job bill to read — this sheet's job is not in the Pipeline. Link it from the Work Orders board." })
  }
  if (sheet.payable_after) pays.facts.push({ k: 'Payable after', text: `${ymd(sheet.payable_after)} — queued for the pay run` })
  else if (sheet.pay_hold_reason) pays.facts.push({ k: 'On hold', text: sheet.pay_hold_reason })
  else if (current === 'customer_pays' || current === 'paid') pays.facts.push({ text: `Set a payable-after date to queue ${subName} for the Friday pay run before the customer pays.` })
  if (current === 'customer_pays') {
    pays.chip = { label: 'current', tone: 'amber' }
    pays.sees = SUB_SEES.customer_pay
    pays.actions.push('set_payable_after', 'back_to_walkthrough')
  } else if (current === 'paid' && m.open > 0) {
    pays.sees = SUB_SEES.queued
  }
  rows.push(pays)

  // Paid
  const paid: SheetStoryRow = { key: 'paid', label: SHEET_RAIL_STEP_LABEL.paid, state: stateOf('paid'), office: false, chip: null, facts: [], sees: null, actions: [] }
  const payments = [...(sheet.payments ?? [])].sort((a, b) => (a.payment_date ?? a.created_at ?? '').localeCompare(b.payment_date ?? b.created_at ?? ''))
  if (payments.length === 0) paid.facts.push({ text: 'No payments yet · sets itself at $0 open.' })
  for (const p of payments) {
    const amt = Number(p.amount) || 0
    paid.facts.push({ k: when(p.payment_date ?? p.created_at), text: `${amt < 0 ? 'back-charge' : 'payment'} ${money(Math.abs(amt))}${p.memo?.trim() ? ` · “${p.memo.trim()}”` : ''}` })
  }
  if (current === 'paid' && m.open <= 0 && !m.unpriced) paid.chip = { label: 'paid in full', tone: 'green' }
  else if (!m.unpriced && m.open > 0) paid.chip = { label: `${money(m.open)} to go`, tone: 'gray' }
  paid.actions.push('open_sheet')
  rows.push(paid)

  return rows
}
