import { useAuth } from '../../hooks/useAuth'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { MaterialRow } from '../../lib/jobs/jobFormTypes'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { materialRowHasUserContent } from '../../lib/jobs/jobFormRows'
import { formatMercuryCardChargesPostedDate } from '../../lib/formatMercuryCardChargesPostedDate'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { showJobCostBreakdownTeamLabor } from '../../lib/jobDetailModalRole'
import {
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { MaterialsCostAccordionRow } from './JobFormMaterialsCostAccordion'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import type { MaterialsAccordionKey } from './useJobCostSnapshot'
import { JOB_FORM_SECTION_HEADER_STYLE } from '../../lib/jobFormSectionHeaderStyle'

type JobFormPartsCostSectionProps = {
  editing: JobWithDetails | null
  materialsAccordionOpen: MaterialsAccordionKey | null
  toggleMaterialsAccordion: (key: MaterialsAccordionKey) => void
  jobMaterialsSnapshotLoading: boolean
  supplyInvoiceTotal: number
  supplyInvoiceRpcFailed: boolean
  supplyInvoiceLines: JobSupplyInvoiceLine[]
  mercuryCardTotal: number
  mercuryFetchFailed: boolean
  mercuryAllocLines: JobMercuryAllocLine[]
  tallyPartsTotal: number
  tallyFetchFailed: boolean
  tallyPartLines: JobTallyPartLine[]
  billedMaterialsTotalDisplay: string
  materials: MaterialRow[]
  addMaterialRow: () => void
  updateMaterialRow: (id: string, updates: Partial<MaterialRow>) => void
  removeMaterialRow: (id: string) => void
  /** Hide the "Parts Cost" heading (edit mode — the Labor and Parts Cost panel above titles the combined block). */
  hideTitle?: boolean
}

/**
 * The "Parts Cost" panel in the Edit/New Job modal — three read-only cost
 * accordions (Supply house invoices, Card charges, Parts from tally; edit mode
 * only) plus the always-shown editable "Other job charges" (the `materials`
 * rows) and, in edit mode, the JobChargesTimelineStandalone. Extracted verbatim
 * from JobFormModal; self-sources auth (team-labor gate) and the Mercury card
 * nicknames. The cost-snapshot data + materials mutators come in as props — the
 * snapshot loader hook stays in the shell because the delete/migrate gate reads
 * it.
 */
export function JobFormPartsCostSection({
  editing,
  materialsAccordionOpen,
  toggleMaterialsAccordion,
  jobMaterialsSnapshotLoading,
  supplyInvoiceTotal,
  supplyInvoiceRpcFailed,
  supplyInvoiceLines,
  mercuryCardTotal,
  mercuryFetchFailed,
  mercuryAllocLines,
  tallyPartsTotal,
  tallyFetchFailed,
  tallyPartLines,
  billedMaterialsTotalDisplay,
  materials,
  addMaterialRow,
  updateMaterialRow,
  removeMaterialRow,
  hideTitle,
}: JobFormPartsCostSectionProps) {
  const { role: authRole } = useAuth()
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()

  return (
    <>
          {hideTitle ? null : (
            <div style={{ ...JOB_FORM_SECTION_HEADER_STYLE, marginBottom: '0.75rem' }}>Parts Cost</div>
          )}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflow: 'hidden' }}>
              {editing?.id ? (
                <>
                  <MaterialsCostAccordionRow
                    title="Supply house invoices"
                    totalDisplay={supplyInvoiceRpcFailed ? '—' : formatCurrency(supplyInvoiceTotal)}
                    expanded={materialsAccordionOpen === 'supply'}
                    onToggle={() => toggleMaterialsAccordion('supply')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {supplyInvoiceLines.length === 0 && supplyInvoiceTotal > 0 && !supplyInvoiceRpcFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Allocated invoice total for this job; line detail is available to office roles in Materials.
                      </p>
                    ) : supplyInvoiceLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No supply house invoice allocations for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Supply house</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Invoice</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplyInvoiceLines.map((ln, idx) => (
                            <tr key={`${ln.invoiceNumber}-${ln.invoiceDate}-${idx}`} style={{ borderBottom: idx < supplyInvoiceLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                    expanded={materialsAccordionOpen === 'mercury'}
                    onToggle={() => toggleMaterialsAccordion('mercury')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {mercuryFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>Could not load card allocations.</p>
                    ) : mercuryAllocLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No Mercury card splits for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Posted</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Card</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Counterparty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mercuryAllocLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < mercuryAllocLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                              <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-600)' }}>{ln.note ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                  <MaterialsCostAccordionRow
                    title="Parts from tally"
                    totalDisplay={tallyFetchFailed ? '—' : formatCurrency(tallyPartsTotal)}
                    expanded={materialsAccordionOpen === 'tally'}
                    onToggle={() => toggleMaterialsAccordion('tally')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {tallyFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>Could not load tally parts.</p>
                    ) : tallyPartLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No tally parts for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tallyPartLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < tallyPartLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                </>
              ) : null}
              <MaterialsCostAccordionRow
                title="Other job charges"
                totalDisplay={billedMaterialsTotalDisplay}
                expanded={materialsAccordionOpen === 'billed'}
                onToggle={() => toggleMaterialsAccordion('billed')}
                busy={false}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line Item</th>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Amount ($)</th>
                      <th style={{ padding: '0.625rem 0.5rem', minWidth: '4.5rem', width: '4.5rem', borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((row, idx) => {
                      const canRemove = materials.length > 1 || materialRowHasUserContent(row)
                      const removeTitle = materials.length > 1 ? 'Remove' : 'Clear row'
                      const showAddMaterialRow = materials.length === 1 || idx === materials.length - 1
                      return (
                      <tr key={row.id} style={{ borderBottom: idx < materials.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                            placeholder="Item description"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.amount || ''}
                            onChange={(e) => updateMaterialRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 4,
                              flexWrap: 'nowrap',
                            }}
                          >
                            {showAddMaterialRow ? (
                              <button
                                type="button"
                                onClick={addMaterialRow}
                                title="Add line"
                                aria-label="Add line"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            ) : null}
                            {canRemove ? (
                              <button
                                type="button"
                                onClick={() => removeMaterialRow(row.id)}
                                title={removeTitle}
                                aria-label={removeTitle}
                                style={{
                                  padding: '0.35rem',
                                  background: 'transparent',
                                  color: '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </MaterialsCostAccordionRow>
              {editing ? <JobChargesTimelineStandalone job={editing} includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)} /> : null}
          </div>
    </>
  )
}
