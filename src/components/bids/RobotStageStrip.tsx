import { useState } from 'react'
import { ROBOT_STAGE_STOPS, ROBOT_STAGE_WORDS, type RobotStage } from '../../lib/bids/robotStage'
import { ROBOT_ICON_PATH } from './RobotGlyph'

/**
 * The stage: where a bid stands with the robots, in seven stops (punch list #221, PR 4). Two faces of one
 * kernel (`buildRobotStage`): `inline`, the Counts head's one-line pill that unfolds to the stops, in the bid
 * flow strip's shape; `full`, the stops in a row at the top of the Robot status sheet with the lit stop's
 * sentence under them. The ring on the icon keeps its own seven segments: those are the robot's run; these
 * stops are the bid's standing, her steps included.
 */
export type RobotStageStripProps = {
  stage: RobotStage
  variant: 'inline' | 'full'
  /** inline: unfolded or not; the tab remembers it with the bid flow's fold. */
  expanded?: boolean
  onToggleExpanded?: () => void
  /** The door on the lit stop when fixtures are ready: the window. */
  onOpenFixtures?: (() => void) | null
  /**
   * inline only: the pill toggles and the parent draws the stops (the `full` face) on a row of their own, so an
   * unfolded panel never hangs off a pill that sits at the right end of a head (v2.6237: it ran off the window).
   */
  detached?: boolean
}

const DONE = '#16a34a'
const NOW = '#2563eb'


function Stops({ stage, dense }: { stage: RobotStage; dense: boolean }) {
  return (
    <ol aria-label="The robot's stops on this bid" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: dense ? `repeat(${ROBOT_STAGE_STOPS.length}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(72px, 1fr))', gap: dense ? 4 : 6 }}>
      {stage.stops.map((s) => (
        <li key={s.key} data-testid={`robot-stage-${s.key}`} data-state={s.state} title={s.detail ? `${s.label}, ${s.detail}` : s.label} style={{ minWidth: 0 }}>
          <div style={{ height: 3, borderRadius: 2, background: s.state === 'done' ? DONE : s.state === 'now' ? NOW : 'var(--border)', marginBottom: 4 }} />
          <div style={{ fontSize: dense ? '0.66rem' : '0.72rem', fontWeight: s.state === 'now' ? 700 : 600, color: s.state === 'todo' ? 'var(--text-muted)' : 'var(--text-strong)', lineHeight: 1.2, ...(dense ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}>{s.label}</div>
          {s.detail && !dense ? <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{s.detail}</div> : null}
        </li>
      ))}
    </ol>
  )
}

export function RobotStageStrip({ stage, variant, expanded = false, onToggleExpanded, onOpenFixtures = null, detached = false }: RobotStageStripProps) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = onToggleExpanded ? expanded : localOpen
  const toggle = onToggleExpanded ?? (() => setLocalOpen((v) => !v))
  const lit = stage.lit ? stage.stops.find((s) => s.key === stage.lit) ?? null : null
  const chip = stage.assisted ? (
    <span data-testid="robot-stage-assisted" title="You took robot fixtures on this bid. Its run keeps its score but sits beside the practice runs, out of the gate." style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderRadius: 999, padding: '0 6px', border: '1px solid var(--border-violet)', color: 'var(--text-violet-800)', background: 'var(--bg-violet-100)' }}>
      assisted
    </span>
  ) : null

  if (variant === 'full') {
    return (
      <div data-testid="robot-stage-strip" style={{ display: 'grid', gap: 6, margin: '0 0 0.9rem' }}>
        <Stops stage={stage} dense={false} />
        <p data-testid="robot-stage-sentence" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-700)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{stage.sentence}</span>
          {chip}
          {lit?.key === 'sent' && stage.fixturesOpen && onOpenFixtures ? (
            <button type="button" onClick={onOpenFixtures} style={{ font: 'inherit', fontSize: '0.84rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}>
              {stage.fixturesTaken > 0 ? 'Open the list' : 'Review them'}
            </button>
          ) : null}
        </p>
      </div>
    )
  }

  return (
    <div data-testid="robot-stage-inline" style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, minWidth: 0, maxWidth: '100%' }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        title={stage.sentence}
        style={{ font: 'inherit', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: 999, border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', cursor: 'pointer', maxWidth: '100%' }}
      >
        <svg viewBox="0 0 640 512" width={13} height={13} aria-hidden style={{ fill: 'currentColor', flex: '0 0 auto' }}><path d={ROBOT_ICON_PATH} /></svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.inline}</span>
        {chip}
        <span aria-hidden style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && !detached ? (
        <div style={{ padding: '0.5rem 0.6rem 0.4rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', minWidth: 'min(520px, 90vw)' }}>
          <Stops stage={stage} dense />
          <p data-testid="robot-stage-sentence" style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-700)' }}>
            {stage.sentence}
            {lit?.key === 'sent' && stage.fixturesOpen && onOpenFixtures ? (
              <>
                {' '}
                <button type="button" onClick={onOpenFixtures} style={{ font: 'inherit', fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0 }}>
                  {stage.fixturesTaken > 0 ? 'Open the list' : 'Review them'}
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export { ROBOT_STAGE_WORDS }
