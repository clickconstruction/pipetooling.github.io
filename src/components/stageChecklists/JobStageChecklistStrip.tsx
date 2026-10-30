/**
 * A checklist per stage (punch list #164, PR 3): the strip of a job's stages on Job Mode's details and under the job
 * window's address. Each stage with a checklist is one press, *Rough In · 2 of 3 answered, not ready* or *Checklist
 * filled*, opening its sheet. A stage whose kind has no questions is not listed, and a job with none draws nothing,
 * so the window stands exactly as before until the office types the questions.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobStageChecklists } from '../../hooks/useJobStageChecklists'
import { jobHasChecklists, stageChecklistLine, standingWords, type JobStageChecklist } from '../../lib/jobs/stageChecklist'
import type { StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { StageChecklistSheet } from './StageChecklistSheet'

const label: CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }
const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '0.1rem 0.6rem',
  alignItems: 'center',
  width: '100%',
  minHeight: 44,
  textAlign: 'left',
  padding: '0.45rem 0.7rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  cursor: 'pointer',
}
const tag: Record<'ready' | 'not_ready', CSSProperties> = {
  ready: { fontSize: '0.75rem', fontWeight: 700, padding: '0 0.5rem', borderRadius: 999, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', whiteSpace: 'nowrap' },
  not_ready: { fontSize: '0.75rem', fontWeight: 700, padding: '0 0.5rem', borderRadius: 999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', whiteSpace: 'nowrap' },
}

export function JobStageChecklistStrip({ jobId, io, rev = 0 }: { jobId: string | null | undefined; io?: StageChecklistSheetIo; rev?: number }) {
  const { user, profileName } = useAuth()
  const read = useJobStageChecklists(jobId, io, rev)
  const [open, setOpen] = useState<JobStageChecklist | null>(null)
  const who = useMemo(() => ({ userId: user?.id ?? null, name: profileName ?? '' }), [user?.id, profileName])
  const rows = read.rows
  if (!jobId || !rows || !jobHasChecklists(rows)) return null
  const listed = rows.filter((r) => r.state.standing !== 'none')
  const current = open ? rows.find((r) => r.fixtureId === open.fixtureId) ?? open : null
  return (
    <div data-job-stage-checklists style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
      <span style={label}>Stage checklists</span>
      {listed.map((r) => (
        <button key={r.fixtureId} type="button" style={row} onClick={() => setOpen(r)} aria-label={`${r.name} checklist: ${stageChecklistLine(r.state)}`} data-stage-checklist-row={r.state.standing}>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
          <span style={tag[r.state.standing === 'ready' ? 'ready' : 'not_ready']}>{standingWords(r.state)}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>{stageChecklistLine(r.state)}</span>
        </button>
      ))}
      {current ? (
        <StageChecklistSheet
          jobId={jobId}
          stage={{ fixtureId: current.fixtureId, name: current.name, sequenceOrder: current.sequenceOrder }}
          questions={read.questions}
          answers={read.answersByFixture.get(current.fixtureId) ?? []}
          who={who}
          io={read.io}
          onAnswer={read.putAnswer}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  )
}

export default JobStageChecklistStrip
