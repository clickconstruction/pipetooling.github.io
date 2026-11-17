import { goodThroughState } from '../../lib/estimates/estimateGoodThroughExtend'
import {
  type CustomerRow,
} from '../../lib/customerContactDisplay'
import {
  type EstimateCustomerExperienceResolved,
} from '../../lib/estimateCustomerExperience'
import { EstimateLineItemsTable } from './EstimateCustomerDocument'
import EstimateOfferedOptions from './EstimateOfferedOptions'
import {
  acceptHeaderBrandLabel,
  type EstimateAcceptHeaderBrand,
} from '../../lib/estimateAcceptHeaderBrand'
import { formatValidUntilForDisplay } from '../../lib/formatEstimateValidUntilDisplay'
import {
  normalizeEstimateLineItemsFromJson,
} from '../../lib/estimateLineItemNormalize'
import {
  type EstimateOption,
} from '../../lib/estimates/estimateOptions'
import type { EstimateChangeOrderFields } from '../../lib/estimateChangeOrder'
import type { EstimateDetailRow } from '../../lib/estimates/estimateDetailRow'

export interface EstimateSentHeaderProps {
  row: EstimateDetailRow
  customers: CustomerRow[]
  acceptanceDocHeaderBrand: EstimateAcceptHeaderBrand | null
  /** Today on the company's calendar, for the good-through line. */
  todayYmd: string
  isCO: boolean
  coFields: EstimateChangeOrderFields
  /** What the estimate offered; fewer than two draws the plain line table. */
  rowOfferedOptions: EstimateOption[]
  staffResolvedExperience: EstimateCustomerExperienceResolved | null
}

/**
 * The top of a sent, declined or superseded estimate, read-only: the For line, the logo, the
 * good-through line, a change order's fields, and what was offered (the options, or the lines).
 * Moved whole from `EstimateDetail` (v2.7633, punch list #46 row 3, cut 8 of the Estimates map); the
 * markup is the page's own. It reads the row and never the draft's form.
 */
export default function EstimateSentHeader({ row, customers, acceptanceDocHeaderBrand, todayYmd, isCO, coFields, rowOfferedOptions, staffResolvedExperience }: EstimateSentHeaderProps) {
  return (
    <>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
        <strong>For:</strong>{' '}
        {(() => {
          const cust = row.customer_id ? customers.find((c) => c.id === row.customer_id) : undefined
          const crm = cust?.address?.trim() ?? ''
          return row.for_address?.trim() || crm || '—'
        })()}
      </p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
        <strong>Acceptance page logo:</strong>{' '}
        {acceptanceDocHeaderBrand ? acceptHeaderBrandLabel(acceptanceDocHeaderBrand) : 'None'}
      </p>
      {(() => {
        // v2.5992 (#206 PR 1): the office reads the good-through day where the customer does, and sees when it passed.
        const gt = goodThroughState(row.valid_until, todayYmd)
        if (gt.kind === 'none') return null
        return (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }} data-testid="estimate-good-through">
            <strong>Good through:</strong> {formatValidUntilForDisplay(gt.ymd)}
            {gt.kind === 'passed' ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> · passed</span> : null}
          </p>
        )
      })()}
      {isCO ? (
        <section style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Change order</h2>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Description of change:</strong> {coFields.description_of_change.trim() || '—'}
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Reason for change:</strong> {coFields.reason_for_change.trim() || '—'}
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Impact on schedule:</strong> {coFields.impact_on_schedule.trim() || '—'}
          </p>
          {coFields.response_requested_by.trim() ? (
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Response requested by:</strong> {coFields.response_requested_by}
            </p>
          ) : null}
        </section>
      ) : null}
      {rowOfferedOptions.length >= 2 ? (
        // What was offered (v2.5988, #206 PR 2): every option as it went, not the recommended one's frozen lines alone.
        <EstimateOfferedOptions options={rowOfferedOptions} />
      ) : (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
            {staffResolvedExperience?.docLineItemsHeading ?? (isCO ? 'Impact on cost' : 'Line items')}
          </h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-700)' }}>
            <EstimateLineItemsTable lines={normalizeEstimateLineItemsFromJson(row.line_items_snapshot, { allowNegative: isCO })} />
          </div>
        </section>
      )}
    </>
  )
}
