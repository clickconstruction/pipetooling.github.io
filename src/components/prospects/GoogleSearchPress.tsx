import type { CSSProperties } from 'react'
import type { GoogleAsk } from '../../lib/research/permitPublic'

/**
 * Research (punch list #302): the small Google press beside a name or an address. It opens a
 * Google search for it in a new tab. A link, so it costs nothing and needs no key. With no words
 * it is the round G alone; with words it reads "G  Google the company".
 */
const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  verticalAlign: 'middle',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  borderRadius: 999,
  minHeight: 26,
  fontSize: '0.75rem',
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  lineHeight: 1,
}
const letter: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-800)',
  fontWeight: 800,
  fontSize: '0.6875rem',
}

export function GoogleSearchPress({ ask, words }: { ask: GoogleAsk | null; words?: string }) {
  if (!ask) return null
  return (
    <a
      href={ask.url}
      target="_blank"
      rel="noreferrer"
      aria-label={ask.label}
      title={`${ask.label}, in a new tab`}
      onClick={(e) => e.stopPropagation()}
      style={{ ...base, padding: words ? '0 9px 0 3px' : '0 3px' }}
    >
      <span aria-hidden="true" style={letter}>
        G
      </span>
      {words}
    </a>
  )
}
