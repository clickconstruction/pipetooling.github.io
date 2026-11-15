/**
 * GC difficulty rating (punch list #357, PR 4): the Workbench's strip for the lines a bid was priced with. The chip
 * reads *Difficulty · 4 points · +$6,420 in cost* with what that is on the price at the target margin; its fold lists
 * each line with its arithmetic and its sentence, the lines taken off with who and why, who rated and who priced,
 * and the door to the GC's rating. When the GC was rated again since the bid was priced the strip says so, with a
 * press that reads the new rating in. *Take a line off this bid…* opens a small form: the line, the reason, the press
 * named for the line. Read-only when the bid is sent.
 */
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { BID_DIFFICULTY_WORDS as W, bidDifficultyRemovedWords, type BidDifficulty, type BidDifficultyStale } from '../../lib/bids/bidDifficulty'
import { difficultyLineWords, difficultyOnPriceWords, difficultySkippedWords, difficultyStripWords, type DifficultyLines } from '../../lib/bids/difficultyLines'
import { gcDifficultyCardHref, gcDifficultyRatedByWords, type GcDifficultyStanding } from '../../lib/bids/gcDifficultyRating'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.6rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)', cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
const FOLD: CSSProperties = { marginTop: '0.45rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'grid', gap: '0.35rem', fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--text-700)' }
const MUTED: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }
const PRESS: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, height: 34, padding: '0 0.7rem', cursor: 'pointer' }
const INPUT: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', minWidth: 0 }

function savePress(dead: boolean): CSSProperties {
  return { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, height: 34, padding: '0 0.8rem', border: 0, borderRadius: 8, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', cursor: dead ? 'default' : 'pointer' }
}

export type BidDifficultyStripProps = {
  pin: BidDifficulty | null
  standing: GcDifficultyStanding | null
  stale: BidDifficultyStale
  busy: 'writing' | 'reading-in' | 'taking-off' | null
  failed: string | null
  /** The last write's lines, for the scales that priced to nothing. */
  lastWrite: DifficultyLines | null
  /** The Workbench's target margin, for "about +$X on the price". */
  marginPct: number | null
  sent: boolean
  priceVersionWords: string | null
  byName: string
  onReadIn: () => void | Promise<void>
  onTakeOff: (key: string, reason: string) => void | Promise<void>
}

export default function BidDifficultyStrip(p: BidDifficultyStripProps) {
  const [open, setOpen] = useState(false)
  const [takeOffOpen, setTakeOffOpen] = useState(false)
  const [takeKey, setTakeKey] = useState('')
  const [reason, setReason] = useState('')
  const pin = p.pin
  if (p.busy === 'writing') return <div data-testid="bid-difficulty-strip" style={MUTED}>{W.writing}</div>
  if (!pin) {
    if (p.failed) return <div data-testid="bid-difficulty-strip" style={{ ...MUTED, color: 'var(--text-red-700)' }}>{p.failed}</div>
    return null
  }
  const lines = pin.lines
  const onPrice = difficultyOnPriceWords(pin.totalUsd, p.marginPct)
  const picked = lines.find((l) => l.key === takeKey) ?? lines[0] ?? null
  const reasonOk = reason.trim() !== ''
  const canTake = !p.sent && lines.length > 0 && p.busy == null
  return (
    <div data-testid="bid-difficulty-strip" style={{ marginTop: '0.45rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" style={CHIP} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="bid-difficulty-chip" title={W.foldTitle}>
          {difficultyStripWords({ points: pin.points, total: pin.totalUsd })}
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
        {onPrice ? <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>{onPrice}</span> : null}
        {p.stale && !p.sent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-amber-700)' }} data-testid="bid-difficulty-stale">
            <span>{p.stale.words}</span>
            <button type="button" style={QUIET} onClick={() => void p.onReadIn()} disabled={p.busy != null}>
              {p.busy === 'reading-in' ? W.readInBusy : W.readIn}
            </button>
          </span>
        ) : null}
      </div>
      {open ? (
        <div style={FOLD} data-testid="bid-difficulty-fold">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-base)' }}>{W.foldTitle}</span>
            {p.standing ? <span style={MUTED}>{gcDifficultyRatedByWords(p.standing)}</span> : null}
            <span style={MUTED}>{W.pricedBy(pin.pricedByName, pin.pricedAt.slice(0, 10))}{p.priceVersionWords ? ` · ${p.priceVersionWords}` : ''}</span>
            <span style={{ flexGrow: 1 }} />
            {p.standing ? (
              <Link to={gcDifficultyCardHref(p.standing.customerId)} style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {W.openRating}
              </Link>
            ) : null}
          </div>
          {lines.length === 0 ? <span style={MUTED}>{W.nothingLeft}</span> : null}
          {lines.map((l) => (
            <span key={l.key} data-testid={`bid-difficulty-line-${l.key}`}>
              {difficultyLineWords(l)}
            </span>
          ))}
          {p.lastWrite?.skipped.map((s) => (
            <span key={`skip-${s.key}`} style={MUTED}>
              {difficultySkippedWords(s)}
            </span>
          ))}
          {p.lastWrite?.capped ? <span style={MUTED}>{`The lines came to $${Math.round(p.lastWrite.capped.before).toLocaleString('en-US')}; the price list holds them to $${Math.round(p.lastWrite.capped.cap).toLocaleString('en-US')}.`}</span> : null}
          {pin.removed.map((r, i) => (
            <span key={`rm-${i}`} style={{ ...MUTED, textDecoration: 'line-through' }} data-testid="bid-difficulty-removed">
              {bidDifficultyRemovedWords(r)}
            </span>
          ))}
          {p.standing?.rating.note ? <span style={MUTED}>{`${p.standing.rating.ratedByName || 'Rated'}: “${p.standing.rating.note}”`}</span> : null}
          {p.failed ? <span style={{ color: 'var(--text-red-700)' }}>{p.failed}</span> : null}
          {canTake && !takeOffOpen ? (
            <div>
              <button type="button" style={PRESS} onClick={() => { setTakeKey(lines[0]?.key ?? ''); setReason(''); setTakeOffOpen(true) }}>
                {W.takeOff}
              </button>
            </div>
          ) : null}
          {canTake && takeOffOpen && picked ? (
            <div style={{ display: 'grid', gap: '0.4rem', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.75rem' }} data-testid="bid-difficulty-take-off">
              <span style={MUTED}>{W.takeOffLead}</span>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                <span style={MUTED}>{W.takeOffLine}</span>
                <select value={picked.key} onChange={(e) => setTakeKey(e.target.value)} style={INPUT} aria-label={W.takeOffLine}>
                  {lines.map((l) => (
                    <option key={l.key} value={l.key}>
                      {`${l.name} ${l.points} · $${Math.round(l.amount).toLocaleString('en-US')}`}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.2rem' }}>
                <span style={MUTED}>{W.takeOffReason}</span>
                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={W.takeOffReasonPlaceholder} style={INPUT} aria-label={W.takeOffReason} maxLength={300} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  style={savePress(!reasonOk)}
                  disabled={!reasonOk}
                  title={reasonOk ? undefined : W.takeOffNoReason}
                  onClick={() => {
                    void p.onTakeOff(picked.key, reason.trim())
                    setTakeOffOpen(false)
                    setReason('')
                  }}
                >
                  {p.busy === 'taking-off' ? 'Taking it off…' : W.takeOffPress(picked.name)}
                </button>
                <button type="button" style={PRESS} onClick={() => setTakeOffOpen(false)}>
                  {W.notNow}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
