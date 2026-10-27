import type { UserRole } from '../../hooks/useAuth'
import {
  LIEN_WAIVER_FORM_SHORT_LABELS,
  buildLienWaiverFoot,
  buildLienWaiverParagraphs,
  lienWaiverIsConditional,
  lienWaiverTitle,
  lienWaiverUsesField,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../jobsDocuments/lienWaiverRelease'
import type { TradeWaiverPaper } from '../gc/tradeWaiverPaper'
import { isLienWaiverFormType, lienReleaseFieldsFromSnapshot, type JobLienReleaseRow } from '../jobs/lienReleaseTracking'
import { lienReleaseStatus } from '../jobs/lienReleaseLifecycle'
import type { LienWaiverSigner } from '../jobs/lienWaiverSigners'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Bids → Lien Release (v2.5893): the tab's document is the Release of Lien window's own form
 * family — the four waiver-and-release forms on Texas Property Code § 53.284
 * (`lienWaiverRelease.ts`), never the old invoice-wrapper wording. This kernel holds what is
 * bid-scoped: the prefill from a bid (no bills exist yet, so the amount is the bid's number and
 * the dates are typed), the paper for the on-screen preview, and the leader gate — an
 * unconditional waiver gives up rights, so only a leader sends one from this tab; everyone else
 * drafts it and is told whose signature it waits on.
 */

export const BID_LIEN_WAIVER_COMPANY_DEFAULT = 'Click Plumbing and Electrical'

/** What a bid can prefill (v2.5893): the GC (else the customer) as payor, the bid's number as the amount. */
export type BidLienWaiverSource = {
  project_name?: string | null
  address?: string | null
  agreed_value?: number | null
  bid_value?: number | null
  customers?: { name?: string | null } | null
  bids_gc_builders?: { name?: string | null } | null
}

/** The payor the conditional form names: the GC on the bid, else the customer. */
export function bidLienWaiverPayor(bid: BidLienWaiverSource): string {
  return (bid.bids_gc_builders?.name ?? '').trim() || (bid.customers?.name ?? '').trim()
}

export function bidLienWaiverPrefill(bid: BidLienWaiverSource, today: string): LienWaiverFields {
  const name = (bid.project_name ?? '').trim()
  const address = (bid.address ?? '').trim()
  const amount = bid.agreed_value ?? bid.bid_value
  return {
    companyName: BID_LIEN_WAIVER_COMPANY_DEFAULT,
    checkFrom: bidLienWaiverPayor(bid),
    amount: amount != null ? (Math.round(Number(amount) * 100) / 100).toFixed(2) : '',
    projectDescription: name && address ? `${name} — ${address}` : name || address,
    throughDate: today,
    signedDate: today,
    signerName: '',
    signerTitle: '',
  }
}

/** The preview's paper — the same shape the trade portal and the Release of Lien window draw; signed, the foot names him and the day (v2.5958). */
export function bidLienWaiverPaper(formType: LienWaiverFormType, fields: LienWaiverFields, signature: { printedName: string; signedYmd?: string | null } | null = null): TradeWaiverPaper {
  return {
    formType,
    title: lienWaiverTitle(formType),
    paragraphs: buildLienWaiverParagraphs(formType, fields),
    foot: buildLienWaiverFoot(fields, signature),
  }
}

/**
 * Who may put an unconditional waiver OUT from the bid tab: the leaders and the controller —
 * the same seat that signs them in the Release of Lien window. Everyone else (estimators first)
 * drafts all four forms but the outputs hold on an unconditional until a leader sends it.
 */
export const BID_LIEN_WAIVER_SENDER_ROLES: readonly UserRole[] = ['dev', 'master_technician', 'controller']

export function canSendUnconditionalFromBid(role: UserRole | null | undefined): boolean {
  return role != null && BID_LIEN_WAIVER_SENDER_ROLES.includes(role)
}

/** True when this form's outputs are held for this role. */
export function bidLienWaiverOutputsHeld(formType: LienWaiverFormType, role: UserRole | null | undefined): boolean {
  return !lienWaiverIsConditional(formType) && !canSendUnconditionalFromBid(role)
}

/** The hold's first sentence: on its own above the code door (v2.5958), and the head of the full line. */
export const BID_LIEN_WAIVER_HOLD_HEAD = 'Unconditional paper gives up rights, so it only goes out over a leader’s signature.'

/** The hold's line, under the dead output buttons, for a held role with no code door. */
export const BID_LIEN_WAIVER_HOLD_LINE = `${BID_LIEN_WAIVER_HOLD_HEAD} Ask your leader — they send it from here or from the job’s Release of Lien window.`

// ---------- the waivers recorded on the bid, and the leader's code (v2.5958) ----------

/**
 * A waiver made on a bid: a job_lien_releases row with `bid_id` set and no job (v2.5958). The tab mints
 * one when a waiver goes out (Copy for email, Print, Download PDF) or when the leader signs it with his
 * code; the database holds an estimator's row to the paper he made, unsigned but for the leader's code.
 */
export type BidLienReleaseRow = Omit<JobLienReleaseRow, 'job_id'> & { job_id: null; bid_id: string }

/** The eight printed boxes of a recorded waiver, from its snapshot (the columns fill a box the snapshot lacks). */
export function bidLienReleaseFields(row: Pick<BidLienReleaseRow, 'fields' | 'amount' | 'through_date' | 'signed_date'>): LienWaiverFields {
  const s = lienReleaseFieldsFromSnapshot(row.fields)
  return {
    companyName: s.companyName ?? '',
    checkFrom: s.checkFrom ?? '',
    amount: s.amount ?? (row.amount != null ? String(row.amount) : ''),
    projectDescription: s.projectDescription ?? '',
    throughDate: s.throughDate ?? row.through_date ?? '',
    signedDate: s.signedDate ?? row.signed_date ?? '',
    signerName: s.signerName ?? '',
    signerTitle: s.signerTitle ?? '',
  }
}

const PAPER_KEYS: (keyof LienWaiverFields)[] = ['companyName', 'checkFrom', 'amount', 'projectDescription', 'throughDate', 'signedDate', 'signerName', 'signerTitle']

/** The same paper: the same form, and every box the form prints reads the same once trimmed. */
export function bidLienWaiverSamePaper(formType: LienWaiverFormType, fields: LienWaiverFields, row: Pick<BidLienReleaseRow, 'form_type' | 'fields' | 'amount' | 'through_date' | 'signed_date'>): boolean {
  if (row.form_type !== formType) return false
  const theirs = bidLienReleaseFields(row)
  return PAPER_KEYS.filter((k) => lienWaiverUsesField(formType, k)).every((k) => fields[k].trim() === theirs[k].trim())
}

/** The recorded waiver that is this paper: live, same form and boxes; a signed one first, else the newest. */
export function bidLienReleaseForPaper<R extends BidLienReleaseRow>(rows: readonly R[], formType: LienWaiverFormType, fields: LienWaiverFields): R | null {
  const same = rows.filter((r) => !r.voided_at && bidLienWaiverSamePaper(formType, fields, r)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return same.find((r) => lienReleaseStatus(r) === 'signed') ?? same[0] ?? null
}

const shortDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' }).format(d)
}

const chipMoney = (amount: unknown): string => {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '$—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
}

export type BidLienReleaseChip = { label: string; tone: 'signed' | 'sent' | 'waiting' | 'made' }

/** One waiver under Already on this bid: "Conditional · progress — $30,400 · sent Oct 1", toned by where it stands. */
export function bidLienReleaseChip(row: Pick<BidLienReleaseRow, 'form_type' | 'amount' | 'status' | 'created_at' | 'signed_at' | 'sent_to_customer_at'>): BidLienReleaseChip {
  const head = `${isLienWaiverFormType(row.form_type) ? LIEN_WAIVER_FORM_SHORT_LABELS[row.form_type] : row.form_type} — ${chipMoney(row.amount)}`
  const signed = lienReleaseStatus(row) === 'signed'
  const sent = shortDay(row.sent_to_customer_at)
  if (signed) {
    const parts = [`signed ${shortDay(row.signed_at) ?? ''}`.trim(), sent ? `sent ${sent}` : null].filter(Boolean)
    return { label: [head, ...parts].join(' · '), tone: sent ? 'sent' : 'signed' }
  }
  if (sent) return { label: `${head} · sent ${sent}`, tone: 'sent' }
  if (isLienWaiverFormType(row.form_type) && !lienWaiverIsConditional(row.form_type)) return { label: `${head} · waits for his signature`, tone: 'waiting' }
  return { label: `${head} · made ${shortDay(row.created_at) ?? ''}`.trim(), tone: 'made' }
}

/** Already on this bid: the live waivers, newest first. */
export function bidLienReleaseHistory<R extends BidLienReleaseRow>(rows: readonly R[]): R[] {
  return rows.filter((r) => !r.voided_at).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * The leader the code door names (v2.5958): the one the Signed by box names, else the company's signer
 * from Settings → Jobs & billing, else the first leader on the list (masters before devs). Names match
 * whole and without regard to case.
 */
export function bidLienWaiverLeader(leaders: readonly LienWaiverSigner[], signedByName: string, companySignerName: string | null | undefined): LienWaiverSigner | null {
  const key = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
  const byName = (name: string | null | undefined) => (key(name) ? leaders.find((l) => key(l.name) === key(name)) : undefined)
  return byName(signedByName) ?? byName(companySignerName) ?? leaders[0] ?? null
}

/** "MW" for Malachi Whites; one letter for one name. */
export function leaderInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words.length === 1 ? words[0]!.slice(0, 1) : `${words[0]!.slice(0, 1)}${words[words.length - 1]!.slice(0, 1)}`).toUpperCase()
}

/**
 * Who meets the code door on a held waiver: the assistants and the estimators, the held roles the
 * database lets make a bid's waiver and open it for the leader's code. Anyone else held keeps the
 * plain hold line.
 */
export const BID_LIEN_WAIVER_CODE_DOOR_ROLES: readonly UserRole[] = ['assistant', 'estimator']

export function bidLienWaiverCodeDoorShown(formType: LienWaiverFormType, role: UserRole | null | undefined): boolean {
  return bidLienWaiverOutputsHeld(formType, role) && role != null && BID_LIEN_WAIVER_CODE_DOOR_ROLES.includes(role)
}

/** The code door's words (board 3): the leader by his first name, his code on this screen, the outputs signed after. */
export function bidLienWaiverCodeDoorWords(leaderName: string): { title: string; line: string; button: string; askLink: string; askLine: string } {
  const first = leaderName.trim().split(/\s+/)[0] || 'The leader'
  return {
    title: `${first} is with you?`,
    line: 'He types his signing code right here on your screen. The outputs open signed.',
    button: 'Sign with his code',
    askLink: 'Ask him to send it himself ›',
    askLine: `${first} opens this bid's Lien Release tab signed in as himself and sends it from there.`,
  }
}

/** The row the tab mints for this paper: issued and unsigned, on the bid, with the boxes as they print. */
export function bidLienReleaseInsert(bidId: string, formType: LienWaiverFormType, fields: LienWaiverFields, userId: string, nowIso: string) {
  const amountNum = Number((fields.amount ?? '').replace(/[$,\s]/g, ''))
  return {
    bid_id: bidId,
    job_id: null,
    form_type: formType,
    amount: Number.isFinite(amountNum) ? Math.max(0, Math.round(amountNum * 100) / 100) : 0,
    through_date: lienWaiverUsesField(formType, 'throughDate') && fields.throughDate ? fields.throughDate : null,
    signed_date: fields.signedDate || null,
    fields: { ...fields } as Record<string, string>,
    status: 'issued',
    minted_at: nowIso,
    created_by: userId,
  }
}
