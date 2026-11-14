import { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { lienRunJourneyFoldWords, lienRunJourneyLine } from '../../lib/jobs/lienPhoneWindows'
import type { RunJourney } from '../../lib/jobs/runJourney'

/**
 * The journey across the top of the run (Run-2, `docs/DOCSMIT_LIEN_RUN_PLAN.md` → *The run, shown
 * not told*): six nodes, a count under each, the blocker drawn on the node it blocks, the fill as
 * far as every envelope has come. Drawn from `runJourney()`, so it says what the cards say.
 *
 * On a phone (punch list #352, PR 7) the six nodes are one line, the step the run stands on with
 * its count, and a press unfolds them in two rows of three (`.lienRunJourney` in index.css): the
 * two rows were 175 px of a window whose list had 266.
 */
export default function LienRunJourney({ journey }: { journey: RunJourney }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const { nodes, fillRatio } = journey
  const grid = (
    <div className="lienRunJourney" data-testid="run-journey" role="list" aria-label="Where the run stands">
      <div className="lienRunJourneyFill" style={{ width: `${Math.round(fillRatio * 100 * 100) / 100}%` }} aria-hidden="true" />
      {nodes.map((n, i) => (
        <div key={n.key} className={`lienRunJourneyNode lienRunJourneyNode-${n.state}`} role="listitem" data-testid={`run-journey-${n.key}`} data-state={n.state}>
          <div className="lienRunJourneyDot" aria-hidden="true">{n.done ? '✓' : i + 1}</div>
          <b>{n.label}</b>
          <span className={`lienRunJourneyCount${n.note ? ' lienRunJourneyWarn' : ''}`}>{n.note ? `${n.count} · ${n.note}` : n.count}</span>
        </div>
      ))}
    </div>
  )
  if (!isMobile) return grid
  const line = lienRunJourneyLine(journey)
  return (
    <div data-testid="run-journey-phone" style={{ alignSelf: 'start', minWidth: 0 }}>
      <button
        type="button"
        data-testid="run-journey-line"
        data-warn={line.warn ? 'yes' : 'no'}
        aria-expanded={open}
        title={lienRunJourneyFoldWords(open)}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '4px 1.25rem', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-base)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <b data-testid="run-journey-line-head" style={{ display: 'block', fontSize: '0.875rem' }}>{line.head}</b>
          {line.count ? <span data-testid="run-journey-line-count" className={line.warn ? 'lienRunJourneyWarn' : undefined} style={{ display: 'block', fontSize: '0.8125rem', color: line.warn ? undefined : 'var(--text-muted)' }}>{line.count}</span> : null}
        </span>
        <span aria-hidden="true" style={{ flex: 'none', color: 'var(--text-muted)' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open ? grid : null}
    </div>
  )
}
