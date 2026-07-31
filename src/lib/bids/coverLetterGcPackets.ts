/**
 * Multi-GC cover letters (v2.1159): group the bundled submission's per-Pricing
 * sections by their EFFECTIVE GC — the linked bid Version's `customer_id`
 * override when set, else the bid-level GC. Each group becomes its own
 * document so no GC ever sees another GC's pricing. Pure — no React, no DB.
 */

export type GcPacketCustomer = {
  id: string | null
  name: string
  address: string
}

export type GcPacketSectionInput = {
  /** Pricing facet name — becomes the section label inside the packet. */
  name: string
  /** The Pricing's linked bid Version (null for facets with no version link). */
  bidVersionId: string | null
}

export type GcPacket<S extends GcPacketSectionInput> = {
  /** Group key: the effective customer id, or 'bid-default' when the bid has none. */
  key: string
  customer: GcPacketCustomer
  /** True when this packet's GC is the bid-level default (no version override). */
  isBidDefault: boolean
  sections: S[]
}

/**
 * Group sections by effective GC, preserving section order within a group and
 * first-seen order across groups. A section whose version has no override —
 * or no version at all — falls back to the bid-level customer.
 */
export function groupSectionsByEffectiveGc<S extends GcPacketSectionInput>(
  sections: S[],
  versionCustomerById: Record<string, GcPacketCustomer | null | undefined>,
  bidCustomer: GcPacketCustomer,
): Array<GcPacket<S>> {
  const packets: Array<GcPacket<S>> = []
  const byKey = new Map<string, GcPacket<S>>()
  for (const s of sections) {
    const override = s.bidVersionId ? versionCustomerById[s.bidVersionId] ?? null : null
    const customer = override ?? bidCustomer
    const isBidDefault = override == null
    const key = customer.id ?? (isBidDefault ? 'bid-default' : `named:${customer.name}`)
    let packet = byKey.get(key)
    if (!packet) {
      packet = { key, customer, isBidDefault, sections: [] }
      byKey.set(key, packet)
      packets.push(packet)
    }
    packet.sections.push(s)
  }
  return packets
}

/** True when at least one version override points somewhere other than the bid GC — i.e. the multi-GC path is active. */
export function hasMultipleEffectiveGcs<S extends GcPacketSectionInput>(packets: Array<GcPacket<S>>): boolean {
  return packets.length > 1
}

/**
 * The GC the SINGLE letter is addressed to: the ACTIVE Version's override when
 * one is set, else the bid-level GC. Keying on the active Version keeps the
 * letterhead and the letter's numbers on the same Version (both follow the
 * Version picker); which Pricings are flagged include_in_submission only
 * matters for the multi-pricing bundle, never for the single letter.
 */
export function resolveSingleLetterGc(
  activeBidVersionId: string | null,
  versionCustomerById: Record<string, GcPacketCustomer | null | undefined>,
  bidCustomer: GcPacketCustomer,
): GcPacketCustomer {
  const override = activeBidVersionId ? versionCustomerById[activeBidVersionId] ?? null : null
  return override ?? bidCustomer
}

/** True when the letter's GC is someone other than the bid-level GC — drives the "· for {GC}" badge. */
export function letterGcDiffersFromBid(letterGc: GcPacketCustomer, bidCustomer: GcPacketCustomer): boolean {
  if (letterGc.id != null && bidCustomer.id != null) return letterGc.id !== bidCustomer.id
  return letterGc.name !== bidCustomer.name || letterGc.address !== bidCustomer.address
}
