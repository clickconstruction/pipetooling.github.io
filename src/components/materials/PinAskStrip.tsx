/**
 * Pin A7 where you stand? (punch list #372, step 3): the one line the box screen draws after a count, a photo, a
 * scan of the label or a new box, the four moments a person is known to stand at the box. One press takes one
 * reading and pins the box there, held to I found it's rule. The rules of when to ask are `pinAsk.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { requestMyFix } from '../../lib/materials/myLocation'
import type { Container } from '../../lib/materials/onSite'
import { pinContainer } from '../../lib/materials/onSiteStore'
import { PIN_ASK_LATER_PRESS, PIN_ASK_PRESS, PIN_ASK_WHY, pinAskWords } from '../../lib/materials/pinAsk'
import { WHERE_TRY_AGAIN_PRESS, foundNoFixWords, foundVerdict } from '../../lib/materials/whereIsBox'

const BLUE = '#2563eb'
const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: BLUE, background: BLUE, color: '#fff', font: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }
const later: CSSProperties = { background: 'none', border: 'none', padding: '0 0.4rem', minHeight: 44, color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }

export default function PinAskStrip({ container, byName, onPinned, onLater }: { container: Container; byName: string; /** The pin was made: the words to toast. */ onPinned: (words: string) => void; onLater: () => void }) {
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const pinHere = () => {
    if (busy) return
    setBusy(true)
    setRefused(null)
    requestMyFix(
      (fix) => {
        setBusy(false)
        const v = foundVerdict(container.label, fix)
        if (!v.ok) {
          setRefused(v.words)
          return
        }
        pinContainer(container.id, v.pin, { accuracyM: v.accuracyM, byName })
        onPinned(v.words)
      },
      (why) => {
        setBusy(false)
        setRefused(foundNoFixWords(container.label, why))
      },
    )
  }
  return (
    <div role="group" aria-label={pinAskWords(container.label)} data-testid="pin-ask" style={{ background: 'var(--bg-blue-tint)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-blue)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.4rem' }}>
      <div style={{ display: 'grid', gap: '0.1rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{pinAskWords(container.label)}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{PIN_ASK_WHY}</span>
      </div>
      {refused ? <p role="alert" style={{ margin: 0, color: 'var(--text-amber-800)', fontSize: '0.85rem' }}>{refused}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button type="button" style={press} onClick={pinHere} aria-busy={busy}>{busy ? 'Finding you…' : refused ? WHERE_TRY_AGAIN_PRESS : PIN_ASK_PRESS}</button>
        <button type="button" style={later} onClick={onLater}>{PIN_ASK_LATER_PRESS}</button>
      </div>
    </div>
  )
}
