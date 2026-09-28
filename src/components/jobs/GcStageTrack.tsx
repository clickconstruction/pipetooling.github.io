import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { gcStageStopLabel, type GcStageKey, type GcStageTrack as GcStageTrackModel } from '../../lib/jobs/gcReviewStages'

type Props = {
  track: GcStageTrackModel
  /** The stage the list is narrowed to; null = every GC. */
  stage: GcStageKey | null
  /** Pick a stage, or the one already picked to clear it. */
  onPick: (stage: GcStageKey | null) => void
}

/**
 * Where the week stands (GC Review): Check → Send → Word → Done, pinned over
 * the list. Each stop says how many GCs are waiting there and how far along
 * the step is; the pin sits on the first stage with work left and moves on by
 * itself. A stop is also the filter — press it to see the GCs waiting there.
 * Presentational: the track comes from buildGcStageTrack. Styles: `.gcStage*`.
 */
export default function GcStageTrack({ track, stage, onPick }: Props) {
  const { finished } = track
  const weekDone = track.here === 'done' && finished.of > 0
  const pct = finished.of > 0 ? Math.round(((finished.done + finished.skipped) / finished.of) * 100) : 0
  return (
    <div className="gcStageTrack" role="group" aria-label="Where this week stands">
      {track.stops.map((s) => {
        const here = track.here === s.key
        const label = gcStageStopLabel(s)
        // The count is drawn as a number and its words, so a narrow window can keep the number alone.
        const words = s.complete ? label : s.waiting === 0 ? 'waiting' : label.replace(/^\d+\s*/, '')
        return (
          <span key={s.key} className="gcStageLeg">
            <button
              type="button"
              className="gcStageStop"
              data-here={here ? 'yes' : undefined}
              data-complete={s.complete ? 'yes' : undefined}
              data-idle={!s.complete && s.waiting === 0 ? 'yes' : undefined}
              aria-pressed={stage === s.key}
              aria-label={`${s.name}: ${label}, ${s.done} of ${s.of} done${here ? ' — you are here' : ''}`}
              title={s.waiting > 0 ? `Show the ${s.waiting} GC${s.waiting === 1 ? '' : 's'} waiting here — $${formatCurrency(s.waitingTotal)}` : label}
              onClick={() => onPick(stage === s.key ? null : s.key)}
            >
              {here ? <span className="gcStagePin">You are here</span> : null}
              <span className="gcStageStopHead">
                <span className="gcStageNode" aria-hidden>
                  {s.complete ? '✓' : s.n}
                </span>
                <b>{s.name}</b>
              </span>
              <span className="gcStageCount">
                <span className="gcStageCountN">{s.complete ? '✓' : s.waiting}</span>
                <span className="gcStageCountWords"> {words}</span>
              </span>
              <span className="gcStageProgress">
                <span className="gcStageBar" aria-hidden>
                  <i style={{ width: `${s.of > 0 ? Math.round((s.done / s.of) * 100) : 0}%` }} />
                </span>
                <span className="gcStageFraction">
                  {s.done}/{s.of}
                </span>
              </span>
            </button>
            <span className="gcStageLink" data-complete={s.complete ? 'yes' : undefined} aria-hidden />
          </span>
        )
      })}
      <button
        type="button"
        className="gcStageStop gcStageFinish"
        data-here={weekDone ? 'yes' : undefined}
        data-complete={weekDone ? 'yes' : undefined}
        aria-pressed={stage === 'done'}
        aria-label={`Done: ${finished.done} of ${finished.of}${finished.skipped > 0 ? `, ${finished.skipped} skipped` : ''}`}
        title="Show the GCs that are finished for the week"
        onClick={() => onPick(stage === 'done' ? null : 'done')}
      >
        {weekDone ? <span className="gcStagePin">Week done</span> : null}
        <span className="gcStageRing" style={{ background: `conic-gradient(var(--text-green-600) ${pct}%, var(--border) 0)` }} aria-hidden>
          <span>{finished.done}</span>
        </span>
        <span className="gcStageFinishWords">
          <b>Done</b>
          <span>
            of {finished.of} · due Wed{finished.skipped > 0 ? ` · ${finished.skipped} skipped` : ''}
          </span>
        </span>
      </button>
    </div>
  )
}
