/**
 * The signature sheet (punch list #237, PR 2): opens over the stage checklist sheet when the crew presses Yes, No or
 * Not here on a check the author marked *needs a signature*. It says what is being claimed and who will read it (the
 * gravity words), takes the printed name and the mark, typed or drawn over `SignatureTypeOrDrawInput` (v2.3159), a
 * note (a signed No asks for one), and the agreed line *I did this check myself and the answer is true*. **Sign and
 * save** hands the sheet one input; the sheet writes the pick and the signature in one press through the outbox, so a
 * signature on one bar of signal still lands. The rules and the words are `lib/jobs/stageChecklistSignature.ts`; the
 * record follows `lienNoticeSignature.ts`: the record, not the mark.
 *
 * `SignatureMark` draws a signed row's mark: the ink for a drawn signature, the name in the cursive face for a typed one.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { SignatureTypeOrDrawInput, type SignatureMode, type SignatureTypeOrDrawHandle } from '../contracts/SignatureTypeOrDrawInput'
import { ESTIMATE_ACCEPT_SIGNATURE_FONT } from '../estimates/EstimateAcceptTypedSignatureLine'
import type { ChecklistSignature, JobStageRef, StageChecklistPick, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import { AGREED_LINE, SIGN_WORDS, signProblem, signingWords, type SignInput } from '../../lib/jobs/stageChecklistSignature'
import type { AnswerWho } from '../../lib/jobs/stageChecklistSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import * as S from '../jobMode/sheetStyles'

const gravity: CSSProperties = { fontSize: '1rem', lineHeight: 1.45, color: 'var(--text-strong)', margin: '0 0 0.75rem', padding: '0.6rem 0.75rem', borderRadius: 10, background: 'var(--bg-subtle)' }
const field: CSSProperties = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '1rem' }
const agree: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.9375rem', color: 'var(--text-strong)', minHeight: 44, marginTop: '0.75rem' }
const hint: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }
const problemLine: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-amber-700)', fontWeight: 600, margin: '0.5rem 0 0' }

export interface ChecklistSignatureSheetProps {
  stage: JobStageRef
  /** The job as the gravity words name it: its number, or *this job*. */
  jobLabel?: string
  question: StageChecklistQuestion
  pick: StageChecklistPick
  /** The note already on the row, if any, so a reopened row keeps its words. */
  note?: string
  who: AnswerWho
  /** The press: resolves once the answer is signed or kept on the phone; throws with its reason otherwise. */
  onSign: (input: SignInput) => Promise<void>
  onClose: () => void
}

export function ChecklistSignatureSheet({ stage, jobLabel = 'this job', question, pick, note: given = '', who, onSign, onClose }: ChecklistSignatureSheetProps) {
  const [printedName, setPrintedName] = useState(who.name.trim())
  const [note, setNote] = useState(given)
  const [agreed, setAgreed] = useState(false)
  const [mode, setMode] = useState<SignatureMode>('type')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pad = useRef<SignatureTypeOrDrawHandle>(null)
  const words = signingWords(pick, question.words, jobLabel, stage.name)

  const submit = async () => {
    if (busy) return
    const input: SignInput = { pick, note, printedName, agreed, mode, drawnPng: mode === 'draw' ? pad.current?.toDataURL() ?? null : null }
    const stop = signProblem(input)
    setProblem(stop)
    if (stop) return
    setBusy(true)
    try {
      await onSign(input)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The answer was not signed.'))
      setBusy(false)
    }
  }

  const foot = (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={onClose} disabled={busy}>
        {SIGN_WORDS.notNow}
      </button>
      <button type="button" style={busy ? { ...S.primaryBtn, ...S.disabled } : S.primaryBtn} onClick={() => void submit()} disabled={busy} data-checklist-sign-confirm>
        {busy ? SIGN_WORDS.busy : SIGN_WORDS.confirm}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={SIGN_WORDS.title} onRequestClose={onClose} footer={foot} maxWidthDesktop={520} zIndex={1200}>
      <div data-checklist-signature-sheet={question.id}>
        <p style={{ ...S.muted, margin: '0 0 0.5rem' }}>
          {stage.name} · {jobLabel}
        </p>
        <p style={gravity} data-checklist-signing-words>
          {words.before}
          <strong>{words.pick}</strong>
          {words.after}
        </p>
        <label style={{ display: 'block' }}>
          <span style={{ ...hint, display: 'block', margin: '0 0 0.25rem' }}>{SIGN_WORDS.name}</span>
          <input type="text" value={printedName} maxLength={120} placeholder={SIGN_WORDS.namePlaceholder} autoComplete="name" onChange={(e) => setPrintedName(e.target.value)} style={field} data-checklist-sign-name />
        </label>
        <SignatureTypeOrDrawInput ref={pad} mode={mode} onModeChange={(m) => { setMode(m); setProblem(null) }} printedName={printedName} placeholderName={SIGN_WORDS.namePlaceholder} align="left" maxWidth={460} disabled={busy} />
        <label style={{ display: 'block', marginTop: '0.75rem' }}>
          <span style={{ ...hint, display: 'block', margin: '0 0 0.25rem' }}>{pick === 'no' ? SIGN_WORDS.noteNo : SIGN_WORDS.note}</span>
          <input type="text" value={note} maxLength={500} placeholder={SIGN_WORDS.notePlaceholder} onChange={(e) => setNote(e.target.value)} style={field} aria-label={pick === 'no' ? SIGN_WORDS.noteNo : SIGN_WORDS.note} />
        </label>
        <label style={agree}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: '0.25rem' }} data-checklist-sign-agree />
          <span>{AGREED_LINE}</span>
        </label>
        <p style={hint}>{SIGN_WORDS.lockHint}</p>
        {problem ? (
          <p style={problemLine} role="alert">
            {problem}
          </p>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}

/**
 * A signed row's mark: the trimmed ink for a drawn signature (read through `inkUrl`), the printed name in the cursive
 * face for a typed one. Small on a statement row, larger on the open row. The mark is how the signature looks; the
 * record is the row.
 */
export function SignatureMark({ signature, inkUrl, size = 'small' }: { signature: ChecklistSignature; inkUrl: (path: string | null | undefined) => Promise<string | null>; size?: 'small' | 'large' }) {
  const [url, setUrl] = useState<string | null>(null)
  const path = signature.mode === 'draw' ? signature.storagePath : null
  useEffect(() => {
    let live = true
    setUrl(null)
    if (!path) return
    inkUrl(path).then((u) => live && setUrl(u), () => live && setUrl(null))
    return () => {
      live = false
    }
  }, [inkUrl, path])
  const height = size === 'small' ? 28 : 56
  if (path && url) {
    return <img src={url} alt={`Signed by ${signature.printedName}`} style={{ display: 'block', height, maxWidth: size === 'small' ? 140 : 280, objectFit: 'contain', objectPosition: 'left', background: 'rgb(255, 255, 255)', borderRadius: 4, padding: '0 0.2rem' }} data-checklist-mark="draw" />
  }
  return (
    <span style={{ display: 'inline-block', fontFamily: ESTIMATE_ACCEPT_SIGNATURE_FONT, fontSize: size === 'small' ? '1.25rem' : '2rem', lineHeight: 1.1, color: 'var(--text-strong)' }} aria-label={`Signed by ${signature.printedName}`} data-checklist-mark={signature.mode}>
      {signature.printedName}
    </span>
  )
}

export default ChecklistSignatureSheet
