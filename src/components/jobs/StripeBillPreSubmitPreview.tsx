import type { CSSProperties } from 'react'
import { mergeBillCustomerInvoiceDescriptionIssueChrome } from '../../lib/billCustomerInvoiceDescriptionIssueChrome'
import { anyLineSegmentsStartWithLowercase } from '../../lib/invoiceLineDescriptionLeadingLowercase'
import type { StripeInvoiceLineSource, StripeInvoicePreviewSuccess } from '../../lib/stripeInvoicePreview'
import { formatStripeCents } from '../../lib/stripeInvoicePreview'
import { APP_CALENDAR_TZ, referenceDateForWorkDateYmd } from '../../utils/dateUtils'

export type StripeBillPreSubmitPreviewProps = {
  customerName: string | null
  customerEmail: string | null
  jobName: string | null
  hcpNumber: string | null
  amountLabel: string
  dueDateYmd: string
  memo: string
  /** Optional Stripe invoice footer; shown in preview meta only (not from Stripe createPreview). */
  footer?: string
  localLineDescription: string
  stripePreview: StripeInvoicePreviewSuccess | null
  stripePreviewLoading: boolean
  stripePreviewError: string | null
  /** When set, replaces the default “Enter amount…” idle hint (e.g. while RTB line is being ensured). */
  previewIdleHint?: string | null
  /** Opens Bill Customer “Edit Due Date” dialog (e.g. from SendRecordInvoiceModal). */
  onEditDueDate?: () => void
  /** Bill Customer preview only: tint line copy that matches lowercase-leading hint (not on hosted invoice). */
  emphasizeLowercaseLeadingDescriptions?: boolean
  /** Bill Customer: open nested editor for fixture text or Line-on-bill override. */
  onLineDescriptionClick?: (args: { lineIndex: number; source: StripeInvoiceLineSource | undefined }) => void
  /** True when Bill Customer "Line on bill" (`stripeLineDescription`) is non-empty — enables `single_line` row edit. */
  stripeLineOverrideActive?: boolean
}

const metaLabel: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  verticalAlign: 'top',
  color: '#6b7280',
  fontSize: '0.72rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const metaValue: CSSProperties = {
  padding: '0.15rem 0',
  verticalAlign: 'top',
  fontSize: '0.875rem',
  color: '#111827',
  wordBreak: 'break-word',
}

const stripeHeroAmountText: CSSProperties = {
  fontSize: '1.35rem',
  fontWeight: 700,
  color: '#111827',
}

function displayLineQuantity(q: number | null | undefined): number {
  if (q != null && q > 0) return q
  return 1
}

function formatStripeDueDateChicago(dueUnix: number): string {
  const d = new Date(dueUnix * 1000)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function dueLabelForPreview(sp: StripeInvoicePreviewSuccess, dueDateYmd: string): string {
  if (sp.due_date != null && Number.isFinite(sp.due_date)) {
    return formatStripeDueDateChicago(sp.due_date)
  }
  return dueLabelFromYmd(dueDateYmd)
}

function dueLabelFromYmd(dueDateYmd: string): string {
  const ref = referenceDateForWorkDateYmd(dueDateYmd.trim())
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(ref)
}

const dueDateEditButtonStyle: CSSProperties = {
  display: 'inline',
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}

function stripePreviewLineDescriptionIsEditable(
  source: StripeInvoiceLineSource | undefined,
  stripeLineOverrideActive: boolean,
): boolean {
  if (source?.kind === 'fixture') return true
  if (source?.kind === 'single_line' && stripeLineOverrideActive) return true
  return false
}

const stripeLineDescriptionClickableStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'pre-wrap',
}

export function StripeBillPreSubmitPreview(p: StripeBillPreSubmitPreviewProps) {
  const sp = p.stripePreview
  const showDraftLine = !sp && (p.stripePreviewError != null || (!p.stripePreviewLoading && !p.stripePreviewError))
  const emphasize = Boolean(p.emphasizeLowercaseLeadingDescriptions)

  const toName = sp?.customer_name?.trim() || p.customerName?.trim() || '—'
  const toEmail = sp?.customer_email?.trim() || p.customerEmail?.trim() || ''
  const amountRemaining = sp != null ? (sp.amount_remaining ?? Math.max(0, sp.total - (sp.amount_paid ?? 0))) : 0
  const amountPaid = sp?.amount_paid ?? 0

  const draftLineDescriptionIssue =
    showDraftLine && emphasize && anyLineSegmentsStartWithLowercase(p.localLineDescription)
  const draftLineRowStyle = mergeBillCustomerInvoiceDescriptionIssueChrome(
    {
      marginTop: '0.35rem',
      fontSize: '0.72rem',
      color: '#6b7280',
      ...(draftLineDescriptionIssue ? { padding: '0.35rem 0.45rem' } : {}),
    },
    draftLineDescriptionIssue
  )

  return (
    <div style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}>
      <div
        style={{
          fontWeight: 600,
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          width: '100%',
          textAlign: 'center',
        }}
      >
        What the customer will see:
        {p.stripePreviewLoading && sp ? (
          <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280' }}>Updating…</span>
        ) : null}
      </div>

      {p.stripePreviewLoading && !sp ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>Loading invoice preview…</p>
      ) : null}

      {!p.stripePreviewLoading && p.stripePreviewError && (
        <p style={{ margin: '0 0 0.35rem', color: '#b45309', fontSize: '0.8125rem' }}>
          Preview unavailable ({p.stripePreviewError}). Showing draft line below.
        </p>
      )}

      {!p.stripePreviewLoading && !p.stripePreviewError && !sp && (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8125rem' }}>
          {p.previewIdleHint?.trim() || 'Preview loads when billing is ready.'}
        </p>
      )}

      {p.onEditDueDate && p.dueDateYmd.trim() && !sp && !p.stripePreviewLoading ? (
        <div style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.875rem', color: '#374151' }}>
          <button
            type="button"
            onClick={p.onEditDueDate}
            style={dueDateEditButtonStyle}
            aria-label="Edit due date"
          >
            Due {dueLabelFromYmd(p.dueDateYmd)}
          </button>
        </div>
      ) : null}

      {sp ? (
        <>
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              background: '#fafafa',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              fontSize: '0.875rem',
              opacity: p.stripePreviewLoading ? 0.72 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            <div style={{ ...stripeHeroAmountText, marginBottom: '0.25rem' }}>
              {formatStripeCents(amountRemaining, sp.currency)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.65rem' }}>
              {p.onEditDueDate ? (
                <button
                  type="button"
                  onClick={p.onEditDueDate}
                  style={dueDateEditButtonStyle}
                  aria-label="Edit due date"
                >
                  Due {dueLabelForPreview(sp, p.dueDateYmd)}
                </button>
              ) : (
                <>Due {dueLabelForPreview(sp, p.dueDateYmd)}</>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={metaLabel}>To</td>
                  <td style={metaValue}>
                    {toName}
                    {toEmail ? (
                      <>
                        <br />
                        <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>{toEmail}</span>
                      </>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <td style={metaLabel}>From</td>
                  <td style={metaValue}>{sp.seller_name?.trim() ? sp.seller_name.trim() : '—'}</td>
                </tr>
                <tr>
                  <td style={metaLabel}>Invoice</td>
                  <td style={metaValue}>
                    {sp.invoice_number?.trim() ? `#${sp.invoice_number.trim()}` : '—'}
                  </td>
                </tr>
                {p.memo.trim() ? (
                  <tr>
                    <td style={metaLabel}>Memo</td>
                    <td style={metaValue}>{p.memo.trim()}</td>
                  </tr>
                ) : null}
                {(p.footer ?? '').trim() ? (
                  <tr>
                    <td style={metaLabel}>Footer</td>
                    <td style={metaValue}>{(p.footer ?? '').trim()}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginBottom: showDraftLine ? '0.35rem' : 0,
              padding: '0.75rem',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              background: '#fafafa',
              fontSize: '0.875rem',
              opacity: p.stripePreviewLoading ? 0.72 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {sp.lines.length === 0 ? (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                No line items returned from Stripe.
              </p>
            ) : (
              sp.lines.map((line, i) => {
                const flagged = emphasize && anyLineSegmentsStartWithLowercase(line.description)
                const leftBase: CSSProperties = {
                  flex: '1 1 auto',
                  minWidth: 0,
                  ...(flagged ? { padding: '0.35rem 0.45rem' } : {}),
                }
                const leftColumnStyle = mergeBillCustomerInvoiceDescriptionIssueChrome(leftBase, flagged)
                const lineEditable =
                  Boolean(p.onLineDescriptionClick) &&
                  stripePreviewLineDescriptionIsEditable(line.source, Boolean(p.stripeLineOverrideActive))
                return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: i < sp.lines.length - 1 ? '0.65rem' : 0,
                    paddingBottom: i < sp.lines.length - 1 ? '0.65rem' : 0,
                    borderBottom: i < sp.lines.length - 1 ? '1px solid #e5e7eb' : 'none',
                  }}
                >
                  <div style={leftColumnStyle}>
                    {lineEditable ? (
                      <button
                        type="button"
                        aria-label="Edit line description"
                        onClick={() =>
                          p.onLineDescriptionClick?.({ lineIndex: i, source: line.source })
                        }
                        style={stripeLineDescriptionClickableStyle}
                      >
                        <span style={{ color: '#111827', marginBottom: '0.2rem', display: 'block' }}>
                          {line.description.trim() || '—'}
                        </span>
                      </button>
                    ) : (
                      <div style={{ color: '#111827', marginBottom: '0.2rem', whiteSpace: 'pre-wrap' }}>
                        {line.description.trim() || '—'}
                      </div>
                    )}
                    <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                      Qty {displayLineQuantity(line.quantity ?? null)}
                    </div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontSize: '0.875rem',
                      color: '#111827',
                    }}
                  >
                    {formatStripeCents(line.amount, sp.currency)}
                  </div>
                </div>
                )
              })
            )}
            <div
              style={{
                marginTop: sp.lines.length > 0 ? '0.65rem' : 0,
                paddingTop: '0.65rem',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  paddingBottom: '0.65rem',
                  borderBottom: '1px solid #e5e7eb',
                  marginBottom: '0.65rem',
                }}
              >
                <span style={{ color: '#374151' }}>Total due</span>
                <span style={{ fontWeight: 600 }}>{formatStripeCents(sp.total, sp.currency)}</span>
              </div>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: '#374151' }}>Amount paid</span>
                  <span style={{ fontWeight: 600 }}>{formatStripeCents(amountPaid, sp.currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: '#374151' }}>Amount remaining</span>
                  <span style={{ fontWeight: 600 }}>{formatStripeCents(amountRemaining, sp.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {showDraftLine ? (
        <div style={draftLineRowStyle}>
          Draft line: {p.localLineDescription}
        </div>
      ) : null}
    </div>
  )
}
