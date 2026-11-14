/**
 * The customer's page → **How they are to work with** (punch list #357, PR 2): the GC's difficulty rating, drawn from
 * the published criteria. The office picks a sentence on each scale, says what happened and saves; the newest rating
 * stands and every earlier one is kept under *Earlier ratings*. A rating made under an older version is carried to the
 * published one by the key and the points, and the card says what did not carry. Estimators read it. A bills scale
 * (Paying) takes no pick: PR 3 reads it from the GC's bills.
 *
 * The chip in the head is the same one the Bid Board and the Workbench show beside the GC's name.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { UserRole } from '../../hooks/useAuth'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { difficultyTotalPoints, type DifficultyPicks } from '../../lib/bids/difficultyCriteria'
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
const FOOT: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }

function savePress(dead: boolean): CSSProperties {
  return { font: 'inherit', fontWeight: 600, fontSize: '0.875rem', height: 44, padding: '0 1.1rem', border: 0, borderRadius: 10, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer', marginLeft: 'auto' }
}

export default function GcDifficultyCard({ customerId, customerName, role, io = DEFAULT_IO }: { customerId: string; customerName: string; role: UserRole | null | undefined; io?: GcDifficultyIo }) {
  const { showToast } = useToastContext()
  const canRate = isOfficeRole(role)
  const [versions, setVersions] = useState<DifficultyVersionLite[] | null>(null)
  const [published, setPublished] = useState<DifficultyVersionLite | null>(null)
  const [ratings, setRatings] = useState<GcDifficultyRating[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [picks, setPicks] = useState<DifficultyPicks>({})
  const [note, setNote] = useState('')
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
      setPicks(newest ? gcDifficultyOpeningPicks(gcDifficultyStanding(newest, v.versions, v.published)) : {})
      setNote('')
    } catch (e) {
      setFailed(formatErrorMessage(e, 'The rating could not be read.'))
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
  const total = body ? difficultyTotalPoints(picks, body, 'gc').points : 0
  const problems = gcDifficultyDraftProblems(picks, note, body)
  const changed = gcDifficultyPicksChanged(picks, standing)
  const dead = saving || problems.length > 0 || (!changed && standing != null)
  const carryLine = standing ? gcDifficultyCarryLine(standing) : null

  const save = async () => {
    if (dead || !published || !body) return
    setSaving(true)
    try {
      const saved = await io.saveRating(customerId, published.id, gcDifficultyPicksToSave(picks, body), note.trim())
      setRatings((r) => [saved, ...(r ?? [])])
      setNote('')
      showToast(W.saved(difficultyTotalPoints(saved.picks, body, 'gc').points), 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The rating was not saved.'), 'error')
    } finally {
      setSaving(false)
    }
  }

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
          <DifficultyScalesPicker body={body} picks={picks} scope="gc" readOnly={!canRate} groupName={`gc-${customerId}`} onPick={(key, points) => setPicks((p) => ({ ...p, [key]: points }))} billsLine={() => W.billsLine} />
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
