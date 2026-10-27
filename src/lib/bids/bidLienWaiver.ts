import type { UserRole } from '../../hooks/useAuth'
import {
  buildLienWaiverFoot,
  buildLienWaiverParagraphs,
  lienWaiverIsConditional,
  lienWaiverTitle,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../jobsDocuments/lienWaiverRelease'
import type { TradeWaiverPaper } from '../gc/tradeWaiverPaper'

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

/** The preview's paper — the same shape the trade portal and the Release of Lien window draw. */
export function bidLienWaiverPaper(formType: LienWaiverFormType, fields: LienWaiverFields): TradeWaiverPaper {
  return {
    formType,
    title: lienWaiverTitle(formType),
    paragraphs: buildLienWaiverParagraphs(formType, fields),
    foot: buildLienWaiverFoot(fields, null),
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

/** The hold's line, under the dead output buttons. */
export const BID_LIEN_WAIVER_HOLD_LINE =
  'Unconditional paper gives up rights, so it only goes out over a leader’s signature. Ask your leader — they send it from here or from the job’s Release of Lien window.'
