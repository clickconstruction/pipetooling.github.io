/**
 * A checklist door on the Pipeline row (punch list #246, PR 1): the sheet the row's icon opens, *Checklists on JP1088 ·
 * Riders Walk*, beside the row. Every stage of the job that takes a checklist reads with its chip, *Not ready · 3 of 6*
 * or *Ready · 4 of 4*, and under it the stage's own rows as the strip's sheet draws them (`StageChecklistSheet`,
 * inline): the progress line and bar, one row open at a time with Yes · No · Not here, the stamp, Add a note, the photo
 * where one is asked, and for whoever authors on the job + Add a check, Skip on this job, Take off and the arrows. So
 * the office answers in place under its own name, as it may on the strip's sheet. A ready stage folds to its chip, and
 * a press on the name opens or folds it. **Open on the job** at the foot goes to the window's Documents tab for the
 * rest: the skipped line, Add to the company's list. The read is the job's own (`useJobStageChecklists`), the one the
 * strip and Documents share, so a press here lands on every reader of the job at once; the board re-reads its marks
 * when the sheet closes, since its read is its own.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { DOOR_SHEET_WORDS, doorEmptyWords, doorSheetTitle } from '../../lib/jobs/pipelineChecklistDoor'
import { skippedFor } from '../../lib/jobs/stageChecklist'
import { asksMayAuthor, canAuthorOnJob, checklistsSummary, plansDoorUrl, stageStandingChip, type StandingTone } from '../../lib/jobs/stageChecklistItems'
import type { StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { StageChecklistSheet } from './StageChecklistSheet'

const meta: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const stageHead: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }
const nameButton: CSSProperties = { background: 'none', border: 'none', padding: 0, minHeight: 32, font: 'inherit', fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer', textAlign: 'left' }
const chipBase: CSSProperties = { padding: '0.05rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }
const chipTone: Record<StandingTone, CSSProperties> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  muted: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}
const openOnJob: CSSProperties = { ...S.primaryBtn, background: '#2563eb' }

export interface PipelineChecklistSheetProps {
  /** The job the row draws: its id, the title's label (`doorJobLabel`) and its Plans folder for a check's plan-sheet chip. */
  job: { id: string; label: string; job_plans_link?: string | null }
  io?: StageChecklistSheetIo
  onClose: () => void
  /** **Open on the job**: the window's Documents tab. The caller closes this sheet first. */
  onOpenDocuments: () => void
}

const noop = () => undefined

export function PipelineChecklistSheet({ job, io, onClose, onOpenDocuments }: PipelineChecklistSheetProps) {
  const { role, user, profileName } = useAuth()
  const read = useJobStageChecklists(job.id, io, 0, asksMayAuthor(role))
  const who = useMemo(() => ({ userId: user?.id ?? null, name: profileName ?? '' }), [user?.id, profileName])
  const canAuthor = canAuthorOnJob(role, read.mayAuthor)
  // The stages that take a checklist, with or without questions yet, so the office can add the first.
  const stages = useMemo(() => (read.rows ?? []).filter((r) => r.state.kind != null), [read.rows])
  const [folded, setFolded] = useState<Record<string, boolean> | null>(null)
  const plansUrl = plansDoorUrl(job.job_plans_link)

  // A ready stage folds to its chip, once, when the rows first read; the stages with a question left stand open.
  // Set in the render the rows arrive in, so the first frame already shows the fold: with an effect there was a frame
  // where every stage stood open, and a press that landed on it folded the stage instead (the render test raced it in CI).
  if (folded === null && read.rows) {
    const first: Record<string, boolean> = {}
    for (const r of stages) first[r.fixtureId] = r.state.standing === 'ready'
    setFolded(first)
  }

  const summary = checklistsSummary(stages, read.questions)
  const empty = doorEmptyWords()

  const foot = (
    <div style={{ width: '100%' }}>
      <p style={{ ...meta, margin: '0 0 0.5rem' }}>{DOOR_SHEET_WORDS.foot}</p>
      <div style={S.footerRow}>
        <button type="button" style={S.secondaryBtn} onClick={onClose}>
          {DOOR_SHEET_WORDS.close}
        </button>
        <button type="button" style={openOnJob} onClick={onOpenDocuments} data-pipeline-checklist-open-job>
          {DOOR_SHEET_WORDS.openOnJob} ›
        </button>
      </div>
    </div>
  )

  return (
    <ResponsiveModalShell title={doorSheetTitle(job.label)} onRequestClose={onClose} footer={foot} maxWidthDesktop={560}>
      <div data-pipeline-checklist-sheet={job.id}>
        {summary ? (
          <p style={meta} data-pipeline-checklist-summary>
            {summary}
          </p>
        ) : null}
        {read.failure ? (
          <OfflineRetryPanel failure={read.failure} onRetry={read.reload} surface="pipeline-checklist-sheet" idempotent busy={read.loading} />
        ) : read.rows == null ? (
          <p style={meta}>{DOOR_SHEET_WORDS.loading}</p>
        ) : stages.length === 0 ? (
          <EmptyState compact main={empty.main} next={{ label: DOOR_SHEET_WORDS.openOnJob, onPress: onOpenDocuments }} tail={empty.tail} />
        ) : (
          stages.map((stage) => {
            const skippedCount = stage.state.kind ? skippedFor(read.questions, stage.state.kind, stage.fixtureId).length : 0
            const chip = stageStandingChip(stage.state, skippedCount)
            const isFolded = folded?.[stage.fixtureId] ?? false
            return (
              <section key={stage.fixtureId} data-pipeline-checklist-stage={stage.fixtureId} data-standing={stage.state.standing} aria-label={`${stage.name} · ${chip.words}`}>
                <div style={stageHead}>
                  <button type="button" style={nameButton} aria-expanded={!isFolded} onClick={() => setFolded((f) => ({ ...(f ?? {}), [stage.fixtureId]: !(f?.[stage.fixtureId] ?? false) }))}>
                    {stage.name}
                  </button>
                  <span style={{ ...chipBase, ...chipTone[chip.tone] }}>{chip.words}</span>
                </div>
                {isFolded ? (
                  <p style={meta}>{DOOR_SHEET_WORDS.folded}</p>
                ) : (
                  <StageChecklistSheet
                    frame="inline"
                    jobId={job.id}
                    stage={{ fixtureId: stage.fixtureId, name: stage.name, sequenceOrder: stage.sequenceOrder }}
                    questions={read.questions}
                    answers={read.answersByFixture.get(stage.fixtureId) ?? []}
                    who={who}
                    role={role}
                    canAuthor={canAuthor}
                    plansUrl={plansUrl}
                    io={read.io}
                    onAnswer={read.putAnswer}
                    onQuestionAdded={read.putQuestion}
                    onQuestionRetired={read.dropQuestion}
                    onQuestionsChanged={read.putQuestions}
                    onClose={noop}
                  />
                )}
              </section>
            )
          })
        )}
      </div>
    </ResponsiveModalShell>
  )
}

export default PipelineChecklistSheet
