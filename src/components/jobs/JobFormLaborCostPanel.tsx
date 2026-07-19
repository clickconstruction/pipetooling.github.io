import { useNavigate } from 'react-router-dom'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { TeamLaborRow } from '../../utils/teamLabor'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'

type JobFormLaborCostPanelProps = {
  editing: JobWithDetails | null
  editJobTeamLaborLoading: boolean
  editJobTeamLaborError: boolean
  editJobTeamLaborRow: TeamLaborRow | null
  editJobSubLaborLoading: boolean
  editJobSubLaborError: boolean
  editJobSubLaborData: { count: number; total: number } | null
  editJobEffectiveHcp: string
  showTeamLaborOpenOnJobsLink: boolean
  showSubLaborOpenOnJobsLink: boolean
  onClose: () => void
}

/**
 * The "Labor Cost" panel in the Edit-Job modal (edit mode only): a Team Labor
 * summary line (hours · cost · people) and a Sub Labor summary line (count ·
 * total), each with an "Open on Jobs →" deep link when the role gate + loaded
 * data allow. Extracted verbatim from JobFormModal; self-sources the router. The
 * labor data + gates come in as props — the loader hook stays in the shell
 * because the delete/migrate gate reads its totals.
 */
export function JobFormLaborCostPanel({
  editing,
  editJobTeamLaborLoading,
  editJobTeamLaborError,
  editJobTeamLaborRow,
  editJobSubLaborLoading,
  editJobSubLaborError,
  editJobSubLaborData,
  editJobEffectiveHcp,
  showTeamLaborOpenOnJobsLink,
  showSubLaborOpenOnJobsLink,
  onClose,
}: JobFormLaborCostPanelProps) {
  const navigate = useNavigate()
  if (!editing?.id) return null

  return (
    <>
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid var(--border-400)', width: '50%' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.75rem' }}>Labor Cost</div>
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)' }}>Team Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: 'var(--text-600)', textAlign: 'right', minWidth: 0 }}>
                  {editJobTeamLaborLoading
                    ? 'Loading…'
                    : editJobTeamLaborError
                      ? 'Couldn’t load'
                      : editJobTeamLaborRow
                        ? `${editJobTeamLaborRow.manHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} h · $${formatCurrency(editJobTeamLaborRow.jobCost)} · ${editJobTeamLaborRow.people.length} people`
                        : 'No team labor for this job yet'}
                </span>
                {showTeamLaborOpenOnJobsLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing?.id) return
                      onClose()
                      navigate(`/jobs?tab=combined-labor&teamLaborJob=${encodeURIComponent(editing.id)}`)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-link)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      flexShrink: 0,
                    }}
                  >
                    Open on Jobs →
                  </button>
                ) : null}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)' }}>Sub Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: 'var(--text-600)', textAlign: 'right', minWidth: 0 }}>
                  {editJobSubLaborLoading
                    ? 'Loading…'
                    : !editJobEffectiveHcp
                      ? 'Add an HCP to link sub labor'
                      : editJobSubLaborError
                        ? 'Couldn’t load'
                        : editJobSubLaborData
                          ? editJobSubLaborData.count === 0
                            ? 'No sub labor for this HCP'
                            : `${editJobSubLaborData.count} sub job${editJobSubLaborData.count === 1 ? '' : 's'} · $${formatCurrency(editJobSubLaborData.total)}`
                          : 'No sub labor for this HCP'}
                </span>
                {showSubLaborOpenOnJobsLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate(`/jobs?tab=sub_sheet_ledger&editLabor=${encodeURIComponent(editJobEffectiveHcp)}`)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--text-link)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      flexShrink: 0,
                    }}
                  >
                    Open on Jobs →
                  </button>
                ) : null}
              </div>
              </div>
    </>
  )
}
