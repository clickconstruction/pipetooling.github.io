import { JOB_FORM_SECTION_HEADER_STYLE } from '../../lib/jobFormSectionHeaderStyle'
import type { EditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { billingHeaderStatusLine, newJobMoneyBar, type NewJobMoneyBarKey } from '../../lib/jobs/jobFormBillingHeader'
import type { SegmentBoundaryMark } from '../../lib/jobs/jobSegmentsCoverage'
import { MoneyLifecycleBar, PAID_COLOR, BILLED_COLOR, DRAFT_COLOR } from './MoneyLifecycleBar'

const BAR_COLOR: Record<NewJobMoneyBarKey, string> = { paid: PAID_COLOR, billed: BILLED_COLOR, draft: DRAFT_COLOR }

export type JobFormBillingHeaderProps = {
  /** In the Job window the Bill tab names the section, so there is no "Billing" title. */
  embedded: boolean
  /** The open job's id; null on New Job, which has no autosave line. */
  editingId: string | null
  /** An open job reads the ② money card; only New Job draws the bar here. */
  isEditing: boolean
  /** The billing slice's autosave status. */
  billingAutosaveStatus: string
  billingBar: EditJobBillingBar
  billingBarMarks: SegmentBoundaryMark[]
  pctSaving: boolean
}

/**
 * The top of the Job form's Bill region (§8 of the Job form map; out of `JobFormModal`, the second pass's
 * cut 2): the "Billing" title with the billing slice's autosave line, and on New Job the money bar. Props
 * only; the words are `lib/jobs/jobFormBillingHeader.ts`.
 */
export function JobFormBillingHeader({ embedded, editingId, isEditing, billingAutosaveStatus, billingBar, billingBarMarks, pctSaving }: JobFormBillingHeaderProps) {
  const status = billingHeaderStatusLine(editingId, billingAutosaveStatus)
  const statusColor = status?.failed ? 'var(--text-red-600)' : 'var(--text-muted)'
  const bar = isEditing ? null : newJobMoneyBar(billingBar)
  return (
    /* Embedded: the negative margin cancels the region's flex gap plus the residual line-box air so
       "% done" sits flush under the Job Total (owner call, v2.1707). */
    <div style={{ marginBottom: '1rem', ...(embedded ? { marginTop: '-1.15rem' } : {}) }}>
      {!embedded ? (
        <div
          style={{
            ...JOB_FORM_SECTION_HEADER_STYLE,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.75rem',
          }}
        >
          <span>Billing</span>
          {/* v2.1144: the steady-state "Saved" is noise — only in-flight and failure states earn header space. */}
          {status && (
            <span aria-live="polite" style={{ fontSize: '0.75rem', color: statusColor }}>
              {status.words}
            </span>
          )}
        </div>
      ) : /* Titleless Bill tab still surfaces autosave trouble — the status line renders only while saving or failed. */
      status ? (
        <div aria-live="polite" style={{ textAlign: 'right', fontSize: '0.75rem', marginBottom: '0.5rem', color: statusColor }}>
          {status.words}
        </div>
      ) : null}
      {/* v2.4307: an open job's money is the ② money card (Done · Paid · Billed · Left, the % done box, a block
          per line); the New Job form, with no bills yet, keeps this bar. */}
      {bar ? (
        <div>
          <MoneyLifecycleBar
            hasBar={billingBar.hasBar}
            barTitle={bar.barTitle}
            pctComplete={null}
            pctSaving={pctSaving}
            marks={billingBarMarks}
            segments={bar.segments.map((s) => ({ ...s, color: BAR_COLOR[s.key] }))}
            rows={bar.rows.map((r) => ({ ...r, dot: BAR_COLOR[r.key] }))}
            bottomRow={bar.bottomRow}
          />
        </div>
      ) : null}
    </div>
  )
}
