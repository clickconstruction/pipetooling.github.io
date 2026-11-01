import { useEffect, type CSSProperties } from 'react'
import { countyWords, heldChoices, heldQuestion, type HeldAnswer } from '../../lib/legal/firmCounties'

/**
 * A county another firm covers, pressed on a picker (punch list #222, PR 3, v2.6227): three answers and a way out.
 * *Share it* (both cover it, the other firm stays first call), *Make <firm> first call* (both cover it, new
 * releases go to the picked firm), *Move it to <firm>* (the other firm stops covering it), or *Leave it*. The
 * Settings picker, **Firms…** and the firm window's *Extend coverage* all ask with this sheet, so the three doors
 * ask the same question in the same words. Above every window (z 3000, the confirm dialog's layer); Esc leaves it.
 */
export default function LegalCountyHeldSheet({ county, holderName, firmName, onAnswer, onCancel }: {
  county: string
  holderName: string
  firmName: string
  onAnswer: (answer: HeldAnswer) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return (
    <div role="presentation" onClick={(e) => { e.stopPropagation(); onCancel() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 14px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
      <div role="dialog" aria-modal="true" aria-label={countyWords(county)} data-legal-county-held={county} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: 18, maxWidth: 460, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.28)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>{countyWords(county)}</h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>{heldQuestion(county, holderName, firmName)}</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {heldChoices(county, holderName, firmName).map((c, i) => (
            <button key={c.answer} type="button" onClick={() => onAnswer(c.answer)} data-legal-held-answer={c.answer} autoFocus={i === 0} style={choice}>
              <b style={{ display: 'block', fontSize: '0.9rem' }}>{c.label}</b>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.detail}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={onCancel} style={leave}>Leave it</button>
        </div>
      </div>
    </div>
  )
}

const choice: CSSProperties = { textAlign: 'left', padding: '10px 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', cursor: 'pointer' }
const leave: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '0.86rem', cursor: 'pointer' }
