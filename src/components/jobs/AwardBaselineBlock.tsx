import type { CSSProperties } from 'react'
import { awardPressWords, type AwardBaselineOption, type AwardBaselineSource } from '../../lib/jobs/awardBaseline'

/**
 * Hours baseline at award (punch list #234, PR 1a): the block on New Job when the job reads as a
 * project. Three sources in the order they are tried — the bid's Labor rows, the book's assumed
 * hours, a typed figure — the first usable one picked, the dead ones saying what would make them
 * usable, and one line naming what Create Job will freeze. Nothing is written until the job is;
 * the press is the form's own Create Job.
 */
type Props = {
  options: readonly AwardBaselineOption[]
  pick: AwardBaselineSource
  onPick: (source: AwardBaselineSource) => void
  typedHours: string
  onTypedHours: (v: string) => void
  note: string
  onNote: (v: string) => void
  /** The bid's breakdown or the book is still loading. */
  loading: boolean
}

const wrap: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.45rem', background: 'var(--surface)', marginTop: '0.5rem' }
const head: CSSProperties = { fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const opt = (on: boolean, dead: boolean): CSSProperties => ({
  display: 'flex',
  gap: '0.6rem',
  alignItems: 'flex-start',
  border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`,
  borderRadius: 8,
  padding: '0.5rem 0.65rem',
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  opacity: dead ? 0.6 : 1,
  cursor: dead ? 'default' : 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  width: '100%',
})
const radio = (on: boolean): CSSProperties => ({ width: 16, height: 16, borderRadius: 8, border: `2px solid ${on ? '#2563eb' : 'var(--border-strong)'}`, background: on ? 'radial-gradient(#2563eb 45%, transparent 50%)' : 'transparent', flex: 'none', marginTop: 2 })
const input: CSSProperties = { width: 84, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.25rem 0.4rem', font: 'inherit', fontSize: '0.85rem', background: 'var(--surface)', color: 'inherit' }

export function AwardBaselineBlock({ options, pick, onPick, typedHours, onTypedHours, note, onNote, loading }: Props) {
  return (
    <div style={wrap} data-testid="award-baseline-block" role="radiogroup" aria-label="Hours baseline at award">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={head}>Hours baseline at award</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>A project leaves award with one number and its source. Create Job freezes it; Refresh from bid later never moves the frozen one.</span>
      </div>
      {options.map((o) => {
        const on = pick === o.source
        const typed = o.source === 'typed'
        const dead = !o.usable && !typed
        return (
          <button key={o.source} type="button" role="radio" aria-checked={on} disabled={dead} onClick={() => (dead ? undefined : onPick(o.source))} style={opt(on, dead)} data-testid={`award-option-${o.source}`}>
            <span style={radio(on)} aria-hidden />
            <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>
                {o.glyph} {o.head}
                {typed ? (
                  <>
                    {' '}
                    <input type="number" min={0} step={1} inputMode="decimal" value={typedHours} aria-label="Typed hours baseline" placeholder="hours" onClick={(e) => e.stopPropagation()} onFocus={() => onPick('typed')} onChange={(e) => onTypedHours(e.target.value)} style={input} data-testid="award-typed-hours" /> h
                  </>
                ) : null}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>{o.why}</span>
              {typed && on ? (
                <input type="text" value={note} aria-label="Why this figure" placeholder="Why this figure, in a few words (optional)" maxLength={240} onClick={(e) => e.stopPropagation()} onChange={(e) => onNote(e.target.value)} style={{ ...input, width: '100%', maxWidth: 420, marginTop: 4 }} data-testid="award-typed-note" />
              ) : null}
            </span>
          </button>
        )
      })}
      <div style={{ fontSize: '0.78rem', fontWeight: 600 }} data-testid="award-frozen-line">
        {loading ? 'Reading the bid and the book…' : awardPressWords(options, pick).endsWith('no baseline yet') ? <>Create Job freezes nothing yet<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>. Type hours above, or the Quickfill deck line catches the project later.</span></> : awardPressWords(options, pick, 'Create Job freezes').replace(' · ', ' ')}
      </div>
    </div>
  )
}

export default AwardBaselineBlock
