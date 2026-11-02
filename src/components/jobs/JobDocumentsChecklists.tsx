/**
 * Stage checklists on the job window's Documents tab (punch list #237, PR 1): the office's one read-out. Each of
 * the job's stages that takes a checklist (Rough In, Top Out, Trim Set) reads with its standing, *Ready · 4 of 4* or
 * *Not ready · 3 of 6*, and every question with its pick, who answered and when, the note, where the photo is, and
 * *open* for what is unanswered. An item added for this job carries a *this job* tag and who added it; the office
 * adds one inline with *+ Add a check for Trim Set* (the sheet's add box) and takes one off with two presses, its
 * answer kept. A ready stage folds to one line on a phone; a press on a stage's name opens or folds it. The office
 * answers on the sheet under the window's address, as the crew does; this section reads. The rules are
 * `lib/jobs/stageChecklist.ts` and `stageChecklistItems.ts`; the read is `useJobStageChecklists`, the one the strip
 * uses, whose readers on a job move together: a check added here counts on the strip at once, and an answer on the
 * strip's sheet lands here.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { useToastContext } from '../../contexts/ToastContext'
import { addedByWords, isJobItem, noQuestionsWords, stageChecklistState, templateFor, type JobStageChecklist, type StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import { READOUT_FOOT, TAKE_OFF_WORDS, addCheckWords, addedWords, canAddJobItem, canTakeOffJobItem, checklistsSummary, rowAsksPhotoTag, rowGlyph, rowMetaWords, rowPickWords, stageStandingChip, takenOffWords, type StandingTone } from '../../lib/jobs/stageChecklistItems'
import type { JobWindowTabKey } from '../../lib/jobs/jobHistoryTab'
import type { StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { AddCheckBox } from '../stageChecklists/StageChecklistSheet'
import { documentsChip, documentsHeading, documentsLinkButton, documentsQuietButton } from './jobDocumentsStyles'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const chipTone: Record<StandingTone, CSSProperties> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  muted: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}
const jobTag: CSSProperties = { ...documentsChip, background: 'var(--bg-blue-200)', color: 'var(--text-blue-700)' }
const photoTag: CSSProperties = { ...documentsChip, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1.25rem minmax(0, 1fr) auto', gap: '0.15rem 0.5rem', alignItems: 'start', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }
const quiet: CSSProperties = { ...link, color: 'var(--text-muted)', fontWeight: 500 }
const glyphTone = (pick: string | null | undefined): CSSProperties => ({ fontWeight: 700, color: pick === 'yes' ? 'var(--text-green-700)' : pick === 'no' ? 'var(--text-red-700)' : 'var(--text-muted)' })

export function JobDocumentsChecklists({ job, io, onRequestTab }: { job: { id: string }; io?: StageChecklistSheetIo; onRequestTab?: (tab: JobWindowTabKey) => void }) {
  const { role, user, profileName } = useAuth()
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const read = useJobStageChecklists(job.id, io)
  const who = useMemo(() => ({ userId: user?.id ?? null, name: profileName ?? '' }), [user?.id, profileName])
  const canAdd = canAddJobItem(role)
  // The stages that take a checklist, with or without questions yet, so the office can add the first check.
  const stages = useMemo(() => (read.rows ?? []).filter((r) => r.state.kind != null), [read.rows])
  const [folded, setFolded] = useState<Record<string, boolean> | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [takingOff, setTakingOff] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // A ready stage folds to one line on a phone, once, when the rows first read; the desk shows every row.
  useEffect(() => {
    if (folded || !read.rows) return
    const first: Record<string, boolean> = {}
    for (const r of stages) first[r.fixtureId] = isMobile && r.state.standing === 'ready'
    setFolded(first)
  }, [folded, read.rows, stages, isMobile])

  const failure = read.failure
  const summary = checklistsSummary(stages, read.questions)

  const takeOff = async (stage: JobStageChecklist, q: StageChecklistQuestion) => {
    setBusy(q.id)
    try {
      await read.io.retireItem(q.id, who)
      read.dropQuestion(q.id)
      setTakingOff(null)
      const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: read.questions.filter((x) => x.id !== q.id), answers: read.answersByFixture.get(stage.fixtureId) ?? [] })
      showToast(takenOffWords(stage.name, after), 'success')
    } catch (e) {
      showToast(`The check was not taken off. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="job-documents-checklists" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="job-documents-checklists">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-checklists" style={documentsHeading}>
          Stage checklists
        </h3>
        {summary ? (
          <span style={muted} data-testid="job-documents-checklists-summary">
            {summary}
          </span>
        ) : null}
      </div>
      {failure ? (
        <OfflineRetryPanel failure={failure} onRetry={read.reload} surface="job-documents-checklists" idempotent busy={read.loading} />
      ) : read.rows == null ? (
        <p style={muted}>Loading…</p>
      ) : stages.length === 0 ? (
        <EmptyState
          compact
          {...(onRequestTab
            ? { main: 'No stages take a checklist on this job.', next: { label: 'Bill', onPress: () => onRequestTab('bill') }, tail: 'is the tab that adds a stage line named Rough In, Top Out or Trim Set.' }
            : { main: 'No stages take a checklist on this job. A stage line named Rough In, Top Out or Trim Set on the Bill tab gets one.' })}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {stages.map((stage) => {
            const kind = stage.state.kind!
            const template = templateFor(read.questions, kind, stage.fixtureId)
            const answers = new Map((read.answersByFixture.get(stage.fixtureId) ?? []).map((a) => [a.questionId, a]))
            const chip = stageStandingChip(stage.state)
            const isFolded = folded?.[stage.fixtureId] ?? false
            const words = addCheckWords(stage.name)
            return (
              <div key={stage.fixtureId} data-testid="job-documents-checklist-stage" data-standing={stage.state.standing}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" style={documentsLinkButton} aria-expanded={!isFolded} onClick={() => setFolded((f) => ({ ...(f ?? {}), [stage.fixtureId]: !isFolded }))}>
                    {stage.name}
                  </button>
                  <span style={{ ...documentsChip, marginLeft: 0, ...chipTone[chip.tone] }}>{chip.words}</span>
                </div>
                {isFolded ? null : (
                  <div style={{ marginTop: '0.25rem' }}>
                    {template.map((q, i) => {
                      const a = answers.get(q.id) ?? null
                      const pickWords = rowPickWords(q, a)
                      // The answer's words, then who added it: an item says its adder after it is answered too.
                      const metaWords = [a?.pick ? `${pickWords} · ${rowMetaWords(a)}` : '', addedByWords(q, who.userId)].filter(Boolean).join(' · ')
                      const mayTakeOff = canTakeOffJobItem(role, q, who.userId)
                      return (
                        <div key={q.id} style={rowStyle} data-testid="job-documents-checklist-row" data-pick={a?.pick ?? 'open'}>
                          <span style={glyphTone(a?.pick)} aria-hidden>
                            {rowGlyph(a)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div>
                              <span style={{ fontWeight: a?.pick ? 500 : 600, color: a?.pick ? 'var(--text-strong)' : 'var(--text-amber-800)' }}>
                                {a?.pick ? '' : `${pickWords} · `}
                              </span>
                              <span>
                                {i + 1}. {q.words}
                              </span>
                              {isJobItem(q) ? <span style={jobTag}>this job</span> : null}
                              {rowAsksPhotoTag(q, a) ? <span style={photoTag}>asks for a photo</span> : null}
                            </div>
                            <div style={muted}>{metaWords}</div>
                            {takingOff === q.id ? (
                              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }} data-testid="job-documents-checklist-take-off">
                                <span style={muted}>{TAKE_OFF_WORDS.hint}</span>
                                <button type="button" style={documentsQuietButton} disabled={busy === q.id} onClick={() => void takeOff(stage, q)}>
                                  {TAKE_OFF_WORDS.confirm}
                                </button>
                                <button type="button" style={quiet} onClick={() => setTakingOff(null)}>
                                  {TAKE_OFF_WORDS.keep}
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            {mayTakeOff && takingOff !== q.id ? (
                              <button type="button" style={quiet} onClick={() => setTakingOff(q.id)} aria-label={`${TAKE_OFF_WORDS.press}: ${q.words}`}>
                                {TAKE_OFF_WORDS.press}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                    {template.length === 0 && adding !== stage.fixtureId ? (
                      <EmptyState compact {...(canAdd ? { main: 'No questions yet.', next: { label: words.press, onPress: () => setAdding(stage.fixtureId) }, tail: 'adds the first for this job.' } : { main: noQuestionsWords(stage.name) })} />
                    ) : null}
                    {canAdd ? (
                      adding === stage.fixtureId ? (
                        <AddCheckBox
                          stageName={stage.name}
                          onCancel={() => setAdding(null)}
                          onAdd={async (text, asksPhoto) => {
                            const q = await read.io.addItem({ jobId: job.id, fixtureId: stage.fixtureId, kind, words: text, asksPhoto }, who)
                            read.putQuestion(q)
                            setAdding(null)
                            const after = stageChecklistState({ stageName: stage.name, fixtureId: stage.fixtureId, questions: [...read.questions, q], answers: read.answersByFixture.get(stage.fixtureId) ?? [] })
                            showToast(addedWords(stage.name, after), 'success')
                          }}
                        />
                      ) : template.length > 0 ? (
                        <button type="button" style={{ ...link, marginTop: '0.35rem', ...(isMobile ? { minHeight: 44 } : {}) }} onClick={() => setAdding(stage.fixtureId)}>
                          {words.press}
                        </button>
                      ) : null
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
          <p style={muted}>{READOUT_FOOT}</p>
        </div>
      )}
    </section>
  )
}

export default JobDocumentsChecklists
