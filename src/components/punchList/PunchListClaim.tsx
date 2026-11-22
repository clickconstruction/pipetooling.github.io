import type { CSSProperties } from 'react'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { STILL_ON_LABEL, claimLines, type CardClaims, type ClaimTone } from '../../lib/todos/punchListClaims'
import { plainSentence } from '../../lib/valuesInPlace'
import type { BoardItem } from '../../lib/todos/todoBoard'

/**
 * What a punch list card says about who is on it (Taunya's ask of 2026-11-21): who is working on it and how long
 * ago that was last fresh, that it is free to pick up and who had it, or that the viewer's own claim has gone
 * quiet, with **Still on it** beside that line. The name and the time are drawn apart from the words (values in
 * place). A card nobody ticked draws nothing.
 *
 * The rules and the words are `lib/todos/punchListClaims.ts`; the page hands in the card's claims and the time.
 */
export function PunchListClaim({
  item,
  claims,
  nowMs,
  onStillOn,
  className,
}: {
  item: Pick<BoardItem, 'number' | 'group'>
  claims: CardClaims | undefined
  nowMs: number
  onStillOn: (item: Pick<BoardItem, 'number' | 'group'>) => void | Promise<void>
  className?: string
}) {
  const lines = claimLines(claims, nowMs)
  if (lines.length === 0) return null
  return (
    <div className={className} data-testid="punch-claim" data-number={item.number} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
      {lines.map((line) => (
        <p key={line.tone} data-tone={line.tone} title={plainSentence(line.text)} style={{ ...lineStyle, ...TONE[line.tone] }}>
          {/* The mark and the words stay on one line together; only Still on it wraps under them on a phone. */}
          <span style={{ display: 'flex', gap: '0.4rem', minWidth: 0, flex: '1 1 auto' }}>
            <span aria-hidden style={{ flexShrink: 0 }}>
              {MARK[line.tone]}
            </span>
            <span style={{ minWidth: 0 }}>
              <ValueSentence text={line.text} />
            </span>
          </span>
          {line.stillOn ? (
            <button
              type="button"
              className="punch-still"
              onClick={() => void onStillOn(item)}
              aria-label={`${STILL_ON_LABEL}, #${item.number}`}
              title="Your claim is fresh again from now, and the card reads as yours to everyone."
              style={stillStyle}
            >
              {STILL_ON_LABEL}
            </button>
          ) : null}
        </p>
      ))}
    </div>
  )
}

const MARK: Record<ClaimTone, string> = { mine: '☑', taken: '●', free: '○', quiet: '◌' }

const lineStyle: CSSProperties = {
  margin: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.15rem 0.4rem',
  fontSize: '0.82rem',
  lineHeight: 1.35,
  borderRadius: 6,
  padding: '0.2rem 0.55rem',
  maxWidth: '100%',
}

const TONE: Record<ClaimTone, CSSProperties> = {
  // Taken by someone else is the line a second person must not miss.
  taken: { color: 'var(--text-amber-900)', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)' },
  mine: { color: 'var(--text-green-800)', background: 'var(--bg-green-100)', border: '1px solid var(--border-green)' },
  free: { color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' },
  quiet: { color: 'var(--text-base)', background: 'var(--surface)', border: '1px dashed var(--border-strong)' },
}

const stillStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  padding: '0.2rem 0.7rem',
  borderRadius: 999,
  border: '1px solid var(--text-strong)',
  background: 'var(--text-strong)',
  color: 'var(--bg-page)',
  cursor: 'pointer',
}
