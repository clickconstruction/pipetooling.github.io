/**
 * Before we start, on the job window's Documents tab (punch list #382, PR 4): the job's stages, each with the list
 * of what must be true before the crew goes. It stands beside the stage checklists, so there is one place to write
 * a stage's lists: this one for before we start, that one for at the stage. Each stage is a line with its ready bar,
 * and opens to the four lines and the two lists (`StartCheckStage`). A person who is not on the job's desk sees no
 * section. Nothing here reaches the GC, and nothing blocks a stage.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobStartChecks, type StartChecksJob } from '../../hooks/useJobStartChecks'
import { useSiteIsFar } from '../../hooks/useSiteIsFar'
import { isOfficeRole } from '../../lib/doorRoles'
import { stageChecklistKindOf } from '../../lib/jobs/stageChecklist'
import type { JobWindowTabKey } from '../../lib/jobs/jobHistoryTab'
import { daySpan, readiness, readyMarks, stageStanding } from '../../lib/startChecks/startChecks'
import { START_CHECK_WORDS as W } from '../../lib/startChecks/startCheckRows'
import type { StartChecksIo } from '../../lib/startChecks/startChecksIo'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ReadyPercent } from '../startChecks/ReadyBar'
import { StartCheckStage } from '../startChecks/StartCheckStage'
import { documentsHeading } from './jobDocumentsStyles'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const card: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.75rem' }
const stageHead: CSSProperties = { display: 'flex', gap: '0.5rem 0.75rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', margin: 0, padding: 0, border: 'none', background: 'none', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', minHeight: 32 }

/** The roles that write our window, as the table's own policy has it. */
const WINDOW_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

export type JobDocumentsStartChecksJob = {
  id: string
  hcp_number?: string | null
  click_number?: string | null
  job_address?: string | null
  customer_name?: string | null
  development_id?: string | null
  bid_id?: string | null
  gcName?: string | null
  job_name?: string | null
  /** The customer whose thread an ask opens in Messages: the job's GC, or its customer. */
  askCustomerId?: string | null
}

export function JobDocumentsStartChecks({ job, io, onRequestTab, todayYmd }: { job: JobDocumentsStartChecksJob; io?: StartChecksIo; onRequestTab?: (tab: JobWindowTabKey) => void; todayYmd?: string }) {
  const { role, user, profileName } = useAuth()
  const today = todayYmd ?? todayYmdInAppTz()
  // The site's distance is read only when the default notice needs it: for a person on the desk, on a job with a
  // stage line, whose notice nobody has set.
  const [wantsFar, setWantsFar] = useState(false)
  const far = useSiteIsFar(job.job_address, wantsFar)
  const startJob = useMemo<StartChecksJob>(
    () => ({ id: job.id, label: (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.id.slice(0, 8), developmentId: job.development_id ?? null, bidId: job.bid_id ?? null, gcName: job.gcName ?? null, customerName: job.customer_name ?? null }),
    [job.id, job.hcp_number, job.click_number, job.development_id, job.bid_id, job.gcName, job.customer_name],
  )
  const read = useJobStartChecks(startJob, { io, far })
  const me = useMemo(() => ({ userId: user?.id ?? null, name: profileName ?? '' }), [user?.id, profileName])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const needsFar = read.onDesk === true && read.lines.length > 0 && !read.notice.own
  useEffect(() => {
    if (needsFar) setWantsFar(true)
  }, [needsFar])

  // Not on this job's desk: no section. The database decides, so the screen never offers a press it would refuse.
  if (read.onDesk !== true) return null

  const office = isOfficeRole(role)
  const can = { window: WINDOW_ROLES.has(role ?? ''), notice: read.notice.home === 'job' || office, company: office }
  const noticeKey = job.development_id ? { developmentId: job.development_id } : { jobId: job.id }

  return (
    <section aria-labelledby="job-documents-start-checks" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} data-testid="job-documents-start-checks">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-start-checks" style={documentsHeading}>
          {W.heading}
        </h3>
        <span style={muted}>{W.lead}</span>
      </div>
      {read.failure ? (
        <OfflineRetryPanel failure={read.failure} onRetry={read.reload} surface="job-documents-start-checks" idempotent busy={read.loading} />
      ) : read.loading && read.lines.length === 0 ? (
        <p style={muted}>Loading…</p>
      ) : read.lines.length === 0 ? (
        <EmptyState
          compact
          {...(onRequestTab
            ? { main: 'No stage lines on this job yet.', next: { label: 'Bill', onPress: () => onRequestTab('bill') }, tail: 'is the tab that adds one.' }
            : { main: 'No stage lines on this job yet. The Bill tab adds one.' })}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {read.stages.map((stage, i) => {
            const line = read.lines[i]
            if (!line) return null
            const standing = stageStanding(stage, read.site, today)
            const ready = readiness(stage.bullets)
            const isOpen = open[stage.id] ?? false
            return (
              <div key={stage.id} style={card} data-start-check-card={stage.id} data-light={standing.light}>
                <button type="button" style={stageHead} aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [stage.id]: !isOpen }))}>
                  <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{stage.name}</span>
                  <span style={muted}>{stage.window ? daySpan(stage.window[0], stage.window[1]) : 'no days yet'}</span>
                  <ReadyPercent marks={readyMarks(stage)} pct={ready.pct} urgent={standing.light === 'red'} />
                  <span style={{ ...muted, marginLeft: 'auto' }}>{isOpen ? 'Close' : stage.bullets.length ? 'Open' : 'Write the list'}</span>
                </button>
                {isOpen ? (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    {stage.finished ? <p style={{ ...muted, margin: '0 0 8px' }}>This stage is finished.</p> : null}
                    <StartCheckStage stage={stage} line={line} rows={read.rows} site={read.site} notice={read.notice} noticeKey={noticeKey} today={today} me={me} kind={stageChecklistKindOf(stage.name)} templates={read.templates} can={can} press={read.press} io={read.io} ask={{ jobId: job.id, jobName: (job.job_name ?? '').trim() || startJob.label, customerId: job.askCustomerId ?? null }} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default JobDocumentsStartChecks
