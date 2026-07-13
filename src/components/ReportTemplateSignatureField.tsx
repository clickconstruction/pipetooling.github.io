import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import SignaturePad from 'signature_pad'

type Props = {
  /** Stable across remounts when template/report changes */
  reactKeyPrefix: string
  id: string
  label: string
  value: string
  onChange: (dataUrl: string) => void
  /** Shown muted on the right of the Clear row when set (typically the signed-in user's display name). */
  captionBelowCanvas: string | null
}

/**
 * Drawable PNG capture for signature_png report_template_fields.
 * Syncs {@code value} on each stroke end; clears propagate as empty string.
 */
export function ReportTemplateSignatureField({
  reactKeyPrefix,
  id,
  label,
  value,
  onChange,
  captionBelowCanvas,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const seededRef = useRef(false)
  const lblId = useId()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useLayoutEffect(() => {
    seededRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    const w = 400
    const h = 160
    canvas.width = w
    canvas.height = h
    const pad = new SignaturePad(canvas, {
      backgroundColor: 'var(--surface)',
      penColor: '#111827',
    })
    pad.addEventListener('endStroke', () => {
      onChangeRef.current(pad.toDataURL('image/png'))
    })
    padRef.current = pad
    return () => {
      pad.off()
      padRef.current = null
    }
  }, [reactKeyPrefix])

  useEffect(() => {
    const pad = padRef.current
    const v = (value ?? '').trim()
    if (!pad || seededRef.current) return
    if (v.startsWith('data:image/')) {
      void pad.fromDataURL(v).then(() => {
        seededRef.current = true
      })
    }
  }, [value])

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <label htmlFor={id} id={lblId} style={{ marginBottom: 4, fontWeight: 500, textAlign: 'center' }}>
          {label}
        </label>
        <div
          style={{
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            id={id}
            aria-labelledby={lblId}
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 160 }}
          />
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: 6,
          width: '100%',
          alignSelf: 'stretch',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const pad = padRef.current
            if (!pad) return
            pad.clear()
            seededRef.current = false
            onChange('')
          }}
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8125rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
        >
          Clear
        </button>
        {captionBelowCanvas ? (
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 500,
              color: 'var(--text-600)',
              textAlign: 'right',
              minWidth: 0,
              flex: 1,
            }}
          >
            {captionBelowCanvas}
          </span>
        ) : (
          <span aria-hidden style={{ flex: 1 }} />
        )}
      </div>
    </div>
  )
}
