/**
 * The Cover Letter's "Addressed to" row (to-do #133): every GC the bid goes to can be the
 * letter's addressee. The bid's GC leads; a recorded recipient (`bid_gc_recipients`) with no
 * packet of its own follows as a same-letter addressee — their copy is the same letter with only
 * the name-and-address block swapped. A GC with a packet is not listed here, because their
 * letter already follows their tab. Pure — no React, no DB.
 */
import type { GcPacketCustomer } from './coverLetterGcPackets'

export type CoverLetterAddressee = {
  /** The customer id; null only for a bid GC with no customer row. */
  gcId: string | null
  name: string
  address: string
  kind: 'bid' | 'shared'
}

/** A `bid_gc_recipients` row with its customer join, as the tab fetches it. */
export type AddresseeRecipientRow = { customerId: string; name: string | null; address: string | null }

export function coverLetterAddressees(input: {
  bidGc: GcPacketCustomer
  recipients: ReadonlyArray<AddresseeRecipientRow>
  /** GC ids the bid's versions point at — those GCs' letters follow their packet tabs. */
  packetGcIds: ReadonlyArray<string | null | undefined>
}): CoverLetterAddressee[] {
  const packetIds = new Set(input.packetGcIds.filter((id): id is string => !!id))
  const out: CoverLetterAddressee[] = [{ gcId: input.bidGc.id, name: input.bidGc.name, address: input.bidGc.address, kind: 'bid' }]
  const seen = new Set<string>(input.bidGc.id ? [input.bidGc.id] : [])
  for (const r of input.recipients) {
    if (!r.customerId || seen.has(r.customerId) || packetIds.has(r.customerId)) continue
    seen.add(r.customerId)
    out.push({ gcId: r.customerId, name: r.name?.trim() || '—', address: r.address ?? '—', kind: 'shared' })
  }
  return out
}

/** The row renders only when there is a choice to make — single-GC bids never see it. */
export function addresseeRowVisible(addressees: ReadonlyArray<CoverLetterAddressee>): boolean {
  return addressees.length > 1
}

/**
 * The letter's address override: the selected same-letter addressee, else null — the packet
 * rules stand (the bid GC, or the selected packet's GC). A selection that no longer exists
 * (recipient removed, or given a packet of their own) resolves to null the same way.
 */
export function resolveAddressedCustomer(
  addressees: ReadonlyArray<CoverLetterAddressee>,
  addressedGcId: string | null,
): GcPacketCustomer | null {
  if (!addressedGcId) return null
  const hit = addressees.find((a) => a.kind === 'shared' && a.gcId === addressedGcId)
  return hit ? { id: hit.gcId, name: hit.name, address: hit.address } : null
}

/**
 * The packet key `groupSectionsByEffectiveGc` files bid-default sections under: the bid GC's
 * customer id when it has one, else its literal 'bid-default'. The studio's GC tabs key the
 * bid-default tab as 'bid-default' always, so picking that tab must translate through this
 * before it reaches `letterDocument` — untranslated it misses the packet and the letter silently
 * stays on the active version's.
 */
export function bidDefaultPacketKey(bidGc: GcPacketCustomer): string {
  return bidGc.id ?? 'bid-default'
}
