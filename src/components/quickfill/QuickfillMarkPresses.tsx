import { useState, type CSSProperties } from 'react'
import { markPressBarLabel, markPresses, type MarkOutcome } from '../../lib/quickfill/markOutcome'

/**
 * The three presses every station bar offers (punch list #176, change 1): Done, lit at zero;
 * Worked it · N left, lit above zero; Not sure what to do, always lit, which opens one line to
 * say what is unclear and sends it as a Dispatch inbox request. One component, four layouts:
 * the Roller's bar (`bar`, with the small hint under each word), the phone round's stack
 * (`stack`), the Page's foot (`foot`) and the station header's small pair (`small`, Done or
 * Worked it beside Not sure). The press's meaning is the kernel's, `markPresses`.
 */
export type QuickfillMarkPressesLayout = 'bar' | 'stack' | 'foot' | 'small'

const PALETTE: Record<MarkOutcome, { background: string; border: string; color: string }> = {
  done: { background: '#16a34a', border: '#16a34a', color: '#fff' },
  worked: { background: '#2563eb', border: '#2563eb', color: '#fff' },
  question: { background: 'var(--bg-subtle)', border: 'var(--border-strong)', color: 'var(--text-700)' },
}

export function QuickfillMarkPresses({
  count,
  loading = false,
  noun = 'open',
  nextLabel = null,
  layout,
  marking = false,
  stationLabel,
  onPress,
}: {
  count: number | null
  /** The station is still counting (v2.5868): Done and Worked it wait, dimmed, so no press saves a mark with no count. */
  loading?: boolean
  /** The count's word: *open*, *due*, *waiting*. */
  noun?: string
  /** On the Roller and the round the lit press also says where it goes: *next →* or *done ✓*. */
  nextLabel?: string | null
  layout: QuickfillMarkPressesLayout
  marking?: boolean
  stationLabel: string
  /** The press, with the words typed under Not sure (empty when none). */
  onPress: (outcome: MarkOutcome, words: string) => void
}) {
  const [asking, setAsking] = useState(false)
  const [words, setWords] = useState('')
  const presses = markPresses(count, noun, loading)
  const small = layout === 'small'
  const stack = layout === 'stack'
  const showHints = layout === 'bar'

  const btn = (press: (typeof presses)[number]) => {
    const p = PALETTE[press.outcome]
    const lit = press.enabled && !marking
    const style: CSSProperties = {
      padding: small ? '0.3rem 0.6rem' : stack ? '0.75rem 0.9rem' : '0.6rem 0.8rem',
      borderRadius: small ? 6 : 10,
      border: `1px solid ${lit ? p.border : 'var(--border)'}`,
      background: lit ? p.background : 'var(--surface)',
      color: lit ? p.color : 'var(--text-muted)',
      fontWeight: press.outcome === 'question' ? 600 : 700,
      fontSize: small ? '0.75rem' : '0.9375rem',
      cursor: lit ? 'pointer' : 'default',
      opacity: lit ? 1 : 0.6,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      lineHeight: 1.2,
      fontFamily: 'inherit',
    }
    const label = nextLabel && !small ? markPressBarLabel(press, nextLabel) : press.label
    return (
      <button
        key={press.outcome}
        type="button"
        disabled={!lit}
        aria-disabled={!lit}
        title={small ? `${press.label} · ${press.hint}` : press.hint}
        aria-label={`${press.label} · ${stationLabel}`}
        onClick={() => {
          if (!lit) return
          if (press.outcome === 'question') setAsking(true)
          else onPress(press.outcome, '')
        }}
        style={style}
      >
        {marking && press.enabled && press.outcome !== 'question' ? 'Marking…' : label}
        {showHints ? <small style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 400, opacity: 0.85 }}>{press.hint}</small> : null}
      </button>
    )
  }

  // The header's pair: the one lit of Done / Worked it, and Not sure.
  const shown = small ? presses.filter((p) => p.outcome === 'question' || p.enabled) : presses

  const form = asking ? (
    <div
      role="group"
      aria-label={`Not sure what to do on ${stationLabel}`}
      style={{ display: 'flex', flexDirection: stack || small ? 'column' : 'row', gap: '0.5rem', alignItems: stack || small ? 'stretch' : 'center', marginTop: '0.5rem', gridColumn: '1 / -1' }}
    >
      <input
        type="text"
        value={words}
        autoFocus
        onChange={(e) => setWords(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onPress('question', words)
            setAsking(false)
            setWords('')
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setAsking(false)
          }
        }}
        placeholder="Say what is unclear, or send it as it is"
        aria-label="What is unclear"
        style={{ flex: 1, minWidth: 0, fontSize: 16, padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={marking}
          onClick={() => {
            onPress('question', words)
            setAsking(false)
            setWords('')
          }}
          style={{ flex: 1, padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Send the question
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          style={{ padding: '0.5rem 0.8rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null

  if (small) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
        <span style={{ display: 'inline-flex', gap: '0.35rem' }}>{shown.map(btn)}</span>
        {form}
      </span>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: stack ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: stack ? '0.4rem' : '0.5rem', width: '100%' }} data-testid="quickfill-mark-presses">
      {presses.map(btn)}
      {form}
    </div>
  )
}
