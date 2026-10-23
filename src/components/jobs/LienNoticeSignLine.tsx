import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import SignaturePad from 'signature_pad'
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from '../estimates/EstimateAcceptTypedSignatureLine'
import { SIGNATURE_INK_COLOR, SIGNATURE_PAPER_COLOR } from '../contracts/SignatureTypeOrDrawInput'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'
import { LIEN_SIGN_CODE_RE } from '../../lib/jobs/lienDeskSignIo'

/**
 * The notice's own signature line, in the desk footer and on the phone card (v2.5082, lien desk
 * signing PR 2). His name waits on the line in the cursive face, grey until the press; Sign and
 * approve ▸ writes it and the record. *Draw instead* turns the line into a pad for the days he
 * wants ink; at someone else's screen (Leader here) only the pad is offered, since a press there
 * would be that sign-in's act. The line is drawn where it prints, the way the release's foot is
 * (v2.4335): the name and company under the rule, the day beside them.
 *
 * On someone else's screen with `codeSigner` (v2.5791, punch list #150): the job's master signs
 * with his own signing code — his name waits in cursive, a code field sits under the line, and
 * the press hands the code to the database, which checks it (`sign_lien_desk_item_with_code`).
 * The signed-in user's name is never shown as the signature. *Draw instead* stays, attributed
 * to him. With no code set, a locked code, or the database side not live yet, the pad leads and
 * the line says why.
 */
export type LienNoticeSignLineMode = 'type' | 'draw' | 'code'

export type LienNoticeSignLineHandle = {
  mode: LienNoticeSignLineMode
  /** True when drawing and nothing is on the line yet, or typing a code with fewer than four digits; never true when pressing. */
  isEmpty: () => boolean
  /** The drawing as a PNG data URL, or null when empty or not drawing. */
  toDataURL: () => string | null
  /** The code as typed; '' when not in code mode. */
  code: () => string
  clear: () => void
}

/** Who signs with a code on this screen, and whether his code can be taken right now. */
export type LienNoticeSignLineCodeSigner = {
  /** His first name, as the words use it: "Malachi signs here with his code". */
  firstName: string
  /** `ready` = he has a code; `none` = not set; `locked` = five wrong tries; `not_live` = the database side is not pushed; `loading` = still asking. */
  status: 'ready' | 'none' | 'locked' | 'not_live' | 'loading'
  /** "2:29 PM" while locked. */
  lockedUntilClock?: string | null
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
const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

/** What the line says under the code field for a signer who cannot type one right now; null when he can. */
export function lienSignLineCodeWords(signer: LienNoticeSignLineCodeSigner): string | null {
  if (signer.status === 'ready') return null
  if (signer.status === 'loading') return 'Asking whether he has a code…'
  if (signer.status === 'none') return `${signer.firstName} has not set a signing code yet. He sets it under Settings, Your account. He can draw here instead.`
  if (signer.status === 'locked') return `His code is locked${signer.lockedUntilClock ? ` until ${signer.lockedUntilClock}` : ' for fifteen minutes'} after five wrong tries. He can draw here instead.`
  return 'Signing by code is not switched on yet. He can draw here instead.'
}

export const LienNoticeSignLine = forwardRef<
  LienNoticeSignLineHandle,
  {
    /** The name the mark prints — the signed-in leader's, or the job's master's with `codeSigner`. */
    printedName: string
    /** The line under the rule, as the notice prints it: "Robert Douglas, Owner" and the company. */
    under: string[]
    /** "Signed October 9, 2026" — the day he signs. */
    signedLabel: string
    /** False at someone else's screen: the pad only. */
    allowPress?: boolean
    /** Someone else's screen, and the job's master signs with his code (v2.5791): the press is a code, not a name. */
    codeSigner?: LienNoticeSignLineCodeSigner | null
    /** The last answer to a wrong code, shown under the field: "That is not Malachi’s code. 3 tries left." */
    codeProblem?: string | null
    disabled?: boolean
    compact?: boolean
  }
>(function LienNoticeSignLine({ printedName, under, signedLabel, allowPress = true, codeSigner = null, codeProblem = null, disabled = false, compact = false }, ref) {
  const codeReady = codeSigner?.status === 'ready'
  const [mode, setMode] = useState<LienNoticeSignLineMode>(codeSigner ? (codeReady ? 'code' : 'draw') : allowPress ? 'type' : 'draw')
  const [code, setCode] = useState('')
  const [started, setStarted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  // Someone mid-signature holds the app's auto-reload off.
  useHoldsUnsavedWork(started || code.length > 0, 'Signature')
  // The status answers after the line is drawn: a code that can be taken moves the line to code mode once, never away from ink.
  const sawReady = useRef(codeReady)
  useLayoutEffect(() => {
    if (codeReady && !sawReady.current) {
      sawReady.current = true
      setMode((m) => (m === 'draw' && !started ? 'code' : m))
    }
  }, [codeReady, started])

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
      isEmpty: () => (mode === 'draw' ? (padRef.current?.isEmpty() ?? true) : mode === 'code' ? !LIEN_SIGN_CODE_RE.test(code) : false),
      toDataURL: () => {
        if (mode !== 'draw') return null
        const pad = padRef.current
        if (!pad || pad.isEmpty()) return null
        return pad.toDataURL('image/png')
      },
      code: () => (mode === 'code' ? code : ''),
      clear: () => {
        padRef.current?.clear()
        setCode('')
        setStarted(false)
      },
    }),
    [mode, code],
  )

  const tag = mode === 'draw' ? (codeSigner ? `${codeSigner.firstName} signs here, in his own hand` : 'Sign here, on the line') : mode === 'code' ? `${codeSigner?.firstName ?? 'He'} signs here with his code` : 'Your signature, as it will print'
  const codeWords = codeSigner ? lienSignLineCodeWords(codeSigner) : null
  const canToggle = codeSigner ? codeReady : allowPress
  const toggleLabel = mode === 'draw' ? (codeSigner ? 'Code instead' : 'Press instead') : 'Draw instead'

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
          fontFamily: SYSTEM_FONT,
          fontSize: '0.72rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.1em 0.65em',
          whiteSpace: 'nowrap',
        }}
      >
        {tag}
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
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', pointerEvents: 'none', fontFamily: SYSTEM_FONT, fontSize: '0.8125rem', textAlign: 'center', padding: '0 1em' }}>
            {codeSigner ? `${codeSigner.firstName} draws with a finger or the mouse` : 'Draw with a finger or the mouse'}
          </span>
        ) : null}
      </div>
      <div style={{ borderTop: '1.5px solid var(--text-base)', paddingTop: '0.35em', lineHeight: 1.4, fontSize: compact ? '0.8125rem' : '0.875rem' }}>
        {under.filter((l) => l.trim()).map((l, i) => (i === 0 ? <strong key={l}>{l}</strong> : <span key={`${l}-${i}`}>, {l}</span>))}
      </div>
      {mode === 'code' && codeSigner ? (
        <div data-lien-sign-code-row style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem', fontFamily: SYSTEM_FONT }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <span>{codeSigner.firstName}’s signing code</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4,6}"
              maxLength={6}
              value={code}
              disabled={disabled}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-label={`${codeSigner.firstName}’s signing code`}
              style={{ font: 'inherit', fontSize: '1.05rem', letterSpacing: '0.25em', width: '7em', padding: '0.25rem 0.5rem', border: `1px solid ${codeProblem ? 'var(--text-red-600)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }}
            />
          </label>
          <span style={{ fontSize: '0.78rem', color: codeProblem ? 'var(--text-red-600)' : 'var(--text-muted)' }} data-lien-sign-code-words>
            {codeProblem ?? 'Four to six digits, his alone. The record names this screen.'}
          </span>
        </div>
      ) : codeWords && mode === 'draw' ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: SYSTEM_FONT }} data-lien-sign-code-words>
          {codeWords}
        </p>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{signedLabel}</span>
        <span style={{ display: 'flex', gap: '1rem' }}>
          {mode === 'draw' ? (
            <button type="button" disabled={disabled} onClick={() => { padRef.current?.clear(); setStarted(false) }} style={linkBtn}>
              Clear
            </button>
          ) : null}
          {canToggle ? (
            <button type="button" disabled={disabled} onClick={() => { setMode((m) => (m === 'draw' ? (codeSigner ? 'code' : 'type') : 'draw')); setStarted(false); setCode('') }} style={linkBtn} data-testid="lien-sign-line-toggle">
              {toggleLabel}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  )
})
