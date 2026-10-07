/**
 * The graffiti (punch list #94, v2.4792): a red, tilted stamp across the money cell of a
 * Collections row the office gave up on — the word, the reason the office typed, the day and
 * the dollars. You cannot read the row without reading why. Light and dark both: the reds
 * are literal status colours (CLAUDE.md), the surfaces are tokens.
 */
import type { UncollectibleFacts } from '../../lib/jobs/uncollectible'
import { uncollectibleStampLine } from '../../lib/jobs/uncollectible'

export function StagesUncollectibleStamp({ facts }: { facts: UncollectibleFacts }) {
  return (
    <div
      data-stages-uncollectible-stamp
      role="note"
      aria-label={`Uncollectible. ${facts.reason} ${uncollectibleStampLine(facts)}`}
      style={{
        position: 'relative',
        margin: '0.6rem 0 0.3rem',
        padding: '0.35rem 0.6rem 0.45rem',
        transform: 'rotate(-3deg)',
        transformOrigin: 'left center',
        border: '3px solid #b91c1c',
        borderRadius: 4,
        color: 'var(--text-red-700)',
        background: 'rgba(254, 226, 226, 0.6)',
        boxShadow: '0 0 0 2px rgba(185, 28, 28, 0.08)',
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          fontFamily: "Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
          fontSize: '1.35rem',
          lineHeight: 1,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '1px 1px 0 rgba(185, 28, 28, 0.25)',
        }}
      >
        Uncollectible
      </div>
      <div
        style={{
          marginTop: '0.25rem',
          fontFamily: "'Marker Felt', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive",
          fontSize: '0.9rem',
          lineHeight: 1.25,
          color: 'var(--text-red-900)',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {facts.reason}
      </div>
      <div style={{ marginTop: '0.15rem', fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-red-800)', textTransform: 'uppercase' }}>
        {uncollectibleStampLine(facts)}
      </div>
    </div>
  )
}
