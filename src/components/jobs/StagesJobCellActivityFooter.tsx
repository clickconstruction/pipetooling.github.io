import type { CSSProperties, ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { invoiceOpenRemainingOnJob, jobStagesInvoiceJumpChipTargets } from '../../lib/jobs/invoiceBilling'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteWeekdayShortTimeChicago,
  getDispatchNoteDisplayMeta,
} from '../../utils/dispatchNoteDisplay'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import { JobContractChip } from './JobContractChip'
import { legalRowChip } from '../../lib/legal/legalMatters'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { renderStagesSeeAllButton, stagesContractChipFor, type StagesRowRenderContext } from './jobsStagesRowShared'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Moved out of `jobsStagesRowShared.tsx` in v2.5109 (the Stages map's step 9); the body is the old render function's, verbatim. */

/**
 * Job-cell activity footer (v2.1555): the survivors of the Activity column's
 * removal — invoice jump chips, the bill emailed/Resend hint, and the
 * See all pill (the Reports button until v2.4324; hidden where the activity
 * box draws its own) — rendered at the bottom of the Job cell in both Stages
 * tables. The note-count chevron rides the job-name line via
 * renderStagesThreadExpandButton; the mobile card list keeps its own zones.
 */
export function StagesJobCellActivityFooter({
  ctx,
  job,
  billingLineForStripeHint,
  hideSeeAllButton,
}: {
  ctx: StagesRowRenderContext
  job: JobWithDetails
  /** Billing line whose bill emailed/Resend hint shows under the job. */
  billingLineForStripeHint?: JobsLedgerInvoice | null
  /**
   * No See all pill: the row draws the activity box, whose strip is the door (v2.4324),
   * or a billed merged row draws the pill higher in the Job cell (v2.1155).
   */
  hideSeeAllButton?: boolean
}) {
  const { applyStagesInvoiceFocus, authRole, loadJobs } = ctx

  const stagesInvoiceJumpAmountChipStyle: CSSProperties = {
    padding: '0.15rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 4,
    background: '#16a34a',
    color: 'white',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontFamily: 'inherit',
  }

  function renderStagesInvoiceJumpChips(forJob: JobWithDetails) {
    const invs = jobStagesInvoiceJumpChipTargets(forJob)
    if (invs.length === 0) return null
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.3rem',
          marginTop: '0.35rem',
          maxWidth: '100%',
        }}
      >
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--text-700)',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          {invs.length === 1 ? 'Open Invoice:' : 'Open Invoices:'}
        </span>
        {invs.map((inv) => {
          const amt = formatUsdNoCents(Number(inv.amount ?? 0))
          const openCents = Math.round(invoiceOpenRemainingOnJob(inv, forJob) * 100)
          const paidLabel = openCents === 0 ? 'Paid' : 'Unpaid'
          const statusLabel = inv.status === 'billed' ? 'Billed' : 'Ready to bill'
          return (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                applyStagesInvoiceFocus(inv.id)
              }}
              title={`Go to this invoice row on Stages (${statusLabel}, ${paidLabel})`}
              aria-label={`Go to invoice ${inv.sequence_order} for ${amt}, ${paidLabel}, on Stages`}
              style={stagesInvoiceJumpAmountChipStyle}
            >
              {amt}
            </button>
          )
        })}
      </div>
    )
  }

  function renderStagesStripeEmailedCustomerHint(): ReactNode {
    const line = billingLineForStripeHint
    if (!line) return null
    if (line.external_send_channel !== 'stripe') return null
    if (!String(line.stripe_invoice_id ?? '').trim()) return null
    const sentRaw = line.sent_to_customer_at
    if (sentRaw == null || !String(sentRaw).trim()) return null
    const sentMeta = getDispatchNoteDisplayMeta(String(sentRaw))
    const stripePaid =
      String(line.stripe_invoice_status ?? '').toLowerCase() === 'paid'
    // One scan line: "Resend Email sent Fri 3:36 PM (today)" (v2.1188 — action
    // first, then the state label). Full wording lives in the tooltip; the
    // resend control keeps its own confirm/disable behavior. The action+label
    // and the time are two nowrap chunks so narrow Job cells wrap between
    // them instead of overflowing into the next column (v2.1042).
    return (
      <div
        title={`The bill was emailed to the customer ${sentMeta.weekdayTimeChicago} (${sentMeta.daysAgoLabel})`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.3rem',
          marginTop: '0.35rem',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.2,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
          <StripeInvoiceSendFromStripeButton
            jobsLedgerInvoiceId={line.id}
            stripeInvoiceId={String(line.stripe_invoice_id).trim()}
            customerEmail={job.customer_email ?? null}
            stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
            onSent={() => void loadJobs()}
            compact
            micro
            unboxed
            hideInlineSuccessLine
            recordedLastSendAt={line.sent_to_customer_at}
            buttonLabel="Resend"
            sendDisabled={stripePaid}
            sendDisabledTitle="This Stripe invoice is paid; Stripe will not send another email."
          />
          <span>Email sent</span>
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatDispatchNoteWeekdayShortTimeChicago(String(sentRaw))} (
          {formatDispatchNoteDaysAgoShort(String(sentRaw))})
        </span>
      </div>
    )
  }

  function renderStagesContractChip(): ReactNode {
    const chip = stagesContractChipFor(ctx, job)
    if (!chip) return null
    const open = ctx.onOpenJobContract
    const legal = legalRowChip(ctx.legalMatterByJobId?.get(job.id))
    if (!chip.show && !legal) return null
    return (
      <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        {chip.show ? (
          <JobContractChip
            coverage={ctx.jobContractCoverageByJobId?.get(job.id)}
            words={chip}
            onClick={open ? () => open(job, chip.opens) : undefined}
          />
        ) : null}
        {legal ? (
          <span
            title="Legal desk — the account's standing with counsel"
            style={{
              display: 'inline-block',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              background: legal.tone === 'legal' ? 'var(--bg-amber-tint)' : legal.tone === 'blue' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
              color: legal.tone === 'legal' ? 'var(--text-amber-700)' : legal.tone === 'blue' ? 'var(--text-blue-700)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {legal.label}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {renderStagesInvoiceJumpChips(job)}
      {renderStagesContractChip()}
      {renderStagesStripeEmailedCustomerHint()}
      {hideSeeAllButton ? null : (
        <div style={{ marginTop: '0.35rem' }}>{renderStagesSeeAllButton(ctx, job)}</div>
      )}
    </>
  )
}
