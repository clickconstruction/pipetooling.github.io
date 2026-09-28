/**
 * Bids → Pricing: the quotes / RFQ / robot doors on the Workbench header (region P6 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`), moved out of `BidsPricingTab` as it was.
 *
 * Owns the twelve values behind the doors (seven open flags, the compose scope, the quote
 * count and its nonce, the bid's requests, the houses with a request still out), the read of
 * `bid_quotes` / `bid_rfqs` / `email_send_log`, the bid's price-matrix requests, the header
 * chip and the two one-shot URL doors — `?robot=price&bidId=` through the router and
 * `?d22audit=1` through `window.history` (the map's quirk 18: two mechanisms, kept as they
 * are). The modals themselves render in `PricingQuoteModals`.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { derivePricingChip, type RobotChip } from '../lib/rfq/priceMatrixRequest'
import { deskRfqsFromRows, openRfqHouseIdsFromRows, rfqEmailEventsById, rfqResendEmailIds, type DeskRfq } from '../lib/rfq/rfqDesk'
import { usePriceMatrixRequests } from './usePriceMatrixRequests'

/** What "Send by email" hands from the fixture copy to the compose window. */
export type PricingComposeScope = { lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string }

export function usePricingQuoteDesk({
  selectedBid,
  canPackageAndSendBidPricing,
}: {
  /** The bid open on the Pricing tab. The robot door waits for it; the reads key on its id. */
  selectedBid: { id: string } | null
  /** Cost-side data — the same roles that can Share. */
  canPackageAndSendBidPricing: boolean
}) {
  const [d22AuditOpen, setD22AuditOpen] = useState(false)
  const [prepareCopyOpen, setPrepareCopyOpen] = useState(false)
  // RFQ Phase 1 (v2.2630, docs/SUPPLY_HOUSE_RFQ_PLAN.md): plug in supply house
  // replies and compare them. Cost-side data — the same roles that can Share.
  const [plugInQuoteOpen, setPlugInQuoteOpen] = useState(false)
  // Submittals stage 1 (v2.3460): the plan's fixture schedule → bid_specified_products.
  const [plugInScheduleOpen, setPlugInScheduleOpen] = useState(false)
  // Price Matrix PR 2: the robot door and its status sheet (PriceWithRobotModal).
  const [priceWithRobotOpen, setPriceWithRobotOpen] = useState(false)
  // Deep link (Price requests PR 4, v2.3573): /bids?tab=pricing&bidId=…&robot=price — the
  // Price requests panel's "Price with robot · N quotes in" button lands here and opens the
  // same modal Pricing's own button does, once the bid is in hand; then the flag drops so a
  // reload does not reopen it.
  const [robotSearchParams, setRobotSearchParams] = useSearchParams()
  useEffect(() => {
    if (robotSearchParams.get('robot') !== 'price') return
    const wanted = robotSearchParams.get('bidId')
    if (!selectedBid || (wanted && wanted !== selectedBid.id)) return
    if (canPackageAndSendBidPricing) setPriceWithRobotOpen(true)
    setRobotSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('robot')
      return next
    }, { replace: true })
  }, [robotSearchParams, selectedBid, canPackageAndSendBidPricing, setRobotSearchParams])
  const [quotesCompareOpen, setQuotesCompareOpen] = useState(false)
  const [quoteCount, setQuoteCount] = useState(0)
  const [quoteNonce, setQuoteNonce] = useState(0)
  // Lane B (v2.2636): the header chip is derived from the bid's requests +
  // their email delivery state (deriveRfqChip — none / quotes-only / waiting /
  // bounced / all-in). The desk and compose modals hang off it.
  const [deskRfqs, setDeskRfqs] = useState<DeskRfq[]>([])
  const [rfqDeskOpen, setRfqDeskOpen] = useState(false)
  const [composeScope, setComposeScope] = useState<PricingComposeScope | null>(null)
  useEffect(() => {
    const bidId = selectedBid?.id
    if (!bidId || !canPackageAndSendBidPricing) {
      setQuoteCount(0)
      setDeskRfqs([])
      return
    }
    let cancelled = false
    void (async () => {
      const [{ count, error }, { data: rfqs, error: rErr }] = await Promise.all([
        supabase.from('bid_quotes').select('id', { count: 'exact', head: true }).eq('bid_id', bidId),
        supabase
          .from('bid_rfqs')
          .select('id, status, supply_house_id, sent_to, sent_email, resend_email_id, created_at, viewed_at, last_reminded_at, reminder_count, needed_by')
          .eq('bid_id', bidId)
          .neq('status', 'draft'),
      ])
      if (cancelled) return
      if (!error) setQuoteCount(count ?? 0)
      if (!rErr) {
        const resendIds = rfqResendEmailIds(rfqs ?? [])
        let eventById = new Map<string, string>()
        if (resendIds.length > 0) {
          const { data: logs } = await supabase.from('email_send_log').select('resend_email_id, last_event').in('resend_email_id', resendIds)
          eventById = rfqEmailEventsById(logs ?? [])
        }
        if (cancelled) return
        setOpenRfqHouseIds(openRfqHouseIdsFromRows(rfqs ?? []))
        setDeskRfqs(deskRfqsFromRows(rfqs ?? [], eventById))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBid?.id, canPackageAndSendBidPricing, quoteNonce])
  const [openRfqHouseIds, setOpenRfqHouseIds] = useState<Set<string>>(new Set())
  // Price Matrix PR 2: an open robot request wins the chip (queued / working /
  // blocked / ready); once reviewed, the RFQ chip is back. The table may not be
  // in the schema cache yet (client ahead of the migration) — then the door
  // renders disabled and the chip ignores the robot.
  const {
    requests: priceMatrixRequests,
    supported: priceMatrixSupported,
    reload: reloadPriceMatrixRequests,
  } = usePriceMatrixRequests({ enabled: canPackageAndSendBidPricing && !!selectedBid?.id, bidId: selectedBid?.id ?? null, nonce: quoteNonce })
  const rfqChip = derivePricingChip(deskRfqs, quoteCount, priceMatrixRequests)
  const activePriceMatrixRequest = rfqChip.kind === 'robot' ? (priceMatrixRequests.find((r) => r.id === rfqChip.requestId) ?? null) : null
  const openRobotChip = async (chip: RobotChip) => {
    if (chip.status === 'ready') {
      // Opening the matrix is the review — the chip goes back to the RFQ states.
      await (supabase as unknown as SupabaseClient)
        .from('bid_price_matrix_requests')
        .update({ reviewed_at: new Date().toISOString() })
        .eq('id', chip.requestId)
        .then(() => {}, () => {})
      reloadPriceMatrixRequests()
      setQuotesCompareOpen(true)
      return
    }
    setPriceWithRobotOpen(true)
  }

  // Deep link from the dashboard's Division 22 Needs You item (v2.2627):
  // /bids?tab=pricing&d22audit=1 opens the audit, then strips the param so a
  // reload or back-nav doesn't reopen it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('d22audit') !== '1') return
    if (canPackageAndSendBidPricing) setD22AuditOpen(true)
    params.delete('d22audit')
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; the param is a one-shot door
  }, [])

  return {
    // the header chip
    rfqChip,
    openRobotChip,
    activePriceMatrixRequest,
    priceMatrixSupported,
    reloadPriceMatrixRequests,
    // the doors
    d22AuditOpen,
    setD22AuditOpen,
    prepareCopyOpen,
    setPrepareCopyOpen,
    plugInQuoteOpen,
    setPlugInQuoteOpen,
    plugInScheduleOpen,
    setPlugInScheduleOpen,
    priceWithRobotOpen,
    setPriceWithRobotOpen,
    quotesCompareOpen,
    setQuotesCompareOpen,
    rfqDeskOpen,
    setRfqDeskOpen,
    composeScope,
    setComposeScope,
    // the bid's requests
    openRfqHouseIds,
    /** A quote, a request or a schedule was written — the reads run again. */
    bumpQuoteNonce: () => setQuoteNonce((n) => n + 1),
  }
}

export type PricingQuoteDesk = ReturnType<typeof usePricingQuoteDesk>
