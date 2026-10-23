/**
 * The graffiti (punch list #94, v2.4792): a red, tilted stamp across the money cell of a
 * Collections row the office gave up on — the word, the reason the office typed, the day and
 * the dollars. You cannot read the row without reading why. Light and dark both: the classes
 * live in index.css next to `tr[data-stages-row-stamped]`, with a dark override (punch list
 * #145) — the reds are literal status colours (CLAUDE.md), the surfaces are tokens.
 */
import type { UncollectibleFacts } from '../../lib/jobs/uncollectible'
import { uncollectibleStampLine, uncollectibleStampLines } from '../../lib/jobs/uncollectible'

export function StagesUncollectibleStamp({ facts }: { facts: UncollectibleFacts }) {
  return (
    <div data-stages-uncollectible-stamp className="stagesUncollectibleStamp" role="note" aria-label={`Uncollectible. ${facts.reason} ${uncollectibleStampLine(facts)}`}>
      <div className="stagesUncollectibleStampWord">Uncollectible</div>
      <div className="stagesUncollectibleStampReason">{facts.reason}</div>
      {/* v2.4819: the day on one line, the dollars on the next. */}
      <div className="stagesUncollectibleStampFacts">
        <div>{uncollectibleStampLines(facts).day}</div>
        <div>{uncollectibleStampLines(facts).dollars}</div>
      </div>
    </div>
  )
}
