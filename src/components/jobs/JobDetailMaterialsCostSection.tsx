import { useCallback, useMemo, useState } from 'react'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { formatMercuryCardChargesPostedDate } from '../../lib/formatMercuryCardChargesPostedDate'
import {
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
  type JobMaterialsCostSnapshot,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { MaterialsCostAccordionRow } from './JobFormMaterialsCostAccordion'

type MaterialsAccordionKey = 'supply' | 'mercury' | 'tally' | 'billed'

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export type JobDetailBilledMaterialRow = {
  id: string
  description: string | null
  amount: string | number | null
}

type Props = {
  loading: boolean
  snapshot: JobMaterialsCostSnapshot | null
  canExpand: boolean
  billedMaterials: JobDetailBilledMaterialRow[]
}

export function JobDetailMaterialsCostSection({ loading, snapshot, canExpand, billedMaterials }: Props) {
  const [openKey, setOpenKey] = useState<MaterialsAccordionKey | null>(null)
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()

  const toggle = useCallback(
    (key: MaterialsAccordionKey) => {
      if (!canExpand) return
      setOpenKey((prev) => (prev === key ? null : key))
    },
    [canExpand],
  )

  const supplyInvoiceRpcFailed = snapshot?.supplyInvoiceRpcFailed ?? false
  const supplyInvoiceTotal = snapshot?.supplyInvoiceTotal ?? 0
  const supplyInvoiceLines = snapshot?.supplyInvoiceLines ?? []

  const mercuryFetchFailed = snapshot?.mercuryFetchFailed ?? false
  const mercuryAllocLines = snapshot?.mercuryAllocLines ?? []
  const mercuryCardTotal = useMemo(() => mercuryCardTotalFromLines(mercuryAllocLines), [mercuryAllocLines])

  const tallyFetchFailed = snapshot?.tallyFetchFailed ?? false
  const tallyPartLines = snapshot?.tallyPartLines ?? []
  const tallyPartsTotal = useMemo(() => tallyPartsTotalFromLines(tallyPartLines), [tallyPartLines])

  const billedMaterialsTotalDisplay = useMemo(() => {
    const sum = billedMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return formatCurrency(sum)
  }, [billedMaterials])

  const rowBusy = loading || snapshot === null

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Materials cost</div>
      <div
        style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <MaterialsCostAccordionRow
          title="Supply house invoices"
          totalDisplay={supplyInvoiceRpcFailed ? '—' : formatCurrency(supplyInvoiceTotal)}
          expanded={canExpand && openKey === 'supply'}
          onToggle={() => toggle('supply')}
          busy={rowBusy}
          expandable={canExpand}
        >
          {supplyInvoiceLines.length === 0 && supplyInvoiceTotal > 0 && !supplyInvoiceRpcFailed ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              Allocated invoice total for this job; line detail is available to office roles in Materials.
            </p>
          ) : supplyInvoiceLines.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No supply house invoice allocations for this job.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Supply house</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Invoice</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Allocated</th>
                </tr>
              </thead>
              <tbody>
                {supplyInvoiceLines.map((ln, idx) => (
                  <tr key={`${ln.invoiceNumber}-${ln.invoiceDate}-${idx}`} style={{ borderBottom: idx < supplyInvoiceLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '0.5rem 0.625rem' }}>{ln.supplyHouseName ?? '—'}</td>
                    <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceNumber}</td>
                    <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceDate || '—'}</td>
                    <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.allocatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MaterialsCostAccordionRow>
        <MaterialsCostAccordionRow
          title="Card charges"
          totalDisplay={mercuryFetchFailed ? '—' : formatCurrency(mercuryCardTotal)}
          expanded={canExpand && openKey === 'mercury'}
          onToggle={() => toggle('mercury')}
          busy={rowBusy}
          expandable={canExpand}
        >
          {mercuryFetchFailed ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load card allocations.</p>
          ) : mercuryAllocLines.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No Mercury card splits for this job.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Posted</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Card</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Counterparty</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {mercuryAllocLines.map((ln, idx) => (
                  <tr key={ln.id} style={{ borderBottom: idx < mercuryAllocLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '0.5rem 0.625rem' }}>{formatMercuryCardChargesPostedDate(ln.postedAt)}</td>
                    <td
                      style={{
                        padding: '0.5rem 0.625rem',
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={
                        ln.debitCardId
                          ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                          : undefined
                      }
                    >
                      {ln.debitCardId
                        ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                        : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.625rem' }}>{ln.counterpartyName ?? '—'}</td>
                    <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Math.abs(ln.allocationAmount))}</td>
                    <td style={{ padding: '0.5rem 0.625rem', color: '#4b5563' }}>{ln.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MaterialsCostAccordionRow>
        <MaterialsCostAccordionRow
          title="Parts from tally"
          totalDisplay={tallyFetchFailed ? '—' : formatCurrency(tallyPartsTotal)}
          expanded={canExpand && openKey === 'tally'}
          onToggle={() => toggle('tally')}
          busy={rowBusy}
          expandable={canExpand}
        >
          {tallyFetchFailed ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load tally parts.</p>
          ) : tallyPartLines.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No tally parts for this job.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Qty</th>
                  <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {tallyPartLines.map((ln, idx) => (
                  <tr key={ln.id} style={{ borderBottom: idx < tallyPartLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <td style={{ padding: '0.5rem 0.625rem' }}>
                      {[ln.fixtureName, ln.partName].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}>{ln.quantity}</td>
                    <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MaterialsCostAccordionRow>
        <MaterialsCostAccordionRow
          title="Other job charges"
          totalDisplay={billedMaterialsTotalDisplay}
          expanded={canExpand && openKey === 'billed'}
          onToggle={() => toggle('billed')}
          busy={false}
          expandable={canExpand}
        >
          {billedMaterials.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>None</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {billedMaterials.map((m) => (
                <li
                  key={m.id}
                  style={{
                    padding: '0.45rem 0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: 4,
                    marginBottom: 6,
                    fontSize: '0.875rem',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{m.description || '—'}</span>
                  <span style={{ color: '#6b7280', marginLeft: 8 }}>{formatCurrency(Number(m.amount ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </MaterialsCostAccordionRow>
      </div>
    </div>
  )
}
