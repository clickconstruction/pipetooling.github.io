/**
 * Equipment pre-use check (punch list #270, SPIKE): one gauge, full screen, for a phone. A thumb on a 44-pixel bar
 * hides what it sets; here the gauge is as tall as the screen allows, the words are large, the number under them
 * says how full, and the phone ticks (where it can) each time the reading crosses a mark, so a guess feels placed
 * rather than dropped. Done closes it; every move already saved.
 */
import { useEffect, useRef, useState } from 'react'
import { levelWords, type LevelDef } from '../../lib/machines/machines'
import { LevelGauge } from './LevelGauge'

export function LevelGaugeSheet({ def, value, last, onChange, onClose }: { def: LevelDef; value: number | undefined; last: number | undefined; onChange: (v: number) => void; onClose: () => void }) {
  const [scale, setScale] = useState(() => fit())
  useEffect(() => {
    const on = () => setScale(fit())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // a tick when the words change: crossing a quarter, reaching the line, leaving the red
  const lastWord = useRef(levelWords(def, value).word)
  useEffect(() => {
    const w = levelWords(def, value).word
    if (w !== lastWord.current) {
      lastWord.current = w
      try {
        navigator.vibrate?.(8)
      } catch {
        /* no haptics here */
      }
    }
  }, [def, value])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={def.name} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'var(--surface)', color: 'var(--text-strong)', display: 'grid', gridTemplateRows: 'auto 1fr auto', padding: 'max(0.75rem, env(safe-area-inset-top)) 1rem max(0.75rem, env(safe-area-inset-bottom))', boxSizing: 'border-box' }} data-level-gauge-sheet={def.key}>
      <div style={{ display: 'grid', gap: '0.1rem' }}>
        <b style={{ fontSize: '1.25rem' }}>{def.name}</b>
        {def.where ? <span style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>{def.where}</span> : null}
        <span style={{ fontSize: '0.875rem', color: 'var(--text-700)', marginTop: '0.25rem' }}>{def.look === 'dial' ? 'Drag the needle, or tap where it points.' : 'Drag the fill up or down, or tap where it sits.'}</span>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <LevelGauge def={def} value={value} last={last} readOnly={false} onChange={onChange} scale={scale} showPercent />
      </div>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {last != null ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>The small mark is last time: {levelWords(def, last).word}.</span> : null}
        <button type="button" onClick={onClose} style={{ minHeight: 52, borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '1.0625rem', cursor: 'pointer' }}>
          {value == null ? 'Leave it unread' : 'Done'}
        </button>
      </div>
    </div>
  )
}

/** As big as the screen allows: the bar is 150 tall at scale 1, and the dial 74. */
function fit(): number {
  if (typeof window === 'undefined') return 2
  const room = window.innerHeight - 260
  return Math.max(1.5, Math.min(3.2, room / 150))
}

export default LevelGaugeSheet
