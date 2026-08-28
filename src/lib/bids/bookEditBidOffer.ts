/**
 * v2.2444 (Wendi: "changed both versions of water to 13 and it isnt coming up when im trying to
 * add it in").
 *
 * A bid does not price from the shared price book — it prices from a frozen COPY taken when the
 * bid started (`clone_price_book_version_to_bid`), and the copy keeps the book's name. So the
 * Workbench chip and the book drawer can both read "WENDI" while pointing at different rows.
 * Editing an entry in the drawer writes to the shared book; the open bid keeps the old price,
 * silently, forever. Wendi set "Ft of Water Line" to $13 in the WENDI book and "feet of water
 * line" to $13 in Default — 40 and 25 bid-owned copies respectively still read $12.
 *
 * The freeze itself is right: a sent bid must not re-price because someone edited the book. What
 * was missing is a door from the book back to the bid you have open. This kernel decides whether
 * to offer that door after a book entry is saved, and what to say.
 */

export type BookEntryPrices = {
  rough_in_price: number
  top_out_price: number
  trim_set_price: number
  total_price: number
}

export type BookEditBidOffer =
  /** The bid's copy has this fixture at different prices — offer to carry the edit across. */
  | { kind: 'update'; bidEntryId: string; fixtureName: string; bidTotal: number; bookTotal: number }
  /** The bid's copy has never heard of this fixture — offer to add it, so it can be assigned. */
  | { kind: 'add'; fixtureName: string; bookTotal: number }

const PRICE_FIELDS = ['rough_in_price', 'top_out_price', 'trim_set_price', 'total_price'] as const

function samePrices(a: BookEntryPrices, b: BookEntryPrices): boolean {
  return PRICE_FIELDS.every((f) => Number(a[f]) === Number(b[f]))
}

/**
 * Null = say nothing: there is no bid on screen to offer, or its copy already agrees with the
 * book. Silence is the common case (most book edits happen with no bid open), so the banner
 * stays meaningful when it does appear.
 */
export function planBookEditBidOffer(input: {
  /** The fixture whose book entry was just saved. */
  fixtureTypeId: string
  fixtureName: string
  /** Prices as just written to the shared book. */
  book: BookEntryPrices
  /** The open bid's active pricing — its own frozen copy of the book. */
  bidEntries: ReadonlyArray<{ id: string; fixture_type_id: string } & BookEntryPrices>
  /** False when no bid/pricing is active — nothing to offer. */
  hasActiveBidPricing: boolean
  /**
   * True when the edited book is the one this bid's pricing descends from (or when that lineage
   * is unknowable). An *update* offer is a same-book sync, so it fires only then — otherwise
   * editing ANY book with a bid open would offer to pull that book's price onto a bid that
   * prices from a different one (v2.2445). An *add* is an import and fires from any book:
   * pulling a missing entry across books is exactly the Default-book case that started this.
   */
  editedBookFeedsThisBid: boolean
}): BookEditBidOffer | null {
  const { fixtureTypeId, fixtureName, book, bidEntries, hasActiveBidPricing, editedBookFeedsThisBid } = input
  if (!hasActiveBidPricing) return null
  const name = fixtureName.trim()
  if (!name) return null

  const mine = bidEntries.filter((e) => e.fixture_type_id === fixtureTypeId)
  if (mine.length === 0) return { kind: 'add', fixtureName: name, bookTotal: Number(book.total_price) }
  if (!editedBookFeedsThisBid) return null

  // A copy can hold the same fixture more than once (hand-added duplicates). Offer the first that
  // actually disagrees; if every one already matches, there is nothing to say.
  const stale = mine.find((e) => !samePrices(e, book))
  if (!stale) return null
  return {
    kind: 'update',
    bidEntryId: stale.id,
    fixtureName: name,
    bidTotal: Number(stale.total_price),
    bookTotal: Number(book.total_price),
  }
}

/**
 * v2.2445: "Use $13 on this bid" must mean the BID, not the price option on screen. A bid's
 * other price options (alternates, other GC packets — each with its own frozen copy) usually
 * inherited the same stale value, and the sent packet's ★ letter is often one of THEM. Carry the
 * update to every sibling entry still holding the viewed copy's exact stale prices — identical
 * values are inherited values. A sibling someone re-priced on purpose (a VE'd entry, say) won't
 * match, and is left alone.
 */
export function planSiblingCarry(input: {
  /** The viewed copy's stale prices — what the offer is replacing. */
  stale: BookEntryPrices
  /** Same-fixture entries from the bid's OTHER pricings. */
  siblingEntries: ReadonlyArray<{ id: string; version_id: string } & BookEntryPrices>
}): { entryIds: string[]; pricingIds: string[] } {
  const matching = input.siblingEntries.filter((e) => samePrices(e, input.stale))
  return {
    entryIds: matching.map((e) => e.id),
    pricingIds: [...new Set(matching.map((e) => e.version_id))],
  }
}
