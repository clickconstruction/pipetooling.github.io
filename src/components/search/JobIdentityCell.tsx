/**
 * Tier-2 standard identity for job NUMBER CELLS in working tables (Jobs →
 * Billing, Job Summary, Parts…): the search-standard trade pill + plain
 * `J{number}`. Tables keep their own data columns — this is only the identity
 * cluster, per the two-tier rule (full rows are for finding/picking surfaces;
 * comparison tables get the identity cell). Degrades to the bare `J` number
 * when the service type is unknown, and an em dash when there is no number.
 */
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'

export function JobIdentityCell({
  hcpNumber,
  clickNumber,
  serviceTypeName,
}: {
  hcpNumber: string | null | undefined
  clickNumber?: string | null | undefined
  serviceTypeName?: string | null | undefined
}) {
  const num = effectiveJobLedgerNumber(hcpNumber, clickNumber)
  const pill = getBidServiceTypeTag(serviceTypeName)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      {pill ? (
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.1rem 0.28rem',
            borderRadius: 3,
            background: pill.color,
            color: '#fff',
            lineHeight: 1.2,
            flex: 'none',
          }}
        >
          {pill.tag}
        </span>
      ) : null}
      <span>{num ? `J${num}` : '—'}</span>
    </span>
  )
}
