/**
 * A checklist per stage (punch list #164, PR 3): the sheet the crew fills for one stage of a job, from Job Mode or the
 * job window. Each question takes Yes, No or Not here, a note, and a photo where it asks for one; every press writes
 * at once, so a sheet closed early keeps what was answered. The photo is shrunk on the phone, named for the stage and
 * the question (`checklistPhotoName`), put in the bucket and filed in the customer's Drive folder by the photo-save
 * sweep; the sheet shows it as it waits and says when it is in the folder. The foot carries the rule: the stage reads
 * not ready on the Pipeline until every question is answered. The rules are `lib/jobs/stageChecklist.ts`.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { bytesWords, shrinkPhoto } from '../../lib/materials/photoShrink'
import {
  PICK_WORDS,
  STAGE_CHECKLIST_PICKS,
  answeredWords,
  checklistPhotoName,
  noQuestionsWords,
  questionWaitsOn,
  savedWords,
  sheetFootWords,
  stageChecklistKindOf,
  stageChecklistState,
  templateFor,
  waitsOnWords,
  type JobStageRef,
  type StageChecklistPick,
  type StageChecklistQuestion,
} from '../../lib/jobs/stageChecklist'
import type { AnswerWho, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CameraGlyph } from '../materials/PhotoPress'
import * as S from '../jobMode/sheetStyles'

export interface StageChecklistSheetProps {
  jobId: string
  stage: JobStageRef
  /** Every live question; the sheet picks the stage's kind out. */
  questions: readonly StageChecklistQuestion[]
  /** The stage's answers as read; the sheet keeps its own copy as presses land. */
  answers: readonly JobAnswer[]
  who: AnswerWho
  io: StageChecklistSheetIo
  /** Each saved answer, for the strip's count. */
  onAnswer: (answer: JobAnswer) => void
  onClose: () => void
}

const qBox: CSSProperties = { borderTop: '1px dashed var(--border)', padding: '0.7rem 0 0.2rem' }
const qWords: CSSProperties = { fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)', margin: '0 0 0.45rem' }
const chip: CSSProperties = { minHeight: 44, padding: '0 1rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }
const chipOn: Record<StageChecklistPick, CSSProperties> = {
  yes: { background: 'var(--bg-green-tint)', borderColor: '#16a34a', color: 'var(--text-green-800)' },
  no: { background: 'var(--bg-red-tint)', borderColor: '#dc2626', color: 'var(--text-red-700)' },
  not_here: { background: 'var(--bg-subtle)', borderColor: 'var(--text-muted)', color: 'var(--text-muted)' },
}
const noteStyle: CSSProperties = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.95rem' }
const waits: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-amber-700)', fontWeight: 600, margin: '0.35rem 0 0' }
const photoBtn: CSSProperties = { ...S.secondaryBtn, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44 }

export function StageChecklistSheet({ jobId, stage, questions, answers: given, who, io, onAnswer, onClose }: StageChecklistSheetProps) {
  const { showToast } = useToastContext()
  const kind = stageChecklistKindOf(stage.name)
  const template = useMemo(() => (kind ? templateFor(questions, kind) : []), [questions, kind])
  const [answers, setAnswers] = useState<JobAnswer[]>(() => [...given])
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const byQuestion = useMemo(() => new Map(answers.map((a) => [a.questionId, a])), [answers])
  const state = useMemo(() => stageChecklistState({ stageName: stage.name, questions, answers }), [stage.name, questions, answers])

  const land = (a: JobAnswer) => {
    setAnswers((prev) => [...prev.filter((x) => x.id !== a.id && x.questionId !== a.questionId), a])
    onAnswer(a)
  }
  const key = (q: StageChecklistQuestion) => ({ jobId, fixtureId: stage.fixtureId, questionId: q.id })

  const pick = async (q: StageChecklistQuestion, p: StageChecklistPick) => {
    setBusy(q.id)
    try {
      land(await io.pick(key(q), p, who))
    } catch (e) {
      showToast(`The answer was not saved. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const note = async (q: StageChecklistQuestion) => {
    const was = byQuestion.get(q.id)?.note ?? ''
    const next = (notes[q.id] ?? was).trim()
    if (next === was.trim()) return
    try {
      land(await io.note(key(q), next, who))
    } catch (e) {
      showToast(`The note was not saved. ${formatErrorMessage(e)}`, 'error')
    }
  }

  const foot = (
    <div style={{ width: '100%' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: state.ready ? 'var(--text-green-800)' : 'var(--text-amber-700)', fontWeight: 600 }} data-checklist-foot>
        {state.asked > 0 ? `${answeredWords(state)}. ${sheetFootWords(stage.name, state)}` : ''}
      </p>
      <div style={S.footerRow}>
        <button type="button" style={S.secondaryBtn} onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          style={state.ready ? S.primaryBtn : { ...S.primaryBtn, ...S.disabled }}
          disabled={!state.ready}
          onClick={() => {
            showToast(savedWords(stage.name, state), 'success')
            onClose()
          }}
        >
          Done
        </button>
      </div>
    </div>
  )

  return (
    <ResponsiveModalShell title={`${stage.name} checklist`} onRequestClose={onClose} footer={foot} maxWidthDesktop={520}>
      <div data-stage-checklist-sheet={stage.fixtureId}>
        {template.length === 0 ? (
          <p style={S.muted}>{noQuestionsWords(stage.name)}</p>
        ) : (
          <>
            <p style={S.muted}>Filled on site. Each press saves by itself.</p>
            {template.map((q, i) => {
              const a = byQuestion.get(q.id) ?? null
              const waitsOn = questionWaitsOn(q, a)
              return (
                <div key={q.id} data-checklist-question={q.id} style={i === 0 ? { ...qBox, borderTop: 'none' } : qBox}>
                  <p style={qWords}>
                    {i + 1}. {q.words}
                  </p>
                  <div role="group" aria-label={q.words} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {STAGE_CHECKLIST_PICKS.map((p) => (
                      <button key={p} type="button" aria-pressed={a?.pick === p} disabled={busy === q.id} style={a?.pick === p ? { ...chip, ...chipOn[p] } : chip} onClick={() => void pick(q, p)}>
                        {PICK_WORDS[p]}
                      </button>
                    ))}
                  </div>
                  {q.asksPhoto ? <PhotoRow stage={stage} question={q} answer={a} jobId={jobId} who={who} io={io} onAnswer={land} /> : null}
                  <input
                    type="text"
                    aria-label={`Note on: ${q.words}`}
                    placeholder="Add a note"
                    value={notes[q.id] ?? a?.note ?? ''}
                    maxLength={500}
                    onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                    onBlur={() => void note(q)}
                    style={{ ...noteStyle, marginTop: '0.45rem' }}
                  />
                  {waitsOn ? <p style={waits}>{waitsOnWords(waitsOn)}</p> : null}
                </div>
              )
            })}
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}

/** The photo a question asks for: the press, the shot as it waits, and the words once Drive has it. */
function PhotoRow({ stage, question, answer, jobId, who, io, onAnswer }: { stage: JobStageRef; question: StageChecklistQuestion; answer: JobAnswer | null; jobId: string; who: AnswerWho; io: StageChecklistSheetIo; onAnswer: (a: JobAnswer) => void }) {
  const { showToast } = useToastContext()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const photo = answer?.photo ?? null
  const storagePath = answer?.storagePath ?? null
  useEffect(() => {
    let live = true
    setUrl(null)
    if (!photo || photo.state === 'filed') return
    io.photoUrl(storagePath).then((u) => live && setUrl(u), () => live && setUrl(null))
    return () => {
      live = false
    }
  }, [io, photo, storagePath])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const takenAt = new Date().toISOString()
    setBusy('Shrinking…')
    try {
      const shot = await shrinkPhoto(f)
      const fileName = checklistPhotoName({ takenAt, stageName: stage.name, question: question.words })
      setBusy('Sending…')
      const saved = await io.photo({ jobId, fixtureId: stage.fixtureId, questionId: question.id, blob: shot.blob, fileName, takenAt }, who)
      onAnswer(saved)
      showToast(`Photo on its way to the customer's Drive folder, ${bytesWords(shot.blob.size)}.`, 'success')
    } catch (err) {
      showToast(`The photo was not taken. ${formatErrorMessage(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  const words = !photo ? null : photo.state === 'filed' ? 'In the customer’s Drive folder.' : photo.state === 'failed' ? photo.failWhy || 'Not filed yet.' : 'On its way to the customer’s Drive folder.'
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.45rem', flexWrap: 'wrap' }} data-checklist-photo>
      {url ? <img src={url} alt={photo?.fileName ?? 'The photo'} width={56} height={56} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} /> : null}
      <button type="button" style={photoBtn} disabled={busy != null} aria-label={`${photo ? 'Take the photo again' : 'Take the photo'}: ${question.words}`} onClick={() => input.current?.click()}>
        <CameraGlyph />
        {busy ?? (photo ? 'Take it again' : 'Take the photo')}
      </button>
      {words ? (
        <span style={{ fontSize: '0.8125rem', color: photo?.state === 'failed' ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: photo?.state === 'failed' ? 600 : 500 }}>{words}</span>
      ) : null}
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-hidden style={{ display: 'none' }} />
    </div>
  )
}

export default StageChecklistSheet
