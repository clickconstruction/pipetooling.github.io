/**
 * Scan a label (punch list #304): the press that says how a label opens, for a person already signed
 * in. The phone's own camera reads the QR and the box opens, so the window is the words and, for a
 * label the camera cannot read, the eight characters printed under the code. `/b/<code>` does the
 * rest: it finds the box and opens it on the On site tab, on whatever job it stands. A sticker's code goes the same
 * way (punch list #329), to its box or to the Sticker is new sheet. Since v2.7438 the code is the one thing typed: a
 * sticker's running number is on no tape, so the field no longer takes one.
 */
import { useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { readScanTyped, SCAN_TYPED_SLIP, scanTypedWords } from '../../lib/materials/stickerPlace'

const BLUE = '#2563eb'
const press: CSSProperties = { minHeight: 48, width: '100%', boxSizing: 'border-box', borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: BLUE, background: BLUE, color: '#fff', font: 'inherit', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }

export const SCAN_LABEL_SLIP = SCAN_TYPED_SLIP

export default function ScanLabelWindow({ onClose, onOpen }: { onClose: () => void; /** The code: eight capitals and digits, no dash. */ onOpen: (code: string) => void }) {
  const [typed, setTyped] = useState('')
  const [slip, setSlip] = useState<string | null>(null)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const read = readScanTyped(typed)
    if (read.kind === 'code') {
      onOpen(read.code)
      return
    }
    setSlip(SCAN_LABEL_SLIP)
  }
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Scan a label" style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 12, width: 'min(420px, 100%)', padding: '1rem 1.25rem 1.25rem', display: 'grid', gap: '0.75rem', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', flex: '1 1 auto' }}>Scan a label</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', minHeight: 36, minWidth: 36 }}>×</button>
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>Open your phone’s camera and point it at the label on a cage or box. The box opens on the On site tab. A reserved sticker opens the sheet that puts it on its box.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: '0.5rem' }}>
          <label htmlFor="scan-label-code" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Or type the eight characters under the QR code</label>
          <input
            id="scan-label-code"
            value={typed}
            onChange={(e) => {
              setTyped(scanTypedWords(e.target.value))
              setSlip(null)
            }}
            placeholder="4F2A-9C18"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            style={{ minHeight: 48, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 10, padding: '0 14px', font: 'inherit', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '1.25rem', letterSpacing: '0.12em', background: 'var(--surface)', color: 'var(--text-strong)' }}
            data-testid="scan-label-input"
          />
          {slip ? <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }} data-testid="scan-label-slip">{slip}</div> : null}
          <button type="submit" style={press} data-testid="scan-label-open">Open the box</button>
        </form>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>A box on another job opens on that job.</p>
      </div>
    </div>,
    document.body,
  )
}
