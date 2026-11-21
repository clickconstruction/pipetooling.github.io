/**
 * The Schedule look on a line of time (punch list #382, PR 11): one row a stage ahead. A bar for our days in the
 * stage's colour, a diamond on the day they say ready, a hollow diamond on a day they gave before, a dotted line on
 * the day we decide, a red line on today, and the days they moved in red under the row's marks. Each row is one
 * picture with its sentence as its name, so a reader that cannot see the line hears the same facts. The places are
 * `timeLine`'s shares of the span; the looks are the `scLine*` rules in `index.css`, which also put a row's name over
 * its track on a phone so the whole span fits with no sideways scroll.
 *
 * The moved words sit on a line of their own under the marks, anchored on the day they say now and slid back by that
 * same share of their own width (`movedSlide`). So they stay inside the track at every width and wherever the row's
 * marks fall. Written beside the marks they ran off the left of a phone on a row that spans the line, and
 * *moved 32 days* read *2 days*.
 */
import { TIME_LINE_WORDS as W, movedSlide, type TimeLine } from '../../lib/startChecks/timeLine'

export function ScheduleTimeLine({ line }: { line: TimeLine }) {
  return (
    <div data-schedule-time-line className="scLine">
      {/* The week marks, over the track's own column. */}
      <div className="scLineRow" data-line-head>
        <span />
        <div aria-hidden className="scLineTicks">
          {line.ticks.map((t) => (
            <span key={t.at} className="scLineTick" style={{ left: `${t.at}%`, transform: t.at > 92 ? 'translateX(-100%)' : undefined }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      {line.rows.map((r) => (
        <div key={r.id} className="scLineRow" data-time-line-row={r.id} data-light={r.light}>
          <div className="scLineName">
            <span>{r.name}</span>
            {r.job ? <span>{r.job}</span> : null}
          </div>
          <div role="img" aria-label={r.words} className="scLineTrack" data-moved={r.movedAt != null ? '' : undefined}>
            {line.today != null ? <span className="scLineToday" style={{ left: `${line.today}%` }} /> : null}
            {r.bar ? <span className="scLineBar" data-light={r.light} style={{ left: `${r.bar.from}%`, width: `${Math.max(0.8, r.bar.to - r.bar.from)}%` }} /> : null}
            {r.decide != null ? <span className="scLineDecide" style={{ left: `${r.decide}%` }} /> : null}
            {r.before.map((at, i) => (
              <span key={i} className="scLineDay" data-before style={{ left: `${at}%` }} />
            ))}
            {r.said != null ? <span className="scLineDay" style={{ left: `${r.said}%` }} /> : null}
            {/* The days they moved, in red, on their own line under the marks: never over one, never off the row. */}
            {r.movedAt != null ? (
              <span className="scLineMoved" data-time-line-moved="" style={movedSlide(r.movedAt)}>
                {W.moved(r.moved)}
              </span>
            ) : null}
          </div>
        </div>
      ))}
      <div aria-hidden className="scLineLegend">
        <span>
          <i className="scLineBar" data-light="green" /> {W.legend[0]}
        </span>
        <span>
          <i className="scLineDay" /> {W.legend[1]}
        </span>
        <span>
          <i className="scLineDay" data-before /> {W.legend[2]}
        </span>
        <span>
          <i className="scLineDecide" /> {W.legend[3]}
        </span>
        <span>
          <i className="scLineToday" /> {W.legend[4]}
        </span>
      </div>
    </div>
  )
}

export default ScheduleTimeLine
