import { useState, type CSSProperties } from 'react'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { useOptionalAuth } from '../../hooks/useAuth'
import { useSameSpotOnFile } from '../../hooks/useSameSpotOnFile'
import { CLOSE_ON_FILE_WORDS, markedWords, type AddressOnFile } from '../../lib/addresses/addressesOnFile'
import type { MapPoint } from '../../lib/addresses/lookAlikes'
import { SAME_SPOT_WORDS, mayAnswerPlace, samePlaceSentence, sameSpotSentence } from '../../lib/addresses/sameSpotOnFile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

const press: CSSProperties = {
  minHeight: 44,
  padding: '0 0.9rem',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 700,
  cursor: 'pointer',
}
const quiet: CSSProperties = { ...press, background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid var(--border-strong)' }
const dead: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: `1px solid ${DEAD_PRESS_FILL}`, cursor: 'default' }
const label: CSSProperties = { color: 'var(--text-muted)' }
const mark = (tone: 'typed' | 'onFile'): CSSProperties => ({
  background: tone === 'typed' ? 'var(--bg-amber-200)' : 'var(--bg-green-200)',
  borderRadius: 3,
  padding: '0 2px',
})

/**
 * Under the Job Address box (punch list #439, piece 2, its last part): the typed address is not on file, and the
 * map puts it at the same spot as one that is. Words cannot say whether that is one place, so the form asks once:
 * **Same place, use that spelling** rewrites the field, **Same place, keep mine** and **Not the same** keep the
 * answer where the list of look-alikes keeps its own, so the pair is not asked again. After **keep mine** a quiet
 * line names the place it is kept with.
 *
 * Advice, never a gate: nothing here blocks a save, and it stays quiet while the box has the focus. It asks only
 * the office, whose answer the table keeps.
 */
export default function JobFormAddressSameSpot({
  address,
  list,
  point,
  focused,
  skipKeys,
  onUse,
}: {
  address: string
  list: ReadonlyArray<AddressOnFile>
  /** The typed address's own map point, once the map has one. */
  point: MapPoint | null
  focused: boolean
  /** Cleaned keys the form already asked about another way. */
  skipKeys?: ReadonlySet<string>
  onUse: (address: string) => void
}) {
  const role = useOptionalAuth()?.role ?? null
  const { asks, joined, answer } = useSameSpotOnFile({ address, list, point, enabled: mayAnswerPlace(role), skipKeys })
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const ask = asks[0]
  if (ask && !focused) {
    const keep = async (same: boolean) => {
      if (busy) return
      setBusy(true)
      setProblem(null)
      const reason = await answer(ask.entry, same)
      setBusy(false)
      if (reason) setProblem(reason)
    }
    return (
      <div
        role="group"
        aria-label={SAME_SPOT_WORDS.title}
        data-testid="job-address-same-spot"
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
        <div style={{ fontWeight: 700, color: 'var(--text-amber-900)' }}>{SAME_SPOT_WORDS.title}</div>
        <div data-testid="job-address-same-spot-line">
          <ValueSentence text={sameSpotSentence(ask)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: '0.6rem', rowGap: '0.2rem' }}>
          <span style={label}>{CLOSE_ON_FILE_WORDS.typed}</span>
          <span data-testid="job-address-same-spot-typed">
            {markedWords(address, ask.entry.address).map((w, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {w.differs ? <span style={mark('typed')}>{w.text}</span> : w.text}
              </span>
            ))}
          </span>
          <span style={label}>{CLOSE_ON_FILE_WORDS.onFile}</span>
          <span data-testid="job-address-same-spot-on-file">
            {markedWords(ask.entry.address, address).map((w, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {w.differs ? <span style={mark('onFile')}>{w.text}</span> : w.text}
              </span>
            ))}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" disabled={busy} onClick={() => onUse(ask.entry.address)} style={busy ? dead : { ...press, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}>
            {SAME_SPOT_WORDS.use}
          </button>
          <button type="button" disabled={busy} onClick={() => void keep(true)} style={busy ? dead : quiet}>
            {SAME_SPOT_WORDS.keep}
          </button>
          <button type="button" disabled={busy} onClick={() => void keep(false)} style={busy ? dead : quiet}>
            {SAME_SPOT_WORDS.notSame}
          </button>
        </div>
        {problem ? (
          <div role="alert" data-testid="job-address-same-spot-problem" style={{ color: 'var(--text-red-700)', fontWeight: 600 }}>
            {problem}
          </div>
        ) : null}
        <div style={label}>{SAME_SPOT_WORDS.foot}</div>
      </div>
    )
  }

  const kept = joined[0]
  if (!kept) return null
  return (
    <div data-testid="job-address-same-place-line" style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', gap: 6, fontSize: '0.75rem', color: 'var(--text-green-700)' }}>
      <span aria-hidden>✓</span>
      <span>
        <ValueSentence text={samePlaceSentence(kept)} />
      </span>
    </div>
  )
}
