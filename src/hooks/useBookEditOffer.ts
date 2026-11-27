/**
 * Bids → Pricing, the book-edit offer (v2.2444): the drawer's ✎ and Add entry write to the SHARED price book, and a
 * bid prices from its own frozen copy, so after a book entry is saved the drawer offers to carry the edit into the
 * bid on screen. Moved out of `BidsPricingTab` as it stood (punch list #46, row 1, v2.8764): the same two state
 * values, the same token, the same effect that retires an offer when the open price or the browsed book changes, and
 * the same two handlers, one that plans an offer and one that applies it.
 *
 * The tab calls the hook after the forms hook and after the bid's current book is worked out, since it reads both.
 * That is later among the tab's effects than the retiring effect stood. Nothing between the two places reads the
 * token or the offer, so the order they run in cannot be told apart. The drawer's own effect, which also listens for
 * Escape, stays in the tab and retires an offer through `retireBookOffer`: the two statements it ran itself.
 *
 * What the offer says is decided in `lib/bids/bookEditBidOffer.ts`. The hook draws nothing.
 */
import { useEffect, useRef, useState } from 'react'

import { planBookEditBidOffer, planSiblingCarry, type BookEditBidOffer, type BookEntryPrices } from '../lib/bids/bookEditBidOffer'
import type { PriceBookEntryWithFixture, PriceBookVersion } from '../lib/bids/bidPricingEngineTypes'
import { formatCurrency } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * A parked offer. For an update, `siblingEntryIds` are same-fixture entries in the bid's OTHER pricings still
 * holding the identical stale prices (v2.2445): "on this bid" updates them in the same press.
 */
export type PendingBookOffer = { offer: BookEditBidOffer; fixtureTypeId: string; prices: BookEntryPrices; siblingEntryIds: string[]; siblingPricingCount: number }

export type BookEditOfferArgs = {
  /** The entry form is aimed at the bid's own pricing (opened from a row's assign search): that save needs no offer. */
  entryFormTargetPricing: boolean
  /** The entries of the bid's open pricing: its own copy of the book. */
  priceBookEntries: ReadonlyArray<PriceBookEntryWithFixture>
  /** Every pricing of the bid: the siblings an update may carry to. */
  priceBookVersions: ReadonlyArray<PriceBookVersion>
  /** Only whether a bid is on screen is read. */
  selectedBidForPricing: unknown
  selectedPricingVersionId: string | null
  /** The shared book the bid's pricing was taken from, when that can be told. */
  currentPriceBookTemplateId: string | null
  /** The book being browsed in the drawer. */
  editingTemplateId: string | null
  /** The tab's sent-bid lock on its price rows: false, with its toast, when a write must not happen. */
  guardPriceRowsWrite: () => boolean
  setError: (message: string | null) => void
  loadPriceBookEntries: (versionId: string) => Promise<unknown> | unknown
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function useBookEditOffer({ entryFormTargetPricing, priceBookEntries, priceBookVersions, selectedBidForPricing, selectedPricingVersionId, currentPriceBookTemplateId, editingTemplateId, guardPriceRowsWrite, setError, loadPriceBookEntries, showToast }: BookEditOfferArgs) {
  // After a book edit, this holds the door back to the open bid — see `bookEditBidOffer.ts`.
  // For an update, `siblingEntryIds` are same-fixture entries in the bid's OTHER pricings still
  // holding the identical stale prices (v2.2445) — "on this bid" updates them in the same press.
  const [pendingBookOffer, setPendingBookOffer] = useState<PendingBookOffer | null>(null)
  const [applyingBookOffer, setApplyingBookOffer] = useState(false)
  // Planning an offer awaits a sibling fetch; the token drops a result that lands after the
  // context it was planned for (pricing switched, drawer closed) is gone.
  const bookOfferTokenRef = useRef(0)
  // The v2.2444 offer names entries in this bid's pricings — switching either side retires it
  // (and invalidates any plan still fetching).
  useEffect(() => {
    bookOfferTokenRef.current++
    setPendingBookOffer(null)
  }, [selectedPricingVersionId, editingTemplateId])

  /**
   * v2.2444: the drawer's ✎ and Add entry write to the SHARED book. A bid prices from a frozen
   * copy of that book (same name, different rows), so the edit stops there unless someone carries
   * it across. After each book save, park the offer to do exactly that for the bid on screen.
   * Silence when no bid is open, or when its copy already agrees.
   */
  async function noteBookEditForOpenBid(fixtureTypeId: string, fixtureName: string, prices: BookEntryPrices) {
    if (entryFormTargetPricing) return // that save already landed in the bid's own copy
    const token = ++bookOfferTokenRef.current
    const offer = planBookEditBidOffer({
      fixtureTypeId,
      fixtureName,
      book: prices,
      bidEntries: priceBookEntries.map((entry) => ({
        id: entry.id,
        fixture_type_id: entry.fixture_type_id,
        rough_in_price: Number(entry.rough_in_price),
        top_out_price: Number(entry.top_out_price),
        trim_set_price: Number(entry.trim_set_price),
        total_price: Number(entry.total_price),
      })),
      hasActiveBidPricing: selectedBidForPricing != null && selectedPricingVersionId != null,
      // An update offer is a same-book sync — never offered from a book this bid doesn't price
      // from. When the lineage is unknowable (no template resolves), any book may offer.
      editedBookFeedsThisBid: currentPriceBookTemplateId == null || editingTemplateId === currentPriceBookTemplateId,
    })
    if (!offer) {
      setPendingBookOffer(null)
      return
    }
    // "On this bid" means the bid: the update also covers sibling pricings (alternates, other GC
    // packets) whose copy still holds the viewed copy's exact stale prices — identical values are
    // inherited values; anything re-priced on purpose won't match and is left alone (v2.2445).
    let siblingEntryIds: string[] = []
    let siblingPricingCount = 0
    if (offer.kind === 'update') {
      const stale = priceBookEntries.find((entry) => entry.id === offer.bidEntryId)
      const siblingIds = priceBookVersions.map((v) => v.id).filter((id) => id !== selectedPricingVersionId)
      if (stale && siblingIds.length > 0) {
        const { data } = await supabase
          .from('price_book_entries')
          .select('id, version_id, rough_in_price, top_out_price, trim_set_price, total_price')
          .eq('fixture_type_id', fixtureTypeId)
          .in('version_id', siblingIds)
        // A failed fetch just narrows the offer to the viewed pricing — never blocks it.
        const carry = planSiblingCarry({
          stale: {
            rough_in_price: Number(stale.rough_in_price),
            top_out_price: Number(stale.top_out_price),
            trim_set_price: Number(stale.trim_set_price),
            total_price: Number(stale.total_price),
          },
          siblingEntries: ((data as Array<{ id: string; version_id: string } & BookEntryPrices> | null) ?? []).map((e) => ({
            ...e,
            rough_in_price: Number(e.rough_in_price),
            top_out_price: Number(e.top_out_price),
            trim_set_price: Number(e.trim_set_price),
            total_price: Number(e.total_price),
          })),
        })
        siblingEntryIds = carry.entryIds
        siblingPricingCount = carry.pricingIds.length
      }
    }
    if (token !== bookOfferTokenRef.current) return // context moved on while we fetched
    setPendingBookOffer({ offer, fixtureTypeId, prices, siblingEntryIds, siblingPricingCount })
  }

  /**
   * Carry the parked book edit into the bid's own copy. Assignments already point at the copy's
   * entry id, so an updated price re-prices every assigned row with no re-assigning; an added
   * entry simply starts turning up in the assign dropdowns.
   */
  async function applyPendingBookOffer() {
    if (!guardPriceRowsWrite()) return
    const pending = pendingBookOffer
    const versionId = selectedPricingVersionId
    if (!pending || !versionId || applyingBookOffer) return
    setApplyingBookOffer(true)
    try {
      const { offer, fixtureTypeId, prices } = pending
      if (offer.kind === 'update') {
        const { error: err } = await supabase
          .from('price_book_entries')
          .update(prices)
          .in('id', [offer.bidEntryId, ...pending.siblingEntryIds])
        if (err) {
          setError(err.message)
          return
        }
      } else {
        const maxSeq = priceBookEntries.length === 0 ? 0 : Math.max(...priceBookEntries.map((entry) => entry.sequence_order))
        const { error: err } = await supabase
          .from('price_book_entries')
          .insert({ version_id: versionId, fixture_type_id: fixtureTypeId, ...prices, sequence_order: maxSeq + 1 })
        if (err) {
          setError(err.message)
          return
        }
      }
      await loadPriceBookEntries(versionId)
      setPendingBookOffer(null)
      showToast(
        offer.kind === 'update'
          ? `This bid now prices ${offer.fixtureName} at $${formatCurrency(offer.bookTotal)}${
              pending.siblingPricingCount > 0
                ? ` — across ${pending.siblingPricingCount + 1} price option${pending.siblingPricingCount + 1 === 1 ? '' : 's'}`
                : ''
            }.`
          : `${offer.fixtureName} added to this bid's book — it will come up when you assign.`,
        'success',
      )
    } finally {
      setApplyingBookOffer(false)
    }
  }

  /** What the drawer's own effect runs when the drawer shuts: a plan still fetching is dropped, and the offer goes. */
  function retireBookOffer() {
    bookOfferTokenRef.current++
    setPendingBookOffer(null)
  }

  return { pendingBookOffer, setPendingBookOffer, applyingBookOffer, noteBookEditForOpenBid, applyPendingBookOffer, retireBookOffer }
}
