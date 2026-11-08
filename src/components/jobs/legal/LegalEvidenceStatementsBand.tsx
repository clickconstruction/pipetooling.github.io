/**
 * Signed hours statements under a job's row on the Legal desk's Evidence tab (punch list #212, PR 4, v2.6413): the
 * statements made for the job with their record, worker, period, hours and where they stand, **Add to evidence** on a
 * signed one not yet on the matter (the signed PDF copied into `legal_matter_documents`, the statement tied to it),
 * **Show on Evidence ↗** once it is, and **Ask <name>…** per worker who clocked here and per sub on the job's sheets
 * (v2.6660; a sub never punches, so the window reads their sheets), which opens the Hours statement window on the job
 * with that worker picked. A gap job — nothing clocked, no sheet, and the work before the app's first day — says so and
 * asks no one: a statement there would be the worker's own. A viewer the statements' policy answers nothing
 * (not a dev or the controller) reads who can see them, not *Nothing signed here yet* (v2.6633). Words and the orchestration are
 * `lib/legal/hoursStatementEvidence.ts` and `legalPacket.ts`; the band draws and the tab does the calls.
 */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { hoursStatementEvidenceProblem } from '../../../lib/legal/hoursStatementEvidence'
import { legalAskWorkerTitle, legalGapJobWords, legalStatementsWords, type LegalEvidenceJob } from '../../../lib/legal/legalPacket'
import { hoursStatementStateWords, isHoursStatementState } from '../../../lib/people/hoursStatementRecord'
import { MUTED, btn } from './legalDeskShared'
import { EmptyState } from '../../EmptyState'

const dead: CSSProperties = { ...btn, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }

export type LegalEvidenceStatementsActs = {
  /** The Hours statement window on this job, the worker picked. */
  ask: (jobId: string, userId: string | null) => void
  /** Copy the signed PDF onto the matter. */
  addToEvidence: (jobId: string, statementId: string) => void
  /** The Evidence row the copy landed on. */
  showOnEvidence: (matterDocumentId: string) => void
  /** The statement in flight, or null. */
  busy: string | null
}

export function LegalEvidenceStatementsBand({ job, firstRecordedDay, matter, canAsk, acts }: { job: Pick<LegalEvidenceJob, 'jobId' | 'jobLabel' | 'statements' | 'workers' | 'beforeTheApp'>; firstRecordedDay: string | null; matter: { id: string | null; canEdit: boolean }; /** The viewer may make a statement (`canMakeHoursStatement`); otherwise the band only reads. */ canAsk: boolean; acts: LegalEvidenceStatementsActs | null }) {
  const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', fontSize: '0.8rem' }
  return (
    <div data-legal-statements={job.jobId} style={{ display: 'grid', gap: 6, padding: '4px 0 6px' }}>
      <div style={row}>
        <b>Signed statements</b>
        <span style={MUTED}>{job.beforeTheApp ? legalGapJobWords(firstRecordedDay) : legalStatementsWords(job.statements, { canRead: canAsk })}</span>
      </div>
      {job.statements.map((s) => {
        const state = isHoursStatementState(s.state) ? hoursStatementStateWords(s.state) : hoursStatementStateWords('draft')
        const problem = hoursStatementEvidenceProblem(s, matter)
        const inFlight = acts?.busy === s.id
        return (
          <div key={s.id} data-legal-statement={s.recordId} style={row}>
            <span>
              <b>{s.recordId}</b> · {s.workerName} · {s.periodLabel} · {s.hours % 1 === 0 ? s.hours : s.hours.toFixed(1)} h{s.statedDays ? <span style={MUTED}> · {s.statedDays} stated by the worker</span> : null}
            </span>
            <span style={{ ...MUTED, fontStyle: 'italic' }}>{state.label}</span>
            {s.matterDocumentId ? (
              <button type="button" style={btn} onClick={() => acts?.showOnEvidence(s.matterDocumentId as string)} disabled={!acts} title="The copy on the matter's Evidence tab">
                Show on Evidence ↗
              </button>
            ) : s.signed && canAsk ? (
              <button type="button" style={problem || !acts || inFlight ? dead : btn} disabled={Boolean(problem) || !acts || Boolean(acts?.busy)} title={problem ?? 'Copies the signed PDF onto the matter, where the firm reads it with the documents from the office'} onClick={() => acts?.addToEvidence(job.jobId, s.id)} aria-label={`Add ${s.recordId} to evidence`}>
                {inFlight ? 'Adding…' : 'Add to evidence'}
              </button>
            ) : null}
          </div>
        )
      })}
      {canAsk && !job.beforeTheApp ? (
        <div style={row}>
          {job.workers.length === 0 ? <EmptyState compact main="Nobody has an approved session or a sheet here yet, so there is no one to ask." /> : null}
          {job.workers.map((w) => (
            <button key={w.userId} type="button" style={acts ? btn : dead} disabled={!acts} onClick={() => acts?.ask(job.jobId, w.userId)} title={legalAskWorkerTitle(job.jobLabel, w)} aria-label={`Ask ${w.name} for a signed statement`}>
              Ask {w.name}…{w.kind === 'sheet' ? <span style={{ ...MUTED, fontWeight: 400 }}> on the sheets</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default LegalEvidenceStatementsBand
