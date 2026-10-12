import type { RunJourney } from '../../lib/jobs/runJourney'

/**
 * The journey across the top of the run (Run-2, `docs/DOCSMIT_LIEN_RUN_PLAN.md` → *The run, shown
 * not told*): six nodes, a count under each, the blocker drawn on the node it blocks, the fill as
 * far as every envelope has come. Drawn from `runJourney()`, so it says what the cards say. On a
 * phone it wraps to two rows of three (`.lienRunJourney` in index.css).
 */
export default function LienRunJourney({ journey }: { journey: RunJourney }) {
  const { nodes, fillRatio } = journey
  return (
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
}
