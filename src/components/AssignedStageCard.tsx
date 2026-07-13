import { Link } from 'react-router-dom'
import {
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  ExternalLink,
  Play,
  Check,
  CheckCircle,
  XCircle,
  User,
} from 'lucide-react'
import type { Database } from '../types/database'
import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']
export type AssignedStep = Step & {
  project_id: string
  project_name: string
  project_address: string | null
  project_plans_link: string | null
  project_superintendent_names: string | null
  workflow_id: string
}

type StepStatus = NonNullable<Step['status']>

const STATUS_LABELS: Record<StepStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  approved: 'Approved',
  rejected: 'Previous work incomplete',
  skipped: 'Skipped',
}

const STATUS_BADGE_CLASS: Record<StepStatus, string> = {
  pending: 'assignedStageCard-badge pending',
  in_progress: 'assignedStageCard-badge in_progress',
  completed: 'assignedStageCard-badge completed',
  approved: 'assignedStageCard-badge approved',
  rejected: 'assignedStageCard-badge rejected',
  skipped: 'assignedStageCard-badge skipped',
}

export type AssignedStageCardProps = {
  step: AssignedStep
  userNames: Set<string>
  role: string | null
  onSetStart: () => void
  onMarkComplete: () => void
  onMarkApproved: () => void
  onReject: () => void
  onSkip?: () => void
  formatDatetime: (iso: string | null) => string
  daysOpen: (startedAt: string | null, endedAt: string | null) => number | null
  personDisplay: (name: string | null, userNames: Set<string>) => string
}

export default function AssignedStageCard({
  step,
  userNames,
  role,
  onSetStart,
  onMarkComplete,
  onMarkApproved,
  onReject,
  onSkip,
  formatDatetime,
  daysOpen,
  personDisplay,
}: AssignedStageCardProps) {
  const status = (step.status ?? 'pending') as StepStatus
  const d = daysOpen(step.started_at, step.ended_at)
  const canApproveReject = role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'superintendent'

  return (
    <div className={`assignedStageCard assignedStageCard--${status}`}>
      <div className="assignedStageCard-header">
        <div className="assignedStageCard-titleRow">
          <span className="assignedStageCard-stageName">
            {isSubcontractorLikeRole(role as UserRole) && step.project_name
              ? `${step.project_name} - ${step.name}`
              : step.name}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="assignedStageCard-assignee">
              <User size={14} aria-hidden />
              {personDisplay(step.assigned_to_name, userNames)}
            </span>
            {step.project_superintendent_names && (
              <>
                <span style={{ color: 'var(--text-faint)', fontSize: '0.8em' }} aria-hidden>·</span>
                <span className="assignedStageCard-assignee" style={{ color: 'var(--text-muted)' }}>
                  Superintendent: {step.project_superintendent_names}
                </span>
              </>
            )}
          </span>
        </div>
        <span className={STATUS_BADGE_CLASS[status]}>{STATUS_LABELS[status]}</span>
      </div>

      {!isSubcontractorLikeRole(role as UserRole) && (
        <div className="assignedStageCard-projectLink">
          <ExternalLink size={14} aria-hidden />
          <Link
            to={`/workflows/${step.project_id}#step-${step.id}`}
            className="assignedStageCard-link"
          >
            {step.project_name}
          </Link>
        </div>
      )}

      {step.next_step_rejected_notice && (status === 'pending' || status === 'in_progress') && (
        <div className="assignedStageCard-rejectedNotice" role="alert">
          <AlertTriangle size={16} aria-hidden />
          <div>
            <div className="assignedStageCard-rejectedNotice-text">
              Next stage <strong style={{ textDecoration: 'underline' }}>{step.next_step_rejected_notice}</strong> rejected, this stage must be re-completed.
            </div>
            {step.next_step_rejection_reason && (
              <div className="assignedStageCard-rejectedNotice-reason">
                Reason: {step.next_step_rejection_reason}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="assignedStageCard-meta">
        <span className="assignedStageCard-metaItem">
          <Clock size={14} aria-hidden />
          Start: {formatDatetime(step.started_at)}
        </span>
        <span className="assignedStageCard-metaItem">
          <Clock size={14} aria-hidden />
          End: {formatDatetime(step.ended_at)}
        </span>
        {d != null && (
          <span className="assignedStageCard-metaItem">
            {d === 1 ? '1 day' : `${d} days`} open
          </span>
        )}
      </div>

      {step.project_address && (
        <div className="assignedStageCard-row">
          <MapPin size={14} aria-hidden />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(step.project_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="assignedStageCard-link"
            aria-label={`View address on map: ${step.project_address}`}
          >
            {step.project_address}
          </a>
        </div>
      )}

      {step.project_plans_link && (
        <div className="assignedStageCard-row">
          <FileText size={14} aria-hidden />
          <a
            href={step.project_plans_link}
            target="_blank"
            rel="noopener noreferrer"
            className="assignedStageCard-link"
            aria-label={`View plans for ${step.project_name}`}
          >
            View plans for {step.project_name}
          </a>
        </div>
      )}

      {step.notes && (
        <div className="assignedStageCard-notes">
          <div className="assignedStageCard-notesLabel">Notes:</div>
          <pre className="assignedStageCard-notesContent">{step.notes}</pre>
        </div>
      )}

      {step.rejection_reason && (
        <div className="assignedStageCard-rejection">
          Reason: {step.rejection_reason}
        </div>
      )}

      {status === 'skipped' && step.skipped_reason && (
        <div className="assignedStageCard-skippedReason">
          Reason: {step.skipped_reason}
        </div>
      )}

      <div className="assignedStageCard-actions">
        {(status === 'pending' || status === 'in_progress') && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Technician:</span>
            {status === 'pending' && (
              <button
                type="button"
                onClick={onSetStart}
                className="wf-btn-secondary"
                aria-label="Set start date and time for this stage"
              >
                <Play size={14} aria-hidden />
                Set Start
              </button>
            )}
            <button
              type="button"
              onClick={onMarkComplete}
              className="wf-btn-primary"
              aria-label="Mark this stage as complete"
            >
              <Check size={14} aria-hidden />
              Mark Complete
            </button>
          </span>
        )}
        {(status === 'pending' || status === 'in_progress') && canApproveReject && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Office:</span>
            <button
              type="button"
              onClick={onMarkApproved}
              className="wf-btn-info"
              aria-label="Approve this stage"
            >
              <CheckCircle size={14} aria-hidden />
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="wf-btn-danger"
              aria-label="Send back: Previous work incomplete"
            >
              <XCircle size={14} aria-hidden />
              Send Back: Previous Work Incomplete
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="wf-btn-secondary"
                style={{ color: 'var(--text-amber-800)' }}
                aria-label="Skip this stage"
              >
                Skip
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
