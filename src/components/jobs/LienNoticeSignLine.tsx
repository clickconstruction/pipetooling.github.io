import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import SignaturePad from 'signature_pad'
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from '../estimates/EstimateAcceptTypedSignatureLine'
import { SIGNATURE_INK_COLOR, SIGNATURE_PAPER_COLOR } from '../contracts/SignatureTypeOrDrawInput'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'

/**
 * The notice's own signature line, in the desk footer and on the phone card (v2.5082, lien desk
 * signing PR 2). His name waits on the line in the cursive face, grey until the press; Sign and
 * approve ▸ writes it and the record. *Draw instead* turns the line into a pad for the days he
 * wants ink; at someone else's screen (Leader here) only the pad is offered, since a press there
 * would be that sign-in's act. The line is drawn where it prints, the way the release's foot is
 * (v2.4335): the name and company under the rule, the day beside them.
 */
export type LienNoticeSignLineHandle = {
  mode: 'type' | 'draw'
  /** True when drawing and nothing is on the line yet; never true when typing. */
  isEmpty: () => boolean
  /** The drawing as a PNG data URL, or null when empty or typing. */
  toDataURL: () => string | null
  clear: () => void
}

const LINE_HEIGHT_PX = 84
const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-link)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  textDecoration: 'underline',
}

export const LienNoticeSignLine = forwardRef<
  LienNoticeSignLineHandle,
  {
    /** The name the mark prints — the signed-in leader's. */
    printedName: string
    /** The line under the rule, as the notice prints it: "Robert Douglas, Owner" and the company. */
    under: string[]
    /** "Signed October 9, 2026" — the day he signs. */
    signedLabel: string
    /** False at someone else's screen: the pad only. */
    allowPress?: boolean
    disabled?: boolean
    compact?: boolean
  }
>(function LienNoticeSignLine({ printedName, under, signedLabel, allowPress = true, disabled = false, compact = false }, ref) {
  const [mode, setMode] = useState<'type' | 'draw'>(allowPress ? 'type' : 'draw')
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
    const fit = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = Math.round((wrapRef.current?.offsetWidth || 420) * ratio)
      canvas.height = Math.round(LINE_HEIGHT_PX * ratio)
      canvas.getContext('2d')?.scale(ratio, ratio)
    }
    fit()
    const pad = new SignaturePad(canvas, { backgroundColor: SIGNATURE_PAPER_COLOR, penColor: SIGNATURE_INK_COLOR, minWidth: 0.9, maxWidth: 2.8 })
    if (disabled) pad.off()
    padRef.current = pad
    const ro = typeof ResizeObserver !== 'undefined' && wrapRef.current ? new ResizeObserver(() => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      if (Math.round((wrapRef.current?.offsetWidth || 420) * ratio) === canvas.width) return
      const data = pad.toData()
      fit()
      pad.clear()
      pad.fromData(data)
    }) : null
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
      isEmpty: () => mode === 'draw' && (padRef.current?.isEmpty() ?? true),
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
    <div
      data-testid="lien-sign-line"
      data-lien-sign-mode={mode}
      style={{ position: 'relative', border: '2px dashed #2563eb', borderRadius: 8, padding: compact ? '0.65em 0.6em 0.45em' : '0.7em 0.75em 0.55em', background: 'var(--bg-blue-tint)', maxWidth: 470 }}
    >
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
        {mode === 'draw' ? 'Sign here, on the line' : 'Your signature, as it will print'}
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
          <div
            data-testid="lien-sign-line-name"
            style={{ height: LINE_HEIGHT_PX, display: 'flex', alignItems: 'flex-end', paddingLeft: '1.2em', paddingBottom: '0.1em', fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT, fontSize: compact ? '2.1em' : '2.4em', lineHeight: 1.1, color: '#9aa3ae', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {printedName.trim() || 'Your name'}
          </div>
        )}
        {mode === 'draw' && !started ? (
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', pointerEvents: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: '0.8125rem' }}>
            Draw with a finger or the mouse
          </span>
        ) : null}
      </div>
      <div style={{ borderTop: '1.5px solid var(--text-base)', paddingTop: '0.35em', lineHeight: 1.4, fontSize: compact ? '0.8125rem' : '0.875rem' }}>
        {under.filter((l) => l.trim()).map((l, i) => (i === 0 ? <strong key={l}>{l}</strong> : <span key={`${l}-${i}`}>, {l}</span>))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{signedLabel}</span>
        <span style={{ display: 'flex', gap: '1rem' }}>
          {mode === 'draw' ? (
            <button type="button" disabled={disabled} onClick={() => { padRef.current?.clear(); setStarted(false) }} style={linkBtn}>
              Clear
            </button>
          ) : null}
          {allowPress ? (
            <button type="button" disabled={disabled} onClick={() => { setMode((m) => (m === 'draw' ? 'type' : 'draw')); setStarted(false) }} style={linkBtn} data-testid="lien-sign-line-toggle">
              {mode === 'draw' ? 'Press instead' : 'Draw instead'}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
})
