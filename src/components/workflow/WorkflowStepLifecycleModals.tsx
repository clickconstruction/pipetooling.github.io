/**
 * The Workflow page's six step windows: delete a step (typing its name when
 * it has content), Send Back (previous work incomplete), Skip, Set Start, the
 * Expected dates window (start, end and length kept in line by
 * \`expectedDatesLinkage\`), and the Assign picker.
 *
 * The stage cards open these, so the page still holds which one is open and
 * what it holds, and does every write; this file draws the windows. The
 * props keep the page's own names, so the JSX moved as it was.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { Database } from '../../types/database'
import {
  expectedDatesProblems,
  expectedEndChanged,
  expectedLengthChanged,
  expectedStartChanged,
} from '../../lib/workflow/expectedDatesLinkage'

type Step = Database['public']['Tables']['project_workflow_steps']['Row']

export type ExpectedDatesWindow = {
  step: Step
  expectedStart: string
  expectedEnd: string
  lengthDays: string
  updateNextStage: boolean
  hasNextStage: boolean
  seededFromPrior: boolean
}

export type WorkflowStepLifecycleModalsProps = {
  confirmDeleteStep: Step | null
  setConfirmDeleteStep: Dispatch<SetStateAction<Step | null>>
  deleteStepConfirmText: string
  setDeleteStepConfirmText: Dispatch<SetStateAction<string>>
  /** Nothing to lose — no typed confirmation needed. */
  isStepEmpty: (step: Step) => boolean
  deleteStep: (step: Step) => Promise<void>

  rejectStep: { step: Step; reason: string } | null
  setRejectStep: Dispatch<SetStateAction<{ step: Step; reason: string } | null>>
  submitReject: () => void

  skipStep: { step: Step; reason: string } | null
  setSkipStep: Dispatch<SetStateAction<{ step: Step; reason: string } | null>>
  submitSkip: () => void

  setStartStep: { step: Step; startDateTime: string } | null
  setSetStartStep: Dispatch<SetStateAction<{ step: Step; startDateTime: string } | null>>
  submitSetStart: () => void

  expectedDatesStep: ExpectedDatesWindow | null
  setExpectedDatesStep: Dispatch<SetStateAction<ExpectedDatesWindow | null>>
  submitExpectedDates: () => void
  clearExpectedDates: () => void

  assignPersonStep: Step | null
  setAssignPersonStep: Dispatch<SetStateAction<Step | null>>
  assignPersonFilter: string
  setAssignPersonFilter: Dispatch<SetStateAction<string>>
  /** Closes the picker, then assigns (null clears). */
  assignPersonFromPicker: (step: Step, name: string | null, personId?: string | null) => unknown
  roster: { name: string; personId?: string | null }[]
  currentUserName: string | null
}

export function WorkflowStepLifecycleModals({
  confirmDeleteStep,
  setConfirmDeleteStep,
  deleteStepConfirmText,
  setDeleteStepConfirmText,
  isStepEmpty,
  deleteStep,
  rejectStep,
  setRejectStep,
  submitReject,
  skipStep,
  setSkipStep,
  submitSkip,
  setStartStep,
  setSetStartStep,
  submitSetStart,
  expectedDatesStep,
  setExpectedDatesStep,
  submitExpectedDates,
  clearExpectedDates,
  assignPersonStep,
  setAssignPersonStep,
  assignPersonFilter,
  setAssignPersonFilter,
  assignPersonFromPicker,
  roster,
  currentUserName,
}: WorkflowStepLifecycleModalsProps) {
  return (
    <>
    {confirmDeleteStep && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Delete step: {confirmDeleteStep.name}?</h3>
          {isStepEmpty(confirmDeleteStep) ? (
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>This step has no assignee, notes, or line items.</p>
          ) : (
            <>
              <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                This step has content (assignee, notes, line items, or has been started). Deleting removes it and its related data — a dev can put it back for 90 days from Settings → Data &amp; migration → Recently deleted.
              </p>
              <p style={{ marginBottom: 8, fontSize: '0.875rem' }}>Type &quot;{confirmDeleteStep.name}&quot; to confirm:</p>
              <input
                value={deleteStepConfirmText}
                onChange={(e) => setDeleteStepConfirmText(e.target.value)}
                placeholder={confirmDeleteStep.name}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              />
            </>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={async () => {
                await deleteStep(confirmDeleteStep)
                setConfirmDeleteStep(null)
                setDeleteStepConfirmText('')
              }}
              disabled={!isStepEmpty(confirmDeleteStep) && deleteStepConfirmText.trim() !== confirmDeleteStep.name}
              className="wf-btn-modal-primary wf-btn-danger-style"
            >
              Delete
            </button>
            <button type="button" onClick={() => { setConfirmDeleteStep(null); setDeleteStepConfirmText('') }} className="wf-btn-modal-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {rejectStep && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Previous work incomplete: {rejectStep.step.name}</h3>
          <label style={{ display: 'block', marginBottom: 4 }}>Reason and Proposed Remedy</label>
          <textarea
            value={rejectStep.reason}
            onChange={(e) => setRejectStep((r) => r ? { ...r, reason: e.target.value } : null)}
            rows={3}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
            placeholder="What is wrong and how should it be fixed (optional)"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={submitReject} className="wf-btn-modal-primary wf-btn-danger-style">Send Back: Previous Work Incomplete</button>
            <button type="button" onClick={() => setRejectStep(null)} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </div>
      </div>
    )}

    {skipStep && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Skip step: {skipStep.step.name}</h3>
          <label style={{ display: 'block', marginBottom: 4 }}>Why is this step being skipped?</label>
          <textarea
            value={skipStep.reason}
            onChange={(e) => setSkipStep((r) => r ? { ...r, reason: e.target.value } : null)}
            rows={4}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
            placeholder="e.g. Client waived inspection, combined with prior step, not applicable..."
          />
          <div style={{ marginBottom: '1rem' }}>
            <button type="button" onClick={() => setSkipStep((s) => s ? { ...s, reason: 'Not relevant' } : null)} className="wf-btn-ghost" style={{ fontSize: '0.8125rem' }}>
              Not relevant
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={submitSkip} disabled={!skipStep.reason.trim()} className="wf-btn-modal-primary" style={skipStep.reason.trim() ? {} : { opacity: 0.5, cursor: 'not-allowed' }}>
              Skip
            </button>
            <button type="button" onClick={() => setSkipStep(null)} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </div>
      </div>
    )}

    {setStartStep && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Set Start Time: {setStartStep.step.name}</h3>
          <label htmlFor="start-datetime" style={{ display: 'block', marginBottom: 4 }}>Start Date & Time</label>
          <input
            id="start-datetime"
            type="datetime-local"
            value={setStartStep.startDateTime}
            onChange={(e) => setSetStartStep((s) => s ? { ...s, startDateTime: e.target.value } : null)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={submitSetStart} className="wf-btn-modal-primary">Set Start</button>
            <button type="button" onClick={() => setSetStartStep(null)} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </div>
      </div>
    )}

    {expectedDatesStep && (() => {
      const current = expectedDatesStep
      const setField = (patch: Partial<typeof current>) => {
        setExpectedDatesStep((prev) => (prev ? { ...prev, ...patch } : null))
      }
      const handleStartChange = (value: string) => {
        setField({ ...expectedStartChanged(current, value), seededFromPrior: false })
      }
      const handleEndChange = (value: string) => {
        setField(expectedEndChanged(current, value))
      }
      const handleLengthChange = (value: string) => {
        setField(expectedLengthChanged(current, value))
      }
      const { lengthInvalid, endBeforeStart } = expectedDatesProblems(current)
      return (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Expected dates for ${current.step.name}`}
          onClick={() => setExpectedDatesStep(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 340, maxWidth: '95%' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Expected dates: {current.step.name}</h3>
            <p style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Plan the expected start and end. Type a length in days to auto-compute the end from the start.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Expected start</span>
                <input
                  type="date"
                  value={current.expectedStart}
                  onChange={(e) => handleStartChange(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Expected end</span>
                <input
                  type="date"
                  value={current.expectedEnd}
                  onChange={(e) => handleEndChange(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                Length (days){' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· auto-computes end from start</span>
              </span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="e.g. 5"
                value={current.lengthDays}
                onChange={(e) => handleLengthChange(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', maxWidth: 160 }}
              />
            </label>
            {current.seededFromPrior && (
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#1e3a8a' }}>
                Start was prefilled from the previous stage's expected end.
              </p>
            )}
            {lengthInvalid && (
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                Length must be a non-negative number.
              </p>
            )}
            {endBeforeStart && (
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
                Expected end is before expected start.
              </p>
            )}
            {current.hasNextStage && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                <input
                  type="checkbox"
                  checked={current.updateNextStage}
                  onChange={(e) => setField({ updateNextStage: e.target.checked })}
                />
                Also set the next step's expected start to this step's expected end
              </label>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={clearExpectedDates}
                className="wf-btn-modal-secondary"
                disabled={!current.step.scheduled_start_date && !current.step.scheduled_end_date}
                title="Remove the expected start and end from this step"
              >
                Clear
              </button>
              <button type="button" onClick={() => setExpectedDatesStep(null)} className="wf-btn-modal-secondary">
                Cancel
              </button>
              <button type="button" onClick={submitExpectedDates} className="wf-btn-modal-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )
    })()}

    {assignPersonStep && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        onClick={() => { setAssignPersonStep(null); setAssignPersonFilter('') }}
      >
        <div role="dialog" aria-modal="true"
          style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 280, maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column', color: 'var(--text-strong)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ marginTop: 0, color: 'var(--text-strong)', flexShrink: 0 }}>Add person to: {assignPersonStep.name}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-strong)', marginBottom: '0.75rem', flexShrink: 0 }}>Choose from your roster.</p>
          {(roster.length > 5 || currentUserName) && (
            <input
              type="search"
              placeholder="Filter..."
              value={assignPersonFilter}
              onChange={(e) => setAssignPersonFilter(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '1rem' }}>
            {roster.length === 0 && !currentUserName ? (
              <p style={{ color: 'var(--text-strong)' }}>No people in your roster yet. Add them on the People page.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(() => {
                  const q = assignPersonFilter.trim().toLowerCase()
                  const matches = (name: string) => !q || name.toLowerCase().includes(q)
                return (
                  <>
                {/* Always show current user first */}
                {currentUserName && matches(currentUserName) && (
                  <button
                    key="current-user"
                    type="button"
                    onClick={() => assignPersonFromPicker(assignPersonStep, currentUserName)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: 'var(--bg-blue-tint)', border: '1px solid #2563eb', borderRadius: 6, cursor: 'pointer', color: 'var(--text-strong)', fontWeight: 500 }}
                  >
                    {currentUserName} (You)
                  </button>
                )}
                {/* Show rest of roster, excluding current user if already in roster */}
                {roster
                  .filter((r) => r.name !== currentUserName && matches(r.name))
                  .map((r, i) => (
                    <button
                      key={`${r.name}-${i}`}
                      type="button"
                      onClick={() => assignPersonFromPicker(assignPersonStep, r.name, r.personId ?? null)}
                      style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-strong)' }}
                    >
                      {r.name}
                    </button>
                  ))}
                  </>
                )
                })()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => assignPersonFromPicker(assignPersonStep, null)} className="wf-btn-modal-secondary">Clear</button>
            <button type="button" onClick={() => { setAssignPersonStep(null); setAssignPersonFilter('') }} className="wf-btn-modal-secondary">Cancel</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
