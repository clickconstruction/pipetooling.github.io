import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import SignaturePad from 'signature_pad'
import type { LienWaiverFoot } from '../../lib/jobsDocuments/lienWaiverRelease'
import type { LienWaiverSignOnPageHandle } from '../../lib/jobs/lienWaiverSignPayload'
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from '../estimates/EstimateAcceptTypedSignatureLine'
import { SIGNATURE_INK_COLOR, SIGNATURE_PAPER_COLOR } from '../contracts/SignatureTypeOrDrawInput'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'

/**
 * Signing a lien waiver on the page itself (v2.4335). The pad used to be a separate box under a
 * "Your name" field, away from the page; the signer drew in a corner of it and the PDF printed the
 * whole box, small and to the left (job 650, Oct 1). Now the drawing area IS the signature line at
 * the foot of the page: he signs where it prints, his printed name sits under the line as plain
 * text (the leader of record — never a box someone else could type in), with his title and the
 * day. Someone signing at their own desk may type instead; a leader at someone else's screen draws.
 *
 * `LienWaiverSignOnPage` is the foot with the pad; `LienWaiverSignAgree` is the agreement and the
 * button under the page; `lienWaiverSignPayload` (lib/jobs) reads the pad when the button is
 * pressed. Used by the Release of Lien window's sign modal and the leader's Waivers to sign seat.
 */

const LINE_HEIGHT_PX = 112
const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-link)',
  fontWeight: 600,
  fontSize: '0.75rem',
  cursor: 'pointer',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  textDecoration: 'underline',
}

export const LienWaiverSignOnPage = forwardRef<
  LienWaiverSignOnPageHandle,
  {
    foot: LienWaiverFoot
    /** "Signed October 1, 2026" — the day he signs. */
    signedLabel: string
    /** Someone signing at their own desk may type; a leader at someone else's screen draws. */
    allowTyped: boolean
    disabled?: boolean
  }
>(function LienWaiverSignOnPage({ foot, signedLabel, allowTyped, disabled = false }, ref) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [started, setStarted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  // Someone mid-signature holds the app's auto-reload off.
  useHoldsUnsavedWork(started, 'Signature')

  useLayoutEffect(() => {
    if (mode !== 'draw') {
      padRef.current?.off()
      padRef.current = null
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    // Draw at the screen's sharpness, sized to the line it sits on (signature_pad's own recipe).
    const ratio = Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1)
    const size = () => {
      canvas.width = Math.round((wrapRef.current?.offsetWidth || 460) * ratio)
      canvas.height = Math.round(LINE_HEIGHT_PX * ratio)
      canvas.getContext('2d')?.scale(ratio, ratio)
    }
    size()
    const pad = new SignaturePad(canvas, { backgroundColor: SIGNATURE_PAPER_COLOR, penColor: SIGNATURE_INK_COLOR, minWidth: 0.9, maxWidth: 2.8 })
    pad.clear()
    pad.addEventListener?.('beginStroke', () => setStarted(true))
    if (disabled) pad.off()
    padRef.current = pad
    // The line changes width (a phone turned, the window resized): fit the canvas again and redraw
    // the strokes where they were, or the pen would land away from the finger.
    const ro =
      typeof ResizeObserver !== 'undefined' && wrapRef.current
        ? new ResizeObserver(() => {
            if (Math.round((wrapRef.current?.offsetWidth || 460) * ratio) === canvas.width) return
            const strokes = pad.toData()
            size()
            pad.clear()
            if (strokes.length > 0) pad.fromData(strokes)
          })
        : null
    if (ro && wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      ro?.disconnect()
      pad.off()
      padRef.current = null
    }
  }, [mode, disabled])

  useImperativeHandle(
    ref,
    () => ({
      mode,
      isEmpty: () => mode === 'draw' && (!padRef.current || padRef.current.isEmpty()),
      toDataURL: () => {
        if (mode !== 'draw') return null
        const pad = padRef.current
        if (!pad || pad.isEmpty()) return null
        return pad.toDataURL('image/png')
      },
      clear: () => {
        padRef.current?.clear()
        setStarted(false)
      },
    }),
    [mode],
  )

  return (
    <div data-testid="lien-waiver-sign-foot" style={{ marginTop: '2.2em', maxWidth: 470, position: 'relative', border: '2px dashed #2563eb', borderRadius: 8, padding: '0.7em 0.75em 0.55em', background: 'var(--bg-blue-tint)' }}>
      <span
        style={{
          position: 'absolute',
          top: '-0.85em',
          left: '0.6em',
          background: '#2563eb',
          color: '#ffffff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '0.72rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.1em 0.65em',
          whiteSpace: 'nowrap',
        }}
      >
        {mode === 'draw' ? 'Sign here, on the line' : 'Typed signature'}
      </span>
      <div ref={wrapRef} style={{ position: 'relative', background: SIGNATURE_PAPER_COLOR, borderRadius: '6px 6px 0 0' }}>
        {mode === 'draw' ? (
          <canvas
            ref={canvasRef}
            aria-label="Sign on the line"
            onPointerDown={() => setStarted(true)}
            style={{ display: 'block', width: '100%', height: LINE_HEIGHT_PX, touchAction: 'none', cursor: disabled ? 'default' : 'crosshair' }}
          />
        ) : (
          <div style={{ height: LINE_HEIGHT_PX, display: 'flex', alignItems: 'flex-end', paddingLeft: '1.6em', paddingBottom: '0.15em', fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT, fontSize: '2.3em', lineHeight: 1.1, color: SIGNATURE_INK_COLOR }}>{foot.name}</div>
        )}
        <span aria-hidden="true" style={{ position: 'absolute', left: 6, bottom: 4, fontSize: 18, lineHeight: 1, color: 'var(--text-faint)', pointerEvents: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          ✕
        </span>
        {mode === 'draw' && !started ? (
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', pointerEvents: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '0.85rem' }}>
            Draw with a finger or the mouse
          </span>
        ) : null}
      </div>
      <div style={{ borderTop: '1.5px solid var(--text-base)', paddingTop: '0.4em', lineHeight: 1.45 }}>
        <strong>{foot.name}</strong>, {foot.company}
      </div>
      {foot.title ? <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{foot.title}</div> : null}
      <div style={{ fontSize: '0.9em', lineHeight: 1.5, color: 'var(--text-muted)' }}>{signedLabel}</div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem' }}>
        {mode === 'draw' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              padRef.current?.clear()
              setStarted(false)
            }}
            style={linkBtn}
          >
            Clear
          </button>
        ) : null}
        {allowTyped ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setMode((m) => (m === 'draw' ? 'type' : 'draw'))
              setStarted(false)
            }}
            style={linkBtn}
          >
            {mode === 'draw' ? 'Type it instead' : 'Draw it instead'}
          </button>
        ) : null}
      </div>
    </div>
  )
})

/** The agreement and the button, under the page. */
export function LienWaiverSignAgree({
  disclosure,
  agreeLabel,
  agreed,
  onAgreedChange,
  error,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  disclosure: string
  agreeLabel: string
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  error: string | null
  submitting: boolean
  submitLabel: string
  onSubmit: () => void
  onCancel?: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }} data-testid="lien-waiver-sign-agree">
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{disclosure}</p>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={agreed} onChange={(e) => onAgreedChange(e.target.checked)} disabled={submitting} style={{ marginTop: 3 }} />
        <span>{agreeLabel}</span>
      </label>
      {error ? (
        <p role="alert" style={{ margin: 0, color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          style={{ padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.9rem', background: '#ea580c', color: '#ffffff', border: 'none', borderRadius: 7, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit' }}
        >
          {submitting ? 'Signing…' : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-base)', fontFamily: 'inherit' }}
          >
            Not now
          </button>
        ) : null}
      </div>
    </div>
  )
}
