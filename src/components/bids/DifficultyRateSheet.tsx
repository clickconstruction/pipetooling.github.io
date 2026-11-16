/**
 * The master's door (punch list #357, PR 5, the canvas's screen 2): *Rate <GC>* as a sheet from the bottom on a phone
 * and a centred box at a desk, opened from a bid row on the Bid Board and from the ask at the end of a job. The same
 * scales and the same save as the GC's card (*How they are to work with*), so the newest rating stands and every chip
 * reads again; what the sheet adds is the consequence before Save: what the picks on screen do to this bid in
 * dollars, priced by the kernel that writes the lines, and how bids to this GC have gone.
 *
 * Paying is locked here: it is read from the GC's bills, or keeps the point the office set by hand on the card. The
 * by-hand door and the earlier ratings stay on the GC's record, one press away.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { difficultyTotalPoints, type DifficultyPicks, type DifficultyScale } from '../../lib/bids/difficultyCriteria'
import { DIFFICULTY_PAYING_KEY, difficultyPayingByHandOf, difficultyPayingPick, readDifficultyPaying, type DifficultyPayingRead } from '../../lib/bids/difficultyPaying'
import { DIFFICULTY_PRICE_V1, difficultyCanRate, difficultyPayingRuleOf, type DifficultyPriceList } from '../../lib/bids/difficultyPrice'
import {
  GC_DIFFICULTY_WORDS as W,
  gcDifficultyCardHref,
  gcDifficultyCarryLine,
  gcDifficultyDraftProblems,
  gcDifficultyOpeningPicks,
  gcDifficultyPicksChanged,
  gcDifficultyPicksToSave,
  gcDifficultyRatedByWords,
  gcDifficultyStanding,
  gcDifficultyStoredBillsPick,
  type DifficultyVersionLite,
  type GcDifficultyRating,
  type GcDifficultyStanding,
} from '../../lib/bids/gcDifficultyRating'
import { BID_PICK_WORDS, bidPicksUnder, difficultyBidScales } from '../../lib/bids/bidDifficultyPicks'
import { RATE_SHEET_WORDS as S, rateSheetBidNumbers, rateSheetConsequence, rateSheetGcRecord, rateSheetGcRecordWords, rateSheetOverTitle, rateSheetPayingWords, rateSheetSavePlan } from '../../lib/bids/difficultyRateSheet'
import { supabaseRateSheetIo, type RateSheetBid, type RateSheetBidRead, type RateSheetIo } from '../../lib/bids/difficultyRateSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PhoneSheet } from '../PhoneSheet'
import DifficultyScalesPicker from './DifficultyScalesPicker'

const DEFAULT_IO = supabaseRateSheetIo()

const BODY: CSSProperties = { padding: '0.75rem 1rem 0.9rem', overflowY: 'auto', display: 'grid', gap: '0.85rem', minHeight: 0 }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const LEAD: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }
const AMBER: CSSProperties = { ...MUTED, color: 'var(--text-amber-800)' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', display: 'inline-block', padding: '13px 0', margin: '-13px 0', cursor: 'pointer', textDecoration: 'none' }
const TEXTAREA: CSSProperties = { font: 'inherit', fontSize: '1rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', resize: 'vertical', width: '100%', boxSizing: 'border-box', minHeight: 64 }
const BOX: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.8rem', display: 'grid', gap: '0.3rem', lineHeight: 1.45 }
const FOOT: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1.7fr', gap: '0.5rem', padding: '0.6rem 1rem 0.75rem', borderTop: '1px solid var(--border)', flex: 'none' }
const FOOT_BTN: CSSProperties = { font: 'inherit', fontSize: '0.9375rem', fontWeight: 600, height: 44, borderRadius: 10, padding: '0 0.75rem' }

export type DifficultyRateSheetProps = {
  customerId: string
  customerName: string
  /** The bid the sheet was opened from; absent for the ask at the end of a job. */
  bid?: RateSheetBid | null
  /** The end-of-job ask: the job is named in the lead and in *What happened*. */
  ask?: { jobLabel: string } | null
  role: UserRole | null | undefined
  io?: RateSheetIo
  onClose: () => void
  onSaved?: (rating: GcDifficultyRating) => void
  /** *Not now* when it means more than closing (the ask is put away for good). */
  onNotNow?: () => void
}

export default function DifficultyRateSheet({ customerId, customerName, bid = null, ask = null, role, io = DEFAULT_IO, onClose, onSaved, onNotNow }: DifficultyRateSheetProps) {
  const { showToast } = useToastContext()
  const [price, setPrice] = useState<DifficultyPriceList | null>(null)
  const [versions, setVersions] = useState<DifficultyVersionLite[] | null>(null)
  const [published, setPublished] = useState<DifficultyVersionLite | null>(null)
  const [ratings, setRatings] = useState<GcDifficultyRating[] | null>(null)
  /** Null while it reads. */
  const [paying, setPaying] = useState<DifficultyPayingRead | null>(null)
  const [bidRead, setBidRead] = useState<RateSheetBidRead | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  /** The picked scales only; the bills scale's pick is derived. */
  const [picks, setPicks] = useState<DifficultyPicks>({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  /** PR 6: the bid's own picks (the site), as stored and as on screen. */
  const [bidPicksStored, setBidPicksStored] = useState<DifficultyPicks>({})
  const [bidPicks, setBidPicks] = useState<DifficultyPicks>({})
  const canRate = difficultyCanRate(price, role)

  const load = useCallback(async () => {
    try {
      const [v, r] = await Promise.all([io.loadVersions(), io.loadRatings(customerId)])
      setVersions(v.versions)
      setPublished(v.published)
      setRatings(r)
      setFailed(null)
      const newest = r[0] ?? null
      const { [DIFFICULTY_PAYING_KEY]: _paying, ...rest } = gcDifficultyOpeningPicks(newest ? gcDifficultyStanding(newest, v.versions, v.published) : null)
      void _paying
      setPicks(rest)
    } catch (e) {
      setFailed(formatErrorMessage(e, 'The rating could not be read.'))
    }
    // The price list and the bills each fail on their own: version 1's rule then, and a scale that says it is not read.
    let list: DifficultyPriceList | null = null
    try {
      list = io.loadPrice ? await io.loadPrice() : null
    } catch {
      list = null
    }
    setPrice(list)
    const rule = list ? difficultyPayingRuleOf(list) : undefined
    try {
      setPaying(readDifficultyPaying(await io.loadPaying(customerId), rule))
    } catch {
      setPaying(readDifficultyPaying({ readable: false, own: null, receipts: [], gcPace: null, calendar: null, todayYmd: '' }, rule))
    }
  }, [io, customerId])

  useEffect(() => {
    void load()
  }, [load])

  const bidId = bid?.id ?? null
  useEffect(() => {
    if (!bid) return
    let live = true
    io.loadBid(bid)
      .then((r) => {
        if (live) setBidRead(r)
      })
      .catch(() => {
        if (live) setBidRead({ pin: null, estimate: null, history: null })
      })
    io.loadBidPicks?.(bid.id)
      .then((p) => {
        if (!live) return
        setBidPicksStored(p)
        setBidPicks(p)
      })
      .catch(() => {})
    return () => {
      live = false
    }
    // The bid's id is its identity here: the row object is new on every render of the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [io, bidId])

  const standing: GcDifficultyStanding | null = useMemo(() => {
    const newest = ratings?.[0]
    return newest && versions ? gcDifficultyStanding(newest, versions, published) : null
  }, [ratings, versions, published])

  const body = published?.body ?? null
  // The bid's own scales draw only from a bid, and only when the published version has one.
  const bidScales = bid ? difficultyBidScales(body) : []
  const bidPicksNow = useMemo(() => (bidScales.length > 0 ? bidPicksUnder(bidPicks, body) : {}), [bidScales.length, bidPicks, body])
  const bidPicksWere = useMemo(() => (bidScales.length > 0 ? bidPicksUnder(bidPicksStored, body) : {}), [bidScales.length, bidPicksStored, body])
  const bidChanged = bidScales.some((sc) => bidPicksNow[sc.key] !== bidPicksWere[sc.key])
  const payingScale = body?.scales.find((s) => s.key === DIFFICULTY_PAYING_KEY && s.source === 'bills') ?? null
  const storedPaying = gcDifficultyStoredBillsPick(standing, DIFFICULTY_PAYING_KEY)
  const storedByHand = storedPaying ? difficultyPayingByHandOf(storedPaying.reason) : null
  const payingPick = payingScale ? difficultyPayingPick(paying, storedPaying && storedByHand != null ? { points: storedPaying.points, reason: storedByHand } : null) : null
  const allPicks: DifficultyPicks = useMemo(() => (payingPick ? { ...picks, [DIFFICULTY_PAYING_KEY]: payingPick.points } : picks), [picks, payingPick])
  const total = (body ? difficultyTotalPoints(allPicks, body, 'gc').points : 0) + Object.values(bidPicksNow).reduce((n, p) => n + p, 0)
  const problems = gcDifficultyDraftProblems(allPicks, note, body)
  const changed = gcDifficultyPicksChanged(allPicks, standing)
  // From a bid, the rating is saved only on a change; from the ask, the same picks with what happened on this job is a
  // rating too. The bid's own picks save on their own, with no reason asked (PR 6).
  const plan = rateSheetSavePlan({ fromAsk: ask != null, hasStanding: standing != null, gcChanged: changed, gcPicked: Object.keys(picks).length > 0, gcProblems: problems, bidChanged, noPickWords: W.noPick })
  const dead = saving || plan.dead
  const carryLine = standing ? gcDifficultyCarryLine(standing) : null

  const numbers = bid && bidRead ? rateSheetBidNumbers({ pin: bidRead.pin, stamp: { revenueUsd: bid.pricedRevenueUsd, costUsd: bid.pricedCostUsd, difficultyUsd: bid.pricedDifficultyUsd }, bidValue: bid.bidValue, estimate: bidRead.estimate }) : null
  const consequence = body ? rateSheetConsequence({ picks: allPicks, body, price: price ?? DIFFICULTY_PRICE_V1, numbers, payingReason: payingPick?.reason ?? null, hasBid: bid != null, bidPicks: bidPicksNow }) : null
  const recordWords = bid ? rateSheetGcRecordWords(rateSheetGcRecord(bidRead?.history ?? null, customerId)) : null
  const overTitle = rateSheetOverTitle(bid ? { label: bid.label, project: bid.project } : null)

  const save = async () => {
    if (dead || !published || !body) return
    setSaving(true)
    try {
      // The bid's own picks first: a refusal there leaves the rating unsaved, never a rating with half of what was picked.
      if (plan.bidPicks && bid && io.saveBidPicks) setBidPicksStored(await io.saveBidPicks(bid.id, published.id, bidPicksNow))
      if (plan.rating) {
        const reasons: Record<string, string> = payingPick ? { [DIFFICULTY_PAYING_KEY]: payingPick.reason } : {}
        const toSave = gcDifficultyPicksToSave(allPicks, body, reasons)
        const saved = await io.saveRating(customerId, published.id, toSave.picks, note.trim(), toSave.reasons)
        showToast(W.saved(difficultyTotalPoints(saved.picks, body, 'gc').points), 'success')
        onSaved?.(saved)
      } else {
        showToast(S.savedBidOnly, 'success')
      }
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The rating was not saved.'), 'error')
      setSaving(false)
    }
  }

  const billsLine = (_scale: DifficultyScale) => (
    <span data-testid="rate-sheet-paying" style={{ display: 'block', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.65rem', lineHeight: 1.45 }}>
      {paying == null && !payingPick ? 'Reading their bills…' : rateSheetPayingWords({ pick: payingPick, read: paying })}
    </span>
  )

  const title = (
    <>
      {overTitle ? (
        <span data-testid="rate-sheet-over-title" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {overTitle}
        </span>
      ) : null}
      {S.title(customerName)}
    </>
  )

  return (
    <PhoneSheet label={S.title(customerName)} title={title} width={440} zIndex={1300} dataAttrs={{ 'data-difficulty-rate-sheet': customerId }} onClose={onClose}>
      <div style={BODY}>
        {standing ? (
          <p style={MUTED} data-testid="rate-sheet-rated-by">
            {gcDifficultyRatedByWords(standing)}
          </p>
        ) : null}
        <p style={LEAD}>{ask ? S.askLead(ask.jobLabel) : S.lead}</p>
        {failed ? (
          <p style={AMBER} role="alert">
            {failed}{' '}
            <button type="button" style={QUIET} onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}
        {versions && !published ? <p style={AMBER}>{W.noVersion}</p> : null}
        {carryLine ? <p style={AMBER}>{carryLine}</p> : null}
        {!canRate && body ? <p style={MUTED}>{S.cannotRate}</p> : null}
        {body ? <DifficultyScalesPicker body={body} picks={allPicks} scope="gc" readOnly={!canRate} groupName={`rate-sheet-${customerId}`} onPick={(key, points) => setPicks((p) => ({ ...p, [key]: points }))} billsLine={billsLine} /> : null}
        {body && bidScales.length > 0 ? (
          <section data-testid="rate-sheet-bid-picks" aria-label={BID_PICK_WORDS.sheetHead} style={{ display: 'grid', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <p style={MUTED}>
              <b style={{ color: 'var(--text-strong)' }}>{BID_PICK_WORDS.sheetHead}.</b> {BID_PICK_WORDS.lead}
            </p>
            <DifficultyScalesPicker body={body} picks={bidPicksNow} scope="bid" readOnly={!canRate} groupName={`rate-sheet-bid-${bid?.id ?? ''}`} onPick={(key, points) => setBidPicks((p) => ({ ...p, [key]: points }))} />
          </section>
        ) : null}
        {canRate && body ? (
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            {W.noteLabel}
            <textarea style={TEXTAREA} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ask ? S.askNotePlaceholder(ask.jobLabel) : W.notePlaceholder} maxLength={1000} aria-label={W.noteLabel} />
          </label>
        ) : null}
        {consequence ? (
          <div style={BOX} data-testid="rate-sheet-consequence" aria-live="polite">
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }} data-testid="rate-sheet-consequence-head">
              {bid && !bidRead ? 'Reading the bid…' : consequence.head}
            </span>
            {bid && !bidRead ? null : consequence.detail ? <span style={{ fontSize: '0.875rem', color: 'var(--text-base)' }}>{consequence.detail}</span> : null}
            {consequence.notes.map((n) => (
              <span key={n} style={AMBER}>
                {n}
              </span>
            ))}
            {recordWords ? (
              <span style={MUTED} data-testid="rate-sheet-record">
                {recordWords}
              </span>
            ) : null}
          </div>
        ) : null}
        <Link to={gcDifficultyCardHref(customerId)} style={QUIET} onClick={onClose}>
          Open their record
        </Link>
      </div>
      <div style={FOOT}>
        <button type="button" onClick={onNotNow ?? onClose} style={{ ...FOOT_BTN, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
          {S.notNow}
        </button>
        {canRate ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={dead}
            aria-disabled={dead}
            title={plan.why ?? undefined}
            style={{ ...FOOT_BTN, border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : W.save(total)}
          </button>
        ) : (
          <span />
        )}
      </div>
    </PhoneSheet>
  )
}
