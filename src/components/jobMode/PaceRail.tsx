import type { CSSProperties } from 'react'
import { PACE_CARD_WORDS, type PaceRail as PaceRailRows } from '../../lib/jobMode/paceCard'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { FINISH_CALL_WORDS } from '../../lib/jobMode/finishCall'

/**
 * The pace card's rail (punch list #396): the job's stages top to bottom, done, now and next, ending in the
 * finish day. It is the same form as the day's rail on the Job Mode card's top, a circle a row with a tick
 * when done, so a superintendent has nothing new to learn. The stage in hand carries the press that opens
 * **Set the %**, the window that already takes a number for each stage.
 *
 * Presentational: `paceCard.ts` works out the rows and the days.
 */

const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minHeight: 40, position: 'relative' }
const DOT: CSSProperties = { width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', position: 'relative', zIndex: 1, boxSizing: 'border-box', fontSize: '0.75rem', lineHeight: 1 }
const LINK: CSSProperties = { position: 'absolute', left: 10, top: 31, bottom: -9, width: 2, background: 'var(--border-strong)' }
const SIDE: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const BLUE = '#2563eb'

export function PaceRail({ rail, finish, said, onSetPct, checks }: {
  rail: PaceRailRows
  finish: { planned: string | null; atPace: { words: string; tone: 'ahead' | 'behind' } | null }
  /** His own finish day and what is in the way (My finish date, PR 3), once he has said one. */
  said?: { day: string; why: string | null } | null
  onSetPct: () => void
  /**
   * Each row's checklist, in the rail's order (punch list #397, PR 5): a stage with questions is a press that
   * opens its checklist and says how many are answered. Null for a stage with none, which stays words.
   */
  checks?: ReadonlyArray<{ words: string; ready: boolean; onOpen: () => void } | null>
}) {
  const feet = (finish.planned ? 1 : 0) + (said ? 1 : 0) + (finish.atPace ? 1 : 0)
  return (
    <div data-testid="pace-rail" data-from={rail.from} style={{ display: 'grid' }}>
      {rail.rows.map((row, i) => {
        const last = i === rail.rows.length - 1 && feet === 0
        return (
          <div key={`${row.name}-${i}`} data-testid="pace-rail-stage" data-state={row.state} style={ROW}>
            {last ? null : <span aria-hidden="true" style={LINK} />}
            <span aria-hidden="true" style={row.state === 'done' ? { ...DOT, background: BLUE, borderColor: BLUE, color: '#fff' } : row.state === 'now' ? { ...DOT, borderColor: BLUE } : DOT}>
              {row.state === 'done' ? '✓' : row.state === 'now' ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE }} /> : null}
            </span>
            {checks?.[i] ? (
              <button
                type="button"
                data-testid="pace-rail-check"
                onClick={checks[i]!.onOpen}
                style={{ minWidth: 0, minHeight: PHONE_PRESS_MIN_HEIGHT, padding: 0, border: 'none', background: 'none', textAlign: 'left', font: 'inherit', fontSize: '0.95rem', fontWeight: row.state === 'now' ? 700 : 500, color: row.state === 'next' ? 'var(--text-muted)' : 'var(--text-base)', overflowWrap: 'anywhere', cursor: 'pointer' }}
              >
                {row.name}
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{row.state === 'done' ? ', done' : row.state === 'now' ? ', in hand' : ', not started'}. Checklist, </span>
                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, color: checks[i]!.ready ? 'var(--text-green-700)' : 'var(--text-link)' }}>{checks[i]!.words} ›</span>
              </button>
            ) : (
              <span style={{ minWidth: 0, fontSize: '0.95rem', fontWeight: row.state === 'now' ? 700 : 500, color: row.state === 'next' ? 'var(--text-muted)' : 'var(--text)', overflowWrap: 'anywhere' }}>
                {row.name}
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{row.state === 'done' ? ', done' : row.state === 'now' ? ', in hand' : ', not started'}</span>
              </span>
            )}
            {row.state === 'now' ? (
              <button type="button" data-testid="pace-rail-set-pct" onClick={onSetPct} style={{ minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.75rem', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {row.pct > 0 ? `${row.pct}% · ` : ''}{PACE_CARD_WORDS.setPct}
              </button>
            ) : row.state === 'next' && row.pct > 0 ? (
              <span style={SIDE}>{row.pct}%</span>
            ) : (
              <span />
            )}
          </div>
        )
      })}
      {finish.planned ? (
        <div data-testid="pace-rail-finish" style={ROW}>
          {finish.atPace || said ? <span aria-hidden="true" style={LINK} /> : null}
          <span aria-hidden="true" style={{ ...DOT, borderColor: 'var(--text-green-700)', color: 'var(--text-green-700)' }}>⚑</span>
          <span style={{ minWidth: 0, fontSize: '0.95rem', fontWeight: 600, color: finish.atPace?.tone === 'behind' ? 'var(--text-muted)' : 'var(--text-green-700)' }}>{PACE_CARD_WORDS.finish}</span>
          <span style={{ ...SIDE, fontSize: '0.9rem', fontWeight: 600, color: finish.atPace?.tone === 'behind' ? 'var(--text-muted)' : 'var(--text-green-700)' }}>{finish.planned}</span>
        </div>
      ) : null}
      {said ? (
        <div data-testid="pace-rail-said" style={ROW}>
          {finish.atPace ? <span aria-hidden="true" style={LINK} /> : null}
          <span aria-hidden="true" style={{ ...DOT, borderColor: BLUE, color: BLUE }}>✎</span>
          <span style={{ minWidth: 0, fontSize: '0.95rem', fontWeight: 600, overflowWrap: 'anywhere' }}>
            {FINISH_CALL_WORDS.said}
            {said.why ? <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>{said.why}</span> : null}
          </span>
          <span style={{ ...SIDE, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{said.day}</span>
        </div>
      ) : null}
      {finish.atPace ? (
        <div data-testid="pace-rail-at-pace" data-tone={finish.atPace.tone} style={ROW}>
          <span aria-hidden="true" style={{ ...DOT, borderColor: finish.atPace.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-green-700)', color: finish.atPace.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>⚑</span>
          <span style={{ minWidth: 0, fontSize: '0.95rem', fontWeight: 700, color: finish.atPace.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{PACE_CARD_WORDS.atPace}</span>
          <span style={{ ...SIDE, fontSize: '0.9rem', fontWeight: 700, color: finish.atPace.tone === 'behind' ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{finish.atPace.words}</span>
        </div>
      ) : null}
    </div>
  )
}

/** One thin bar: the hours used against the budget, or the work done when the job has no stages to list. */
export function PaceBar({ label, words, fillPct, color, testId, thin = false }: { label?: string; words?: string; fillPct: number; color: string; testId: string; thin?: boolean }) {
  return (
    <span data-testid={testId} style={{ display: 'grid', gridTemplateColumns: `${label ? '3.2rem ' : ''}minmax(0, 1fr)${words ? ' auto' : ''}`, gap: 8, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
      {label ? <span>{label}</span> : null}
      <span style={{ display: 'block', height: thin ? 6 : 10, borderRadius: 5, background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, fillPct))}%`, borderRadius: 5, background: color }} />
      </span>
      {words ? <span style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}>{words}</span> : null}
    </span>
  )
}

export default PaceRail
