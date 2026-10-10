import type { CSSProperties } from 'react'
import { checklistJobModalPreset } from '../../lib/checklistJobPreset'
import { showTaskDispatchButton } from '../../lib/headerTaskDispatchEstimatorEligible'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { telHrefFor } from '../../lib/phoneContact'
import { scheduleDispatchWeekUrl } from '../../lib/scheduleDispatchDayLink'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesRowRenderContext } from './jobsStagesRowShared'

/** Moved out of `jobsStagesRowShared.tsx` in v2.5109 (the Stages map's step 9); the body is the old render function's, verbatim. */

/**
 * The row's quick-action icon stack — schedule (green), week dispatch (blue),
 * call customer (teal, when a phone is on file), send to Dispatch (sky), and
 * send-as-task (purple). Lived at the left edge of the Activity cell until
 * v2.1530; now renders at the left edge of the Crew & Dates cell in both
 * Stages tables (owner request — the mobile card list has its own shortcut row).
 * The ✍ contract door (v2.2681) left the stack in v2.4324: the contract chip
 * under the job opens the same window and says where the contract stands.
 */
export function StagesQuickActionsStack({ ctx, job }: { ctx: StagesRowRenderContext; job: JobWithDetails }) {
  const {
    canOpenJobScheduleModal,
    openQuickAssignForJob,
    navigate,
    authRole,
    dispatchTaskModal,
    checklistAddModal,
  } = ctx
  const scheduleNoTeam = (job.team_members?.length ?? 0) === 0
  const quickIconButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.25rem',
    border: 'none',
    background: 'none',
    flexShrink: 0,
  }
  const customerPhone = (job.customer_phone ?? '').trim()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 2,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {canOpenJobScheduleModal ? (
          <button
            type="button"
            onClick={() => openQuickAssignForJob(job)}
            title="Assign work — pick people and a time"
            aria-label="Assign work — pick people and a time"
            style={{
              ...quickIconButtonStyle,
              cursor: 'pointer',
              color: '#16a34a',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M224 64C206.3 64 192 78.3 192 96L192 128L160 128C124.7 128 96 156.7 96 192L96 240L544 240L544 192C544 156.7 515.3 128 480 128L448 128L448 96C448 78.3 433.7 64 416 64C398.3 64 384 78.3 384 96L384 128L256 128L256 96C256 78.3 241.7 64 224 64zM96 288L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 288L96 288z" />
            </svg>
          </button>
        ) : null}
        {/* Hidden (not grayed) when the job has no team — week dispatch is team-scoped (v2.1540). */}
        {canOpenJobScheduleModal && !scheduleNoTeam ? (
          <button
            type="button"
            onClick={() => {
              const week = getDefaultWeekRange().start
              navigate(scheduleDispatchWeekUrl(job.id, week))
            }}
            title="Open week dispatch"
            aria-label="Open week dispatch"
            style={{
              ...quickIconButtonStyle,
              cursor: 'pointer',
              color: 'var(--text-link)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M128 96L512 96C547.3 96 576 124.7 576 160L576 480C576 515.3 547.3 544 512 544L128 544C92.7 544 64 515.3 64 480L64 160C64 124.7 92.7 96 128 96zM128 192L128 480L232 480L232 192L128 192zM280 192L280 480L360 480L360 192L280 192zM408 192L408 480L512 480L512 192L408 192z" />
            </svg>
          </button>
        ) : null}
        {customerPhone ? (
          <a
            href={telHrefFor(customerPhone)}
            title={`Call customer: ${customerPhone}`}
            aria-label={`Call customer at ${customerPhone}`}
            style={{ ...quickIconButtonStyle, color: '#0f766e', cursor: 'pointer' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C492.9 589.2 555.5 534 573.1 469.4L574.6 463.9C579.9 444.2 569.9 423.7 551 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 240.7 342.2 205.8 271.9L253 233.3C266.9 221.9 271.7 202.9 264.8 186.3L224.2 89z" />
            </svg>
          </a>
        ) : null}
        {showTaskDispatchButton(authRole) ? (
          <button
            type="button"
            onClick={() =>
              dispatchTaskModal?.openDispatchModal({
                reference: {
                  source: 'job',
                  id: job.id,
                  hcp_number: job.hcp_number ?? '',
                  click_number: job.click_number ?? null,
                  job_name: job.job_name ?? '',
                  job_address: job.job_address ?? '',
                  service_type_id: job.service_type_id ?? null,
                  service_type_name: job.serviceType?.name ?? null,
                },
              })
            }
            title="Send this job to Dispatch with a note"
            aria-label="Send job to Dispatch"
            style={{ ...quickIconButtonStyle, color: '#0ea5e9', cursor: 'pointer' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 640"
              width={16}
              height={16}
              fill="currentColor"
              aria-hidden
            >
              <path d="M280 128C266.7 128 256 138.7 256 152C256 165.3 266.7 176 280 176L296 176L296 209.3C188.8 220.7 104.2 307.7 96.6 416L543.5 416C535.8 307.7 451.2 220.7 344 209.3L344 176L360 176C373.3 176 384 165.3 384 152C384 138.7 373.3 128 360 128L280 128zM88 464C74.7 464 64 474.7 64 488C64 501.3 74.7 512 88 512L552 512C565.3 512 576 501.3 576 488C576 474.7 565.3 464 552 464L88 464z" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            checklistAddModal?.openAddModal({
              preset: checklistJobModalPreset(
                {
                  id: job.id,
                  hcp_number: job.hcp_number,
                  click_number: job.click_number,
                  job_name: job.job_name,
                  job_address: job.job_address,
                  serviceTypeName: job.serviceType?.name,
                  customerName: job.customer_name,
                  gcName: job.gcCustomer?.name,
                },
                window.location.origin
              ),
            })
          }}
          title="Send this job to someone as a task"
          aria-label="Send job as a task"
          style={{ ...quickIconButtonStyle, color: '#7c3aed', cursor: 'pointer' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 640 640"
            width={16}
            height={16}
            fill="currentColor"
            aria-hidden
          >
            <path d="M576 64L64 288L240 352L240 496L328 400L472 512L576 64z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
