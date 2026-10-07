/**
 * The My Time day editor's no-call-no-show pieces: the footer button (mounted in both footers),
 * the pre-close dialog that offers to clock out open sessions, and the three-phase record dialog.
 * JSX only — state and writes are `useMyTimeNcnsFlow`'s, handed in as `flow`.
 */
import { NCNS_DETAILS_MAX_LEN } from '../../lib/myTimeNcns'
import type { MyTimeNcnsFlow } from './useMyTimeNcnsFlow'

export type MyTimeNcnsButtonProps = {
  flow: Pick<MyTimeNcnsFlow, 'clickAllowed' | 'busy' | 'precloseOpenSessions' | 'buttonTitle' | 'onButtonClick'>
  /** The editor is saving: the button is held. */
  saving: boolean
}

export function MyTimeNcnsButton({ flow, saving }: MyTimeNcnsButtonProps) {
  const held = !flow.clickAllowed || saving || flow.busy || flow.precloseOpenSessions != null
  return (
    <button
      type="button"
      onClick={flow.onButtonClick}
      disabled={held}
      title={flow.buttonTitle || undefined}
      style={{
        padding: '0.35rem 0.55rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        border: '1px solid #b45309',
        borderRadius: 6,
        background: 'var(--bg-amber-tint)',
        color: 'var(--text-amber-700)',
        cursor: held ? 'not-allowed' : 'pointer',
        opacity: held ? 0.65 : 1,
      }}
    >
      NCNS
    </button>
  )
}

export type MyTimeNcnsPrecloseDialogProps = {
  flow: Pick<MyTimeNcnsFlow, 'precloseOpenSessions' | 'precloseError' | 'busy' | 'closePreclose' | 'continuePreclose'>
  zIndex: number
}

export function MyTimeNcnsPrecloseDialog({ flow, zIndex }: MyTimeNcnsPrecloseDialogProps) {
  const openSessions = flow.precloseOpenSessions
  if (!openSessions) return null
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
      onClick={flow.closePreclose}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="ncns-preclose-dialog-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="ncns-preclose-dialog-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
          Clock out open sessions?
        </h3>
        {openSessions.some((s) => s.approved_at) ? (
          <p
            style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-amber-800)',
              background: 'var(--bg-amber-tint)',
              border: '1px solid var(--border-amber)',
              borderRadius: 6,
              padding: '0.65rem 0.75rem',
              lineHeight: 1.5,
            }}
          >
            At least one open session was already approved. Setting clock-out will change recorded hours and
            may require re-approval.
          </p>
        ) : null}
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          Clock out {openSessions.length} open session
          {openSessions.length === 1 ? '' : 's'} at the current time, then record no-call
          no-show? This changes their hours for today.
        </p>
        {flow.precloseError ? (
          <p
            role="alert"
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.8125rem',
              color: 'var(--text-red-700)',
              background: 'var(--bg-red-tint)',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '0.5rem 0.65rem',
              lineHeight: 1.45,
            }}
          >
            {flow.precloseError}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={flow.busy}
            onClick={flow.closePreclose}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: flow.busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={flow.busy}
            onClick={flow.continuePreclose}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #b45309',
              borderRadius: 6,
              background: 'var(--bg-amber-tint)',
              color: 'var(--text-amber-700)',
              cursor: flow.busy ? 'not-allowed' : 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export type MyTimeNcnsDialogProps = {
  flow: Pick<
    MyTimeNcnsFlow,
    | 'ui'
    | 'payrollAck'
    | 'details'
    | 'busy'
    | 'error'
    | 'setPayrollAck'
    | 'setDetails'
    | 'record'
    | 'cancelDialog'
    | 'dismissDialog'
    | 'continueToConfirm'
    | 'backToWarn'
  >
  /** Whose day it is, as the editor's title names them. */
  personLabel: string
  /** The work date, written out. */
  dateLabel: string
  zIndex: number
}

export function MyTimeNcnsDialog({ flow, personLabel, dateLabel, zIndex }: MyTimeNcnsDialogProps) {
  if (flow.ui === 'off') return null
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
      onClick={flow.dismissDialog}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="ncns-dialog-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {flow.ui === 'simple' ? (
          <>
            <h3 id="ncns-dialog-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
              Record no-call, no-show?
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              This records a no-call, no-show for <strong>{personLabel}</strong> on{' '}
              <strong>{dateLabel}</strong>. Every closed clock session for that
              day will be rejected, an attendance incident will be saved, and time / payroll totals will reflect the
              rejection.
            </p>
            <label
              htmlFor="ncns-details-simple"
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}
            >
              Details (optional)
            </label>
            <textarea
              id="ncns-details-simple"
              value={flow.details}
              disabled={flow.busy}
              maxLength={NCNS_DETAILS_MAX_LEN}
              onChange={(e) => flow.setDetails(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                padding: '0.5rem 0.6rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
              placeholder="Context for this NCNS (visible in People → Writeups)"
            />
            {flow.error ? (
              <p
                role="alert"
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.8125rem',
                  color: 'var(--text-red-700)',
                  background: 'var(--bg-red-tint)',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  padding: '0.5rem 0.65rem',
                  lineHeight: 1.45,
                }}
              >
                {flow.error}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={flow.busy}
                onClick={flow.cancelDialog}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: flow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={flow.busy}
                onClick={() => void flow.record()}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #b45309',
                  borderRadius: 4,
                  background: 'var(--bg-amber-tint)',
                  color: 'var(--text-amber-700)',
                  fontWeight: 600,
                  cursor: flow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                {flow.busy ? 'Working…' : 'Record NCNS'}
              </button>
            </div>
          </>
        ) : null}
        {flow.ui === 'approved_warn' ? (
          <>
            <h3 id="ncns-dialog-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
              Approved time on this day
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              Some time on this day was <strong>already approved</strong>. Recording a no-call, no-show will reject those
              sessions and <strong>remove the approved hours from payroll totals</strong>. The person may experience
              this as breaking <strong>trust</strong> if it is not discussed with them. Only continue if you accept
              those consequences.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={flow.busy}
                onClick={flow.cancelDialog}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: flow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={flow.busy}
                onClick={flow.continueToConfirm}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  background: '#3b82f6',
                  color: 'white',
                  fontWeight: 600,
                  cursor: flow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : null}
        {flow.ui === 'approved_confirm' ? (
          <>
            <h3 id="ncns-dialog-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
              Confirm payroll and trust
            </h3>
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                margin: '0 0 1rem 0',
                fontSize: '0.875rem',
                color: 'var(--text-700)',
                lineHeight: 1.45,
                cursor: flow.busy ? 'default' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={flow.payrollAck}
                disabled={flow.busy}
                onChange={(e) => flow.setPayrollAck(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                I understand this removes approved hours from payroll totals and may seriously affect trust with this
                person.
              </span>
            </label>
            <label
              htmlFor="ncns-details-approved"
              style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}
            >
              Details (optional)
            </label>
            <textarea
              id="ncns-details-approved"
              value={flow.details}
              disabled={flow.busy}
              maxLength={NCNS_DETAILS_MAX_LEN}
              onChange={(e) => flow.setDetails(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                padding: '0.5rem 0.6rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.45,
              }}
              placeholder="Context for this NCNS (visible in People → Writeups)"
            />
            {flow.error ? (
              <p
                role="alert"
                style={{
                  margin: '0 0 0.75rem 0',
                  fontSize: '0.8125rem',
                  color: 'var(--text-red-700)',
                  background: 'var(--bg-red-tint)',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  padding: '0.5rem 0.65rem',
                  lineHeight: 1.45,
                }}
              >
                {flow.error}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={flow.busy}
                onClick={flow.backToWarn}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: flow.busy ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                disabled={flow.busy || !flow.payrollAck}
                onClick={() => void flow.record()}
                style={{
                  padding: '0.5rem 0.85rem',
                  border: '1px solid #b45309',
                  borderRadius: 4,
                  background: flow.payrollAck ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
                  color: 'var(--text-amber-700)',
                  fontWeight: 600,
                  cursor: flow.busy || !flow.payrollAck ? 'not-allowed' : 'pointer',
                  opacity: flow.payrollAck ? 1 : 0.6,
                }}
              >
                {flow.busy ? 'Working…' : 'Record NCNS'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
