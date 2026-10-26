import { QuickfillQuestion } from './QuickfillQuestion'
import type { CSSProperties, ReactNode } from 'react'
import { QuickfillLastMarkedDoor } from './QuickfillLastMarkedDoor'
import { QuickfillMarkPresses } from './QuickfillMarkPresses'
import { QuickfillNextLine } from './QuickfillNextLine'
import type { MarkOutcome } from '../../lib/quickfill/markOutcome'

const bar: CSSProperties = {
  position: 'sticky',
  bottom: 'var(--app-bottom-chrome, 0px)',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '0.5rem',
  padding: '0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom, 0px))',
  background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
  marginTop: '0.75rem',
  zIndex: 5,
}
const btn: CSSProperties = {
  padding: '0.75rem 0.9rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * One section as a screen (punch list #30, PR 3): ‹ · the name · n of N, the section's
 * banner question, the section's own body, and at the thumb Skip and the three presses
 * (punch list #176, change 1): Done · 0 open · next, Worked it · N left · next, Not sure what
 * to do. Note-first sections keep their own mark button inside the body; the bar only moves on.
 * On a desk (punch list #147, v2.5787, `wide`) the same screen is the Roller: no ‹ (the
 * strip's Groups button is the way out), the strip under the name, ← Previous and Next → in
 * the bar beside Skip and Looked.
 */
export function QuickfillRoundScreen({
  label,
  position,
  question,
  sectionId,
  nextLine = null,
  countLine,
  lastLook = null,
  liveCount,
  countLoading = false,
  needsNote,
  personal,
  marking,
  onBack,
  onSkip,
  onPress,
  onHistory,
  onPrev,
  strip,
  wide = false,
  children,
}: {
  label: string
  /** "4 of 20" — null when the section is not in the round. */
  position: { index: number; total: number } | null
  question: string | null
  /** The station the question belongs to (punch list #187 PR 5): with it the question wears its ? and card. */
  sectionId?: string
  /** The Next line (punch list #176, change 2): the first row to act on and its verb, under the question. */
  nextLine?: string | null
  /** The live count, *5 open*; empty when the station has none. */
  countLine: string
  /** *last look 22h ago · Dana* or *never marked* (punch list #156, v2.5826): drawn after the count as a door to the history, plain on a personal door. */
  lastLook?: string | null
  liveCount: number | null
  /** The station's count is still loading (v2.5868): the presses wait instead of offering a Looked with no count. */
  countLoading?: boolean
  needsNote: boolean
  personal: boolean
  marking: boolean
  onBack: () => void
  onSkip: () => void
  /** The press on the bar: Done, Worked it or Not sure, with the words typed under Not sure. */
  onPress: (outcome: MarkOutcome, words: string) => void
  onHistory: () => void
  /** The Roller's ← Previous; null at the top of the deck (the button is drawn disabled). */
  onPrev?: (() => void) | null
  /** The Roller's strip: the dots, the words, the switch and Groups. */
  strip?: ReactNode
  /** The desk layout: no ‹, the strip, Previous and Next in the bar. */
  wide?: boolean
  children: ReactNode
}) {
  const nextLabel = position && position.index < position.total ? 'next →' : 'done ✓'
  return (
    <div className="quickfillRoundScreen">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {wide ? null : (
          <button type="button" onClick={onBack} aria-label="Back to the list" style={{ ...btn, padding: '0.4rem 0.7rem', fontSize: '1.1rem', lineHeight: 1 }}>
            ‹
          </button>
        )}
        <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: wide ? '1.375rem' : '1.0625rem', fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</h2>
        {position && !wide ? (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {position.index} of {position.total}
          </span>
        ) : null}
      </div>
      {strip}
      {question ? (
        sectionId ? (
          <QuickfillQuestion sectionId={sectionId} text={question} phone={!wide} style={{ fontSize: '0.875rem', color: 'var(--text)', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--text-link)', padding: '0.45rem 0.6rem', borderRadius: 4, marginBottom: '0.5rem' }} />
        ) : (
          <div style={{ fontSize: '0.875rem', color: 'var(--text)', background: 'var(--bg-subtle)', borderLeft: '3px solid var(--text-link)', padding: '0.45rem 0.6rem', borderRadius: 4, marginBottom: '0.5rem' }}>{question}</div>
        )
      ) : null}
      {nextLine ? <QuickfillNextLine text={nextLine} /> : null}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        <span>
          {countLine}
          {lastLook ? (
            <>
              {countLine ? ' · ' : null}
              {personal ? lastLook : <QuickfillLastMarkedDoor text={lastLook} stationLabel={label} onOpen={onHistory} />}
            </>
          ) : null}
        </span>
        {!personal ? (
          <button type="button" onClick={onHistory} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}>
            📈 history
          </button>
        ) : null}
      </div>
      <div>{children}</div>
      <div style={{ ...bar, ...(wide ? { gridTemplateColumns: 'auto auto 1fr auto' } : {}) }}>
        {wide ? (
          <button type="button" onClick={onPrev ?? undefined} disabled={!onPrev} style={{ ...btn, opacity: onPrev ? 1 : 0.5 }}>
            ← Previous
          </button>
        ) : null}
        <button type="button" onClick={onSkip} style={btn}>
          Skip
        </button>
        {personal || needsNote ? (
          <button type="button" onClick={onSkip} style={{ ...btn, textAlign: 'center' }} title={needsNote ? 'Mark this one inside, with a note' : undefined}>
            {needsNote ? `Mark inside · ${nextLabel}` : nextLabel}
          </button>
        ) : (
          <QuickfillMarkPresses count={liveCount} loading={countLoading} nextLabel={nextLabel} layout={wide ? 'bar' : 'stack'} marking={marking} stationLabel={label} onPress={onPress} />
        )}
        {wide ? (
          <button type="button" onClick={onSkip} style={btn}>
            {nextLabel === 'done ✓' ? 'Done ✓' : 'Next →'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
