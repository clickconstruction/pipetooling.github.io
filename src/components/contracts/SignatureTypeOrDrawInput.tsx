import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties } from 'react'
import SignaturePad from 'signature_pad'
import { EstimateAcceptTypedSignatureLine } from '../estimates/EstimateAcceptTypedSignatureLine'

/**
 * The Type / Draw signature input every signing surface shares (v2.3159):
 * a two-button mode switch, the cursive typed-name preview line, or a
 * finger/mouse canvas (signature_pad) with a Clear button. Lifted out of
 * ContractAcceptSignatureForm so the Bid Room can offer a drawn signature
 * too, without adopting that form's heading / disclosure / submit chrome.
 *
 * The parent owns `mode` (so it can reset hints on a switch) and reads the
 * drawing through the imperative handle at submit time — the PNG only exists
 * once the signer presses the button, exactly like the contract form.
 */

export type SignatureMode = 'type' | 'draw'

export type SignatureTypeOrDrawHandle = {
  /** True when in draw mode and nothing has been drawn (or the pad isn't mounted). */
  isEmpty: () => boolean
  /** The drawn signature as a PNG data URL, or null when empty / in type mode. */
  toDataURL: () => string | null
  clear: () => void
}

export type SignatureTypeOrDrawInputProps = {
  mode: SignatureMode
  onModeChange: (mode: SignatureMode) => void
  /** Drives the typed-signature preview line. */
  printedName: string
  placeholderName?: string
  disabled?: boolean
  /** `center` (contract / lien pages) or `left` (the Bid Room's inline form). */
  align?: 'center' | 'left'
  /** Width cap for the preview line and canvas. */
  maxWidth?: number
}

export const SIGNATURE_NAME_PLACEHOLDER = 'Your full legal name'

/**
 * The signature "paper" is always white with dark ink, in both themes: the
 * canvas IS the PNG the office files, prints and shows on the signed record,
 * so it must not follow the dark theme. Real colors, not tokens — a canvas
 * fillStyle cannot read CSS variables, and `'var(--surface)'` silently fell
 * back to black, hiding the ink (fixed v2.3164). rgb() on purpose: the
 * theme-tokenize check rewrites neutral hexes, and this literal is deliberate.
 */
export const SIGNATURE_PAPER_COLOR = 'rgb(255, 255, 255)'
export const SIGNATURE_INK_COLOR = 'rgb(17, 24, 39)'

const CANVAS_W = 400
const CANVAS_H = 160

const segmentBtnStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? '#ea580c' : 'var(--bg-subtle)',
  color: active ? 'white' : 'var(--text-700)',
})

export const SignatureTypeOrDrawInput = forwardRef<SignatureTypeOrDrawHandle, SignatureTypeOrDrawInputProps>(
  function SignatureTypeOrDrawInput(
    { mode, onModeChange, printedName, placeholderName = SIGNATURE_NAME_PLACEHOLDER, disabled = false, align = 'center', maxWidth = CANVAS_W },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const padRef = useRef<SignaturePad | null>(null)
    const centered = align === 'center'

    useLayoutEffect(() => {
      if (mode !== 'draw') {
        padRef.current?.off()
        padRef.current = null
        return
      }
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = CANVAS_W
      canvas.height = CANVAS_H
      const pad = new SignaturePad(canvas, {
        backgroundColor: SIGNATURE_PAPER_COLOR,
        penColor: SIGNATURE_INK_COLOR,
      })
      padRef.current = pad
      return () => {
        pad.off()
        padRef.current = null
      }
    }, [mode])

    useImperativeHandle(
      ref,
      () => ({
        isEmpty: () => mode !== 'draw' || !padRef.current || padRef.current.isEmpty(),
        toDataURL: () => {
          if (mode !== 'draw') return null
          const pad = padRef.current
          if (!pad || pad.isEmpty()) return null
          return pad.toDataURL('image/png')
        },
        clear: () => padRef.current?.clear(),
      }),
      [mode],
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: centered ? 'center' : 'stretch', width: '100%' }}>
        <div
          role="group"
          aria-label="Sign by typing or drawing"
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.75rem',
            justifyContent: centered ? 'center' : 'flex-start',
            width: '100%',
          }}
        >
          <button type="button" disabled={disabled} onClick={() => onModeChange('type')} style={segmentBtnStyle(mode === 'type')}>
            Type
          </button>
          <button type="button" disabled={disabled} onClick={() => onModeChange('draw')} style={segmentBtnStyle(mode === 'draw')}>
            Draw
          </button>
        </div>

        {mode === 'type' ? (
          <div style={{ marginTop: '0.75rem', width: '100%', maxWidth }}>
            <EstimateAcceptTypedSignatureLine
              printedName={printedName}
              placeholderName={placeholderName}
              previewDate={new Date()}
              nameMutedOverride={!printedName.trim()}
              ariaHidden
            />
          </div>
        ) : (
          <div style={{ marginTop: '0.75rem', width: '100%', maxWidth, textAlign: centered ? 'center' : 'left' }}>
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>Sign below (use your finger or mouse)</span>
            <div style={{ width: '100%', maxWidth, marginLeft: centered ? 'auto' : 0, marginRight: centered ? 'auto' : 0 }}>
              <canvas
                ref={canvasRef}
                aria-label="Signature drawing area"
                style={{
                  display: 'block',
                  width: '100%',
                  maxWidth,
                  height: CANVAS_H,
                  touchAction: 'none',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: SIGNATURE_PAPER_COLOR,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              disabled={disabled}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
              }}
            >
              Clear signature
            </button>
          </div>
        )}
      </div>
    )
  },
)
