/**
 * GC mode, Owner Billing's O7c: the customer of a GC job we build answers us in their portal. Each job shows the
 * change orders waiting on them, to sign or decline, and Accept the work once every line is billed; the Board's
 * B6-d-iii: our contract leads a job while it waits on them. The three forms live in `PortalGcForms.tsx`.
 *
 * The schedule's PR 15b: a job being built with a schedule drawn opens on *Your schedule* (`PortalGcSchedule`), the
 * picture `customer-portal` works out, words and dates only.
 *
 * Messages cut 8b-i: a job with its page block (`customer-portal`'s `page`) reads as the customer's page instead
 * (shape B, `PortalGcPage.tsx`); a job without one reads as before.
 */
import { formatPortalDate, type PortalGcJob, type PortalPayload } from '../../lib/portal/portalPayload'
import { HAIR, INK, MUTED, PAPER } from '../../lib/portal/portalTheme'
import { AcceptWork, ChangeOrderRow, OurContract } from './PortalGcForms'
import { PortalGcPage } from './PortalGcPage'
import { PortalGcSchedule } from './PortalGcSchedule'

export function PortalGcJobs({ token, jobs, formatUsd, payload }: { token: string; jobs: PortalGcJob[]; formatUsd: (n: number) => string; payload?: PortalPayload }) {
  if (jobs.length === 0) return null
  return (
    <div data-testid="portal-gc-jobs" data-screen-only style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      {jobs.map((job) =>
        // Messages cut 8b-i: a job with its page block reads as the customer's page (shape B); else as it did.
        job.page && payload ? (
          <PortalGcPage key={job.projectId} token={token} job={job} page={job.page} payload={payload} formatUsd={formatUsd} />
        ) : (
        <div key={job.projectId} style={{ border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: INK }}>{job.name}</div>
          {/* Their schedule opens a job being built (the schedule's PR 15b, call 7): its dates frame what follows. */}
          {job.schedule && <PortalGcSchedule schedule={job.schedule} />}
          {job.contract && <OurContract token={token} job={job} contract={job.contract} formatUsd={formatUsd} />}
          {job.changeOrders.map((co) => (
            <ChangeOrderRow key={co.id} token={token} co={co} formatUsd={formatUsd} />
          ))}
          {job.canAccept && <AcceptWork token={token} job={job} />}
          {job.accepted && (
            <div style={{ color: MUTED, borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>{`The work was accepted on ${formatPortalDate(job.accepted.on) ?? job.accepted.on}.`}</div>
          )}
        </div>
        ),
      )}
    </div>
  )
}

export default PortalGcJobs
