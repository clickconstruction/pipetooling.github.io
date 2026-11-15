import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { bidDifficultyAfterTakeOff, bidDifficultyAmountOnRows, bidDifficultyPinFor, bidDifficultyRowsFor, bidDifficultyStageShares, bidDifficultyStale, type BidDifficulty, type BidDifficultyStale, type LaborStageRow } from '../lib/bids/bidDifficulty'
import { supabaseBidDifficultyIo, type BidDifficultyIo } from '../lib/bids/bidDifficultyIo'
import { difficultyLines, type DifficultyLines } from '../lib/bids/difficultyLines'
import { bidDifficultyScalesFor, bidPicksStaleWords, difficultyBidScales } from '../lib/bids/bidDifficultyPicks'
import type { DifficultyPicks } from '../lib/bids/difficultyCriteria'
import { DIFFICULTY_PAYING_KEY, difficultyPayingMedianOf } from '../lib/bids/difficultyPaying'
import type { DifficultyPriceVersion } from '../lib/bids/difficultyPriceIo'
import type { DifficultyVersionLite, GcDifficultyStanding } from '../lib/bids/gcDifficultyRating'

/** What the Pricing tab has on screen, refreshed every render: the numbers the lines are made from. */
export type BidDifficultyOnScreen = {
  bidId: string
  costEstimateId: string | null
  fieldHours: number
  laborRate: number
  /** The Workbench's total cost, difficulty rows included. */
  totalCost: number
  /** Revenue over saved prices; 0 with none. */
  totalRevenue: number
  otherRows: ReadonlyArray<{ id: string; rough_in: number; top_out: number; trim_set: number; sequence_order: number }>
  laborRows: ReadonlyArray<LaborStageRow>
  sent: boolean
  /** The customer-facing price of the bid's own GC is on screen (the stamp's gate). */
  mayWrite: boolean
}

export type BidDifficultyState = {
  pin: BidDifficulty | null
  /** Null until the read lands. */
  loaded: boolean
  busy: 'writing' | 'reading-in' | 'taking-off' | null
  failed: string | null
  stale: BidDifficultyStale
  /** The difficulty rows' dollars on the estimate now. */
  onScreenAmount: number
  /** What the last write came to, for the toast and the skipped lines. */
  lastWrite: DifficultyLines | null
  /** Rewrites the lines from the rating that stands and the bid's own picks; `picksNow` when a pick was just saved. */
  readIn: (picksNow?: DifficultyPicks) => Promise<void>
  takeOff: (key: string, reason: string, byName: string) => Promise<void>
}

const DEFAULT_IO = supabaseBidDifficultyIo()

const NO_BID_PICKS: DifficultyPicks = {}

function linesNow(standing: GcDifficultyStanding | null, bidPicks: DifficultyPicks, published: DifficultyVersionLite | null, price: DifficultyPriceVersion, now: BidDifficultyOnScreen, pin: BidDifficulty | null): { lines: DifficultyLines; ownCost: number; carried: number } {
  const existing = pin ? bidDifficultyAmountOnRows(now.otherRows, pin.rowIds) : 0
  const ownCost = Math.max(0, now.totalCost - existing)
  const carried = now.totalRevenue > 0 ? now.totalRevenue : ownCost
  const reason = standing?.rating.pickReasons[DIFFICULTY_PAYING_KEY] ?? null
  const lines = difficultyLines({
    // PR 6: the GC's rated scales, then the bid's own picks (the site).
    scales: bidDifficultyScalesFor(standing, bidPicks, published?.body ?? null),
    price: price.body,
    fieldHours: now.fieldHours,
    laborRate: now.laborRate,
    ownCost,
    carried,
    payingMedianDays: difficultyPayingMedianOf(reason),
    payingReason: reason,
  })
  return { lines, ownCost, carried }
}

/**
 * The difficulty lines on a bid (punch list #357, PR 4). Lives at the Pricing tab's top level. When the Workbench
 * first costs a bid to a rated GC under a published price list, it writes the lines as Other rows on the estimate
 * and pins them (`bid_difficulty`); from then on the pin is what the strip reads. A newer rating never moves the pin:
 * `stale` says so, and `readIn` rewrites the rows from it. `takeOff` drops one line with a reason. Every write
 * reloads the bid's pricing rows, so the Workbench's cost and the stamp count the lines.
 *
 * PR 6: the bid's own picks (the site, `bid_difficulty_picks`) are priced with the GC's rating into the same lines.
 * A bid to a GC nobody has rated is priced on its own picks alone. `readIn` takes the picks just saved, so a pick
 * on the strip lands in one press.
 */
export function useBidDifficulty(args: {
  bidId: string | null
  standing: GcDifficultyStanding | null
  /** The bid's own picks under the published version (PR 6); none when absent. */
  bidPicks?: DifficultyPicks
  published?: DifficultyVersionLite | null
  price: DifficultyPriceVersion | null
  /** The numbers are settled and the estimate exists: a write may read them. */
  ready: boolean
  latest: MutableRefObject<BidDifficultyOnScreen | null>
  reload: (bidId: string) => Promise<void>
  /** After rows land: the Pricing tab re-arms the priced-margin stamp, since the cost moved. */
  onWrote?: () => void
  io?: BidDifficultyIo
}): BidDifficultyState {
  const { bidId, standing, price, ready, latest, reload, onWrote } = args
  const bidPicks = args.bidPicks ?? NO_BID_PICKS
  const published = args.published ?? null
  const hasBidPicks = Object.keys(bidPicks).length > 0
  const io = args.io ?? DEFAULT_IO
  const [pin, setPin] = useState<BidDifficulty | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<BidDifficultyState['busy']>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [lastWrite, setLastWrite] = useState<DifficultyLines | null>(null)
  /** The bid a first write was tried on, so a refused write is not retried every render. */
  const triedRef = useRef<string | null>(null)

  useEffect(() => {
    setPin(null)
    setLoaded(false)
    setFailed(null)
    setLastWrite(null)
    if (!bidId) return
    let live = true
    io.load(bidId)
      .then((p) => {
        if (!live) return
        setPin(p)
        setLoaded(true)
      })
      .catch((e: unknown) => {
        if (!live) return
        setFailed(formatErrorMessage(e, 'The bid’s difficulty lines could not be read.'))
        setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [bidId, io])

  const write = useCallback(
    async (kind: 'writing' | 'reading-in', picksNow?: DifficultyPicks) => {
      const now = latest.current
      const own = picksNow ?? bidPicks
      if (!bidId || !price || !now || now.bidId !== bidId || !now.costEstimateId) return
      // Nothing to price and nothing priced: a bid to an unrated GC with no pick of its own.
      if (!standing && Object.keys(own).length === 0 && !pin) return
      setBusy(kind)
      setFailed(null)
      try {
        const { lines, ownCost, carried } = linesNow(standing, own, published, price, now, pin)
        const shares = bidDifficultyStageShares(now.laborRows)
        const nextSeq = now.otherRows.reduce((m, r) => Math.max(m, r.sequence_order), 0) + 1
        const rows = bidDifficultyRowsFor(lines.lines, now.costEstimateId, shares, nextSeq)
        const next = bidDifficultyPinFor({ bidId, costEstimateId: now.costEstimateId, standing, bidPicks: own, publishedVersionId: published?.id ?? null, priceVersionId: price.id, lines, fieldHours: now.fieldHours, laborRate: now.laborRate, ownCost, carried, rowIds: [] })
        const { rowIds: _drop, ...body } = next
        void _drop
        const saved = await io.write(body, rows, pin?.rowIds ?? [])
        setPin(saved)
        setLastWrite(lines)
        await reload(bidId)
        onWrote?.()
      } catch (e) {
        setFailed(formatErrorMessage(e, 'The difficulty lines could not be written.'))
      } finally {
        setBusy(null)
      }
    },
    [bidId, standing, bidPicks, published, price, pin, latest, reload, onWrote, io],
  )

  // The first write: once, when the bid is costed for the first time under a rating and a price list.
  const standingId = standing?.rating.id ?? null
  const priceId = price?.id ?? null
  useEffect(() => {
    if (!bidId || !loaded || pin || (!standingId && !hasBidPicks) || !priceId || !ready || busy) return
    const now = latest.current
    if (!now || now.bidId !== bidId || now.sent || !now.mayWrite || !now.costEstimateId) return
    if (!(now.fieldHours > 0) || !(now.laborRate > 0)) return
    if (triedRef.current === bidId) return
    triedRef.current = bidId
    void write('writing')
  }, [bidId, loaded, pin, standingId, hasBidPicks, priceId, ready, busy, latest, write])

  const readIn = useCallback(
    async (picksNow?: DifficultyPicks) => {
      await write('reading-in', picksNow)
    },
    [write],
  )

  const takeOff = useCallback(
    async (key: string, reason: string, byName: string) => {
      if (!bidId || !pin) return
      const next = bidDifficultyAfterTakeOff(pin, key, reason, byName, new Date().toISOString())
      if (!next) return
      setBusy('taking-off')
      setFailed(null)
      try {
        const rowId = pin.rowIds[next.rowIndex] ?? null
        const saved = await io.takeOff(pin, rowId, { lines: next.lines, removed: next.removed, points: next.points, totalUsd: next.totalUsd })
        setPin(saved)
        await reload(bidId)
        onWrote?.()
      } catch (e) {
        setFailed(formatErrorMessage(e, 'The line could not be taken off.'))
      } finally {
        setBusy(null)
      }
    },
    [bidId, pin, reload, onWrote, io],
  )

  const now = latest.current
  const onScreenAmount = pin && now && now.bidId === bidId ? bidDifficultyAmountOnRows(now.otherRows, pin.rowIds) : 0

  const bidScaleKeys = difficultyBidScales(published?.body ?? null).map((sc) => sc.key)
  const stale = bidDifficultyStale(pin, standing, bidPicksStaleWords(pin?.picks ?? null, bidPicks, published?.body ?? null), bidScaleKeys)
  return { pin, loaded, busy, failed, stale, onScreenAmount, lastWrite, readIn, takeOff }
}
