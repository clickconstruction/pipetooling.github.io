/**
 * The customer's page → **How they are to work with** (punch list #357, PR 2): the GC's difficulty rating, drawn from
 * the published criteria. The office picks a sentence on each scale, says what happened and saves; the newest rating
 * stands and every earlier one is kept under *Earlier ratings*. A rating made under an older version is carried to the
 * published one by the key and the points, and the card says what did not carry. Estimators read it.
 *
 * The Paying scale (PR 3) takes no pick: it is read from the GC's bills (`difficultyPaying.ts` over the pay-speed
 * data, the GC pace and the pay calendar) and the numbers behind the point are drawn under it. The read point goes
 * into the save with its words, so the rating stays a record with reasons; when the bills and the rating that stands
 * disagree, a line says so and the save press wakes. The office may set the point by hand with a reason instead.
 *
 * The chip in the head is the same one the Bid Board and the Workbench show beside the GC's name.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { difficultyPointsWords, difficultyTotalPoints, type DifficultyPicks, type DifficultyScale } from '../../lib/bids/difficultyCriteria'
import {
  DIFFICULTY_PAYING_KEY,
  difficultyPayingByHandOf,
  difficultyPayingDriftWords,
  difficultyPayingPick,
  difficultyPayingRuleWords,
  difficultyPayingWords,
  readDifficultyPaying,
  type DifficultyPayingRead,
} from '../../lib/bids/difficultyPaying'
import {
  GC_DIFFICULTY_WORDS as W,
  gcDifficultyCarryLine,
  gcDifficultyDraftProblems,
  gcDifficultyHistoryLine,
  gcDifficultyOpeningPicks,
  gcDifficultyPicksChanged,
  gcDifficultyPicksToSave,
  gcDifficultyRatedByWords,
  gcDifficultyStanding,
  gcDifficultyStoredBillsPick,
  gcDifficultyTotalWords,
  type DifficultyVersionLite,
  type GcDifficultyRating,
  type GcDifficultyStanding,
} from '../../lib/bids/gcDifficultyRating'
import { supabaseGcDifficultyIo, type GcDifficultyIo } from '../../lib/bids/gcDifficultyRatingIo'
import { isOfficeRole } from '../../lib/doorRoles'
import { formatErrorMessage } from '../../utils/errorHandling'
import DifficultyScalesPicker from '../bids/DifficultyScalesPicker'
import GcDifficultyChip from '../bids/GcDifficultyChip'

const DEFAULT_IO = supabaseGcDifficultyIo()

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 16 }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)', flexWrap: 'wrap' }
const BODY: CSSProperties = { padding: '12px 13px', display: 'grid', gap: '0.9rem' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const AMBER: CSSProperties = { ...MUTED, color: 'var(--text-amber-800)' }
const TEXTAREA: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', resize: 'vertical', width: '100%', boxSizing: 'border-box', minHeight: 56 }
const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-base)', width: '100%', boxSizing: 'border-box' }
const FOOT: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, height: 36, padding: '0 0.75rem', cursor: 'pointer' }
const BILLS_BOX: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem', lineHeight: 1.45 }

function savePress(dead: boolean): CSSProperties {
  return { font: 'inherit', fontWeight: 600, fontSize: '0.875rem', height: 44, padding: '0 1.1rem', border: 0, borderRadius: 10, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer', marginLeft: 'auto' }
}

type ByHand = { points: number; reason: string }

export default function GcDifficultyCard({ customerId, customerName, role, io = DEFAULT_IO }: { customerId: string; customerName: string; role: UserRole | null | undefined; io?: GcDifficultyIo }) {
  const { showToast } = useToastContext()
  const canRate = isOfficeRole(role)
  const [versions, setVersions] = useState<DifficultyVersionLite[] | null>(null)
  const [published, setPublished] = useState<DifficultyVersionLite | null>(null)
  const [ratings, setRatings] = useState<GcDifficultyRating[] | null>(null)
  const [paying, setPaying] = useState<DifficultyPayingRead | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  /** The picked scales only; the bills scale's pick is derived. */
  const [picks, setPicks] = useState<DifficultyPicks>({})
  const [note, setNote] = useState('')
  const [byHand, setByHand] = useState<ByHand | null>(null)
  const [byHandOpen, setByHandOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showEarlier, setShowEarlier] = useState(false)

  const load = useCallback(async () => {
    try {
      const [v, r] = await Promise.all([io.loadVersions(), io.loadRatings(customerId)])
      setVersions(v.versions)
      setPublished(v.published)
      setRatings(r)
      setFailed(null)
      const newest = r[0] ?? null
      const standing = newest ? gcDifficultyStanding(newest, v.versions, v.published) : null
      const opening = gcDifficultyOpeningPicks(standing)
      const { [DIFFICULTY_PAYING_KEY]: storedPaying, ...rest } = opening
      setPicks(rest)
      const stored = gcDifficultyStoredBillsPick(standing, DIFFICULTY_PAYING_KEY)
      const handReason = stored ? difficultyPayingByHandOf(stored.reason) : null
      setByHand(stored && handReason != null && storedPaying != null ? { points: stored.points, reason: handReason } : null)
      setByHandOpen(false)
      setNote('')
    } catch (e) {
      setFailed(formatErrorMessage(e, 'The rating could not be read.'))
    }
    // The bills read fails on its own: the scale then says it could not be read.
    try {
      setPaying(readDifficultyPaying(await io.loadPaying(customerId)))
    } catch {
      setPaying(readDifficultyPaying({ readable: false, own: null, receipts: [], gcPace: null, calendar: null, todayYmd: '' }))
    }
  }, [io, customerId])

  useEffect(() => {
    void load()
  }, [load])

  const standing: GcDifficultyStanding | null = useMemo(() => {
    const newest = ratings?.[0]
    return newest && versions ? gcDifficultyStanding(newest, versions, published) : null
  }, [ratings, versions, published])

  const body = published?.body ?? null
  const payingScale = body?.scales.find((s) => s.key === DIFFICULTY_PAYING_KEY && s.source === 'bills') ?? null
  const payingPick = payingScale ? difficultyPayingPick(paying, byHand) : null
  const allPicks: DifficultyPicks = useMemo(() => (payingPick ? { ...picks, [DIFFICULTY_PAYING_KEY]: payingPick.points } : picks), [picks, payingPick])
  const reasons = useMemo<Record<string, string>>(() => (payingPick ? { [DIFFICULTY_PAYING_KEY]: payingPick.reason } : {}), [payingPick])
  const total = body ? difficultyTotalPoints(allPicks, body, 'gc').points : 0
  const problems = gcDifficultyDraftProblems(allPicks, note, body)
  const changed = gcDifficultyPicksChanged(allPicks, standing)
  const dead = saving || problems.length > 0 || (!changed && standing != null)
  const carryLine = standing ? gcDifficultyCarryLine(standing) : null
  const storedPaying = gcDifficultyStoredBillsPick(standing, DIFFICULTY_PAYING_KEY)
  const driftLine = payingScale && !byHand ? difficultyPayingDriftWords(storedPaying, paying) : null

  const save = async () => {
    if (dead || !published || !body) return
    setSaving(true)
    try {
      const toSave = gcDifficultyPicksToSave(allPicks, body, reasons)
      const saved = await io.saveRating(customerId, published.id, toSave.picks, note.trim(), toSave.reasons)
      setRatings((r) => [saved, ...(r ?? [])])
      setNote('')
      showToast(W.saved(difficultyTotalPoints(saved.picks, body, 'gc').points), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The rating was not saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const billsLine = (scale: DifficultyScale) => (
    <PayingLine scale={scale} read={paying} byHand={byHand} open={byHandOpen} canRate={canRate} driftLine={driftLine} storedByHand={storedPaying ? difficultyPayingByHandOf(storedPaying.reason) : null} onOpen={() => setByHandOpen(true)} onClose={() => setByHandOpen(false)} onSet={(v) => { setByHand(v); setByHandOpen(false) }} onClear={() => { setByHand(null); setByHandOpen(false) }} />
  )

  return (
    <section style={CARD} id="gc-difficulty" data-testid="gc-difficulty-card" aria-label={W.cardTitle}>
      <div style={HEAD}>
        {W.cardTitle}
        {standing ? <GcDifficultyChip standing={standing} customerId={customerId} /> : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{W.notRated}</span>}
        <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>{W.cardLead}</span>
      </div>
      <div style={BODY}>
        {failed ? (
          <p style={AMBER} role="alert">
            {failed}{' '}
            <button type="button" style={QUIET} onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}
        {versions && !published ? <p style={AMBER}>{W.noVersion}</p> : null}
        {carryLine ? <p style={AMBER} data-testid="gc-difficulty-carry">{carryLine}</p> : null}
        {!canRate && body ? <p style={MUTED}>{W.cannotRate}</p> : null}
        {body ? (
          <DifficultyScalesPicker body={body} picks={allPicks} scope="gc" readOnly={!canRate} groupName={`gc-${customerId}`} onPick={(key, points) => setPicks((p) => ({ ...p, [key]: points }))} billsLine={billsLine} />
        ) : null}
        {canRate && body ? (
          <label style={{ display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            {W.noteLabel}
            <textarea style={TEXTAREA} value={note} onChange={(e) => setNote(e.target.value)} placeholder={W.notePlaceholder} maxLength={1000} aria-label={W.noteLabel} />
          </label>
        ) : null}
        {body ? (
          <div style={FOOT}>
            <div style={{ display: 'grid', gap: '0.15rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }} data-testid="gc-difficulty-total">
                {gcDifficultyTotalWords(total)}
              </span>
              <span style={MUTED}>{standing ? gcDifficultyRatedByWords(standing) : `Not rated yet. Criteria version ${published?.version ?? '?'}.`}</span>
            </div>
            {canRate ? (
              <button type="button" style={savePress(dead)} disabled={dead} aria-disabled={dead} title={problems[0] ?? (!changed && standing ? 'Nothing changed since the rating that stands.' : undefined)} onClick={() => void save()}>
                {W.save(total)}
              </button>
            ) : null}
          </div>
        ) : null}
        {ratings && ratings.length > 1 ? (
          <div>
            <button type="button" style={QUIET} onClick={() => setShowEarlier((v) => !v)} aria-expanded={showEarlier}>
              {W.earlier} ({ratings.length - 1})
            </button>
            {showEarlier ? (
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-base)' }} data-testid="gc-difficulty-earlier">
                {ratings.slice(1).map((r) => (
                  <li key={r.id}>{gcDifficultyHistoryLine(r, versions ?? [])}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p style={{ ...MUTED, fontSize: '0.75rem' }}>{customerName.trim() || 'This customer'} keeps one rating. The Bid Board&rsquo;s price list says what a point costs, in a later part.</p>
      </div>
    </section>
  )
}

/** Under the Paying scale: the numbers behind the read, the rule, the drift line, and the by-hand door. */
function PayingLine({
  scale,
  read,
  byHand,
  open,
  canRate,
  driftLine,
  storedByHand,
  onOpen,
  onClose,
  onSet,
  onClear,
}: {
  scale: DifficultyScale
  read: DifficultyPayingRead | null
  byHand: ByHand | null
  open: boolean
  canRate: boolean
  driftLine: string | null
  /** The by-hand reason the rating that stands holds, for the line that says so. */
  storedByHand: string | null
  onOpen: () => void
  onClose: () => void
  onSet: (v: ByHand) => void
  onClear: () => void
}) {
  const [points, setPoints] = useState<number>(byHand?.points ?? 1)
  const [reason, setReason] = useState(byHand?.reason ?? '')
  const rungs = scale.rungs.length > 0 ? scale.rungs.map((r) => r.points) : Array.from({ length: scale.max + 1 }, (_, i) => i)
  return (
    <div style={BILLS_BOX} data-testid="gc-difficulty-paying">
      <span data-testid="gc-difficulty-paying-words">{read ? difficultyPayingWords(read) : 'Reading their bills…'}</span>
      <span style={MUTED}>{difficultyPayingRuleWords(read?.rule ?? { daysPast: 45, lateBillsInYear: 2, minBills: 3 })}</span>
      {byHand ? (
        <span style={AMBER} data-testid="gc-difficulty-paying-by-hand">
          Set by hand to {difficultyPointsWords(byHand.points)}: {byHand.reason}
          {canRate ? (
            <>
              {' '}
              <button type="button" style={QUIET} onClick={onClear}>
                {W.byHandClear}
              </button>
            </>
          ) : null}
        </span>
      ) : storedByHand != null ? (
        <span style={MUTED}>The rating that stands was set by hand: {storedByHand}</span>
      ) : null}
      {driftLine ? (
        <span style={AMBER} data-testid="gc-difficulty-paying-drift">
          {driftLine}
        </span>
      ) : null}
      {canRate && !byHand && !open ? (
        <span>
          <button type="button" style={QUIET} onClick={onOpen}>
            {W.setByHand}
          </button>
        </span>
      ) : null}
      {open ? (
        <div style={{ display: 'grid', gap: '0.4rem' }} data-testid="gc-difficulty-paying-form">
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {rungs.map((p) => (
              <label key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem' }}>
                <input type="radio" name="gc-difficulty-paying-by-hand" checked={points === p} onChange={() => setPoints(p)} aria-label={`By hand: ${difficultyPointsWords(p)}`} />
                {difficultyPointsWords(p)}
              </label>
            ))}
          </div>
          <input type="text" style={INPUT} value={reason} maxLength={300} placeholder="They pay us first every month" aria-label={W.byHandLabel} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" style={PRESS} disabled={reason.trim() === ''} title={reason.trim() === '' ? W.byHandNoReason : undefined} onClick={() => onSet({ points, reason: reason.trim() })}>
              {W.byHandUse}
            </button>
            <button type="button" style={QUIET} onClick={onClose}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
