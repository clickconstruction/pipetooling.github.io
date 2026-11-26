import { useMemo, useState, type CSSProperties } from 'react'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import JobFormAddressSameSpot from './JobFormAddressSameSpot'
import type { MapPoint } from '../../lib/addresses/lookAlikes'
import {
  CLOSE_ON_FILE_WORDS,
  closeOnFile,
  closeOnFileFoot,
  onFileCountWords,
  onFileEntry,
  onFileSentence,
  type AddressOnFile,
} from '../../lib/addresses/addressesOnFile'

const press: CSSProperties = {
  minHeight: 44,
  padding: '0 0.9rem',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const label: CSSProperties = { color: 'var(--text-muted)' }
const mark = (tone: 'typed' | 'onFile'): CSSProperties => ({
  background: tone === 'typed' ? 'var(--bg-amber-200)' : 'var(--bg-green-200)',
  borderRadius: 3,
  padding: '0 2px',
})

/**
 * Under the Job Address box (punch list #439, piece 1), one of three things, or nothing:
 *
 * - the address is one the company already has: a quiet line says how many jobs and bids are there;
 * - the address is a slip away from one on file, and the person has left the box: the form asks once, with the
 *   two spellings side by side and the differing words marked. **Use the one on file** rewrites the field.
 *   **Keep mine** settles it for that address until it is typed again;
 * - the address is written differently from one on file at the same spot on the map: the form asks whether it is
 *   the same place (`JobFormAddressSameSpot`, piece 2's last part), once the map has a point for it.
 *
 * Advice, never a gate: nothing here blocks a save. While the box has the focus it stays quiet about a slip, so
 * it never moves the form under someone who is still typing.
 */
export default function JobFormAddressOnFile({
  address,
  list,
  focused,
  point = null,
  onUse,
}: {
  address: string
  list: ReadonlyArray<AddressOnFile>
  /** The typed address's own map point, once the map has one. Without it the form never asks about a place. */
  point?: MapPoint | null
  /** True while the address box has the focus. */
  focused: boolean
  onUse: (address: string) => void
}) {
  const [keptFor, setKeptFor] = useState<string | null>(null)
  const entry = useMemo(() => onFileEntry(list, address), [list, address])
  const close = useMemo(() => (entry ? null : closeOnFile(list, address)), [entry, list, address])
  const settled = keptFor === address
  // Keep mine on a slip settles that address: the form does not ask about the same one again as a place.
  const slipKey = close && settled ? close.entry.key : null
  const skipKeys = useMemo(() => (slipKey ? new Set([slipKey]) : undefined), [slipKey])

  if (entry) {
    return (
      <div data-testid="job-address-on-file-line" style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 6, fontSize: '0.75rem', color: 'var(--text-green-700)' }}>
        <span aria-hidden>✓</span>
        <span>
          <ValueSentence text={onFileSentence(entry)} />
        </span>
      </div>
    )
  }
  if (!close || settled) return <JobFormAddressSameSpot address={address} list={list} point={point} focused={focused} skipKeys={skipKeys} onUse={onUse} />
  if (focused) return null
  return (
    <div
      role="group"
      aria-label={CLOSE_ON_FILE_WORDS.title}
      data-testid="job-address-close-on-file"
      style={{
        marginTop: 6,
        padding: '0.6rem 0.7rem',
        border: '1px solid var(--border-amber)',
        borderRadius: 8,
        background: 'var(--bg-amber-tint)',
        display: 'grid',
        gap: '0.5rem',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-amber-900)' }}>{CLOSE_ON_FILE_WORDS.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: '0.6rem', rowGap: '0.2rem' }}>
        <span style={label}>{CLOSE_ON_FILE_WORDS.typed}</span>
        <span data-testid="job-address-close-typed">
          {close.typed.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' ' : ''}
              {w.differs ? <span style={mark('typed')}>{w.text}</span> : w.text}
            </span>
          ))}
        </span>
        <span style={label}>{CLOSE_ON_FILE_WORDS.onFile}</span>
        <span data-testid="job-address-close-on-file-words">
          {close.onFile.map((w, i) => (
            <span key={i}>
              {i > 0 ? ' ' : ''}
              {w.differs ? <span style={mark('onFile')}>{w.text}</span> : w.text}
            </span>
          ))}
          <span style={label}> · {onFileCountWords(close.entry)}</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" onClick={() => onUse(close.entry.address)} style={{ ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}>
          {CLOSE_ON_FILE_WORDS.use}
        </button>
        <button type="button" onClick={() => setKeptFor(address)} style={{ ...press, background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid var(--border-strong)' }}>
          {CLOSE_ON_FILE_WORDS.keep}
        </button>
      </div>
      <div style={label}>{closeOnFileFoot(close.entry)}</div>
    </div>
  )
}
