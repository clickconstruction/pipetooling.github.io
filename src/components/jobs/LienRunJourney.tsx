import { useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { lienRunJourneyFoldWords, lienRunJourneyLine } from '../../lib/jobs/lienPhoneWindows'
import type { LienRunNode } from '../../lib/jobs/lienRunParts'

/**
 * The journey across the top of the run: the run's three steps (get them right, print, mail and record), a count of
 * notices under each, the step the run is on marked (v2.7477, punch list #362). Drawn from `lienRunParts().nodes`, so
 * it counts what the count line, the groups and the one press count. Until v2.7477 it drew the envelope's six stages
 * (`runJourney`), which counted envelopes under a title that counted notices.
 *
 * On a phone (punch list #352, PR 7) the steps are one line, the step the run is on with its count, and a press
 * unfolds them (`.lienRunJourney` in index.css).
 */
export default function LienRunJourney({ nodes }: { nodes: ReadonlyArray<LienRunNode> }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const grid = (
    <div className="lienRunJourney" data-testid="run-journey" role="list" aria-label="Where the run stands">
      {nodes.map((n) => (
        <div key={n.step} className={`lienRunJourneyNode lienRunJourneyNode-${n.state}`} role="listitem" data-testid={`run-journey-${n.step}`} data-state={n.state} aria-current={n.state === 'now' ? 'step' : undefined}>
          <div className="lienRunJourneyDot" aria-hidden="true">{n.state === 'done' ? '✓' : n.step}</div>
          <div style={{ minWidth: 0 }}>
            <b>{n.label}</b>
            <span className="lienRunJourneyCount">{n.count}</span>
          </div>
        </div>
      ))}
    </div>
  )
  if (!isMobile) return grid
  const line = lienRunJourneyLine(nodes)
  return (
    <div data-testid="run-journey-phone" style={{ flex: 'none', minWidth: 0 }}>
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
