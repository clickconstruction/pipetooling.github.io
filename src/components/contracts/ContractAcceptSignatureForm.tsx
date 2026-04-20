import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import SignaturePad from 'signature_pad'
import { EstimateAcceptTypedSignatureLine } from '../estimates/EstimateAcceptTypedSignatureLine'
import type { EstimateAcceptSubmitPayload } from '../estimates/EstimateAcceptBody'

const NAME_PLACEHOLDER = 'Your full legal name'

const SIGNATURE_DISCLOSURE =
  'By signing, you acknowledge that you have read and agree to this contract. ' +
  'Typing or drawing your signature here will have the same force and effect as your written signature.'

const segmentBtnStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  background: active ? '#ea580c' : '#f9fafb',
  color: active ? 'white' : '#374151',
})

export type ContractAcceptSignatureFormProps = {
  printedName: string
  agreed: boolean
  onPrintedNameChange: (value: string) => void
  onAgreedChange: (value: boolean) => void
  formError: string | null
  submitting: boolean
  onSubmit: (payload: EstimateAcceptSubmitPayload) => void
}

export function ContractAcceptSignatureForm({
  printedName,
  agreed,
  onPrintedNameChange,
  onAgreedChange,
  formError,
  submitting,
  onSubmit,
}: ContractAcceptSignatureFormProps) {
  const [acceptMode, setAcceptMode] = useState<'type' | 'draw'>('type')
  const [fieldHint, setFieldHint] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const headingId = useId()
  const signatureNameIsPlaceholder = !printedName.trim()

  useLayoutEffect(() => {
    if (acceptMode !== 'draw') {
      padRef.current?.off()
      padRef.current = null
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const w = 400
    const h = 160
    canvas.width = w
    canvas.height = h
    const pad = new SignaturePad(canvas, {
      backgroundColor: '#ffffff',
      penColor: '#111827',
    })
    padRef.current = pad
    return () => {
      pad.off()
      padRef.current = null
    }
  }, [acceptMode])

  function handleSubmit() {
    setFieldHint(null)
    const trimmed = printedName.trim()
    if (!trimmed) {
      setFieldHint('Please enter your full name.')
      return
    }
    if (!agreed) {
      setFieldHint('Please confirm that you agree.')
      return
    }
    if (acceptMode === 'type') {
      onSubmit({ mode: 'type', printedName: trimmed })
      return
    }
    const pad = padRef.current
    if (!pad || pad.isEmpty()) {
      setFieldHint('Please sign in the box.')
      return
    }
    onSubmit({
      mode: 'draw',
      printedName: trimmed,
      signaturePngBase64: pad.toDataURL('image/png'),
    })
  }

  const primaryBtnStyle: CSSProperties = {
    marginTop: '1rem',
    padding: '0.5rem 1.25rem',
    fontWeight: 600,
    background: '#ea580c',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: submitting ? 'wait' : 'pointer',
  }

  return (
    <section
      aria-labelledby={headingId}
      style={{
        marginTop: '2rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <h2 id={headingId} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem' }}>
        Sign contract
      </h2>

      <label style={{ display: 'block', marginTop: '0.75rem' }}>
        <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
          Your name
          <span aria-hidden="true"> *</span>
        </span>
        <input
          type="text"
          value={printedName}
          onChange={(e) => onPrintedNameChange(e.target.value)}
          disabled={submitting}
          required
          autoComplete="name"
          placeholder={NAME_PLACEHOLDER}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '0.5rem',
            boxSizing: 'border-box',
          }}
        />
      </label>

      <div
        role="group"
        aria-label="Sign by typing or drawing"
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '0.75rem',
        }}
      >
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setAcceptMode('type')
            setFieldHint(null)
          }}
          style={segmentBtnStyle(acceptMode === 'type')}
        >
          Type
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setAcceptMode('draw')
            setFieldHint(null)
          }}
          style={segmentBtnStyle(acceptMode === 'draw')}
        >
          Draw
        </button>
      </div>

      {acceptMode === 'type' ? (
        <div style={{ marginTop: '0.75rem' }}>
          <EstimateAcceptTypedSignatureLine
            printedName={printedName}
            placeholderName={NAME_PLACEHOLDER}
            previewDate={new Date()}
            nameMutedOverride={signatureNameIsPlaceholder}
            ariaHidden
          />
        </div>
      ) : (
        <div style={{ marginTop: '0.75rem' }}>
          <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
            Sign below (use your finger or mouse)
          </span>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 400,
                height: 160,
                touchAction: 'none',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear()
              setFieldHint(null)
            }}
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.35rem 0.65rem',
              fontSize: '0.85rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            Clear signature
          </button>
        </div>
      )}

      <p
        style={{
          fontSize: '0.8rem',
          color: '#6b7280',
          lineHeight: 1.45,
          marginTop: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        {SIGNATURE_DISCLOSURE}
      </p>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: 0 }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          disabled={submitting}
        />
        <span>I have read and agree to this contract.</span>
      </label>

      {(formError || fieldHint) ? (
        <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{formError || fieldHint}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        style={primaryBtnStyle}
      >
        {submitting ? 'Submitting…' : 'Submit signature'}
      </button>
    </section>
  )
}
