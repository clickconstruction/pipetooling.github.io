import { useEffect, useId } from 'react'
import type { Database } from '../../types/database'

type RuleRow = Database['public']['Tables']['mercury_accounting_label_rules']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

export type BankingMercuryAccountingRulesModalProps = {
  open: boolean
  onClose: () => void
  rulesLoading: boolean
  rules: RuleRow[]
  rulesFilteredForTable: RuleRow[]
  rulesSortedForTable: RuleRow[]
  rulesSearchNorm: string
  rulesTableSearchText: string
  setRulesTableSearchText: (v: string) => void
  rulesTableSort: { column: 'none' | 'name' | 'label'; direction: 'asc' | 'desc' }
  onRulesSortHeaderClick: (col: 'name' | 'label') => void
  labelById: Map<string, DragLabelRow>
  ruleUsageApproved: Record<string, number>
  labelsLoading: boolean
  labelCount: number
  applyRulesBusy: boolean
  onNewRule: () => void
  onAuditOverlaps: () => void
  onApplyRules: () => void
  onEditRule: (rule: RuleRow) => void
  onDeleteRule: (rule: RuleRow) => void
  /** Backdrop + shell z-index. Defaults to 1100 so child modals (Edit Rule 1200,
   *  Audit Overlaps 1250, Apply Rules confirm 1260) stack on top naturally. */
  zIndex?: number
}

export function BankingMercuryAccountingRulesModal({
  open,
  onClose,
  rulesLoading,
  rules,
  rulesFilteredForTable,
  rulesSortedForTable,
  rulesSearchNorm,
  rulesTableSearchText,
  setRulesTableSearchText,
  rulesTableSort,
  onRulesSortHeaderClick,
  labelById,
  ruleUsageApproved,
  labelsLoading,
  labelCount,
  applyRulesBusy,
  onNewRule,
  onAuditOverlaps,
  onApplyRules,
  onEditRule,
  onDeleteRule,
  zIndex = 1100,
}: BankingMercuryAccountingRulesModalProps) {
  const reactId = useId()
  const titleId = `${reactId}-rules-modal-title`
  const dialogId = `${reactId}-rules-modal-dialog`

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const newRuleDisabled = labelsLoading || labelCount === 0
  const auditDisabled = rulesLoading || rules.length === 0
  const applyDisabled = applyRulesBusy || rulesLoading

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          maxWidth: 760,
          width: '100%',
          maxHeight: 'min(88vh, 44rem)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexShrink: 0,
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            Rules ({rules.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280', flexShrink: 0 }}>
          All accounting label rules in this organization. Use the toolbar to add, audit, or apply them to
          transactions.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onNewRule}
            disabled={newRuleDisabled}
            style={{
              padding: '0.4rem 0.85rem',
              fontWeight: 600,
              background: newRuleDisabled ? '#e5e7eb' : '#2563eb',
              color: newRuleDisabled ? '#64748b' : '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: newRuleDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            New rule
          </button>
          <button
            type="button"
            onClick={onAuditOverlaps}
            disabled={auditDisabled}
            title="Find transactions matched by 2 or more rules"
            style={{
              padding: '0.4rem 0.85rem',
              fontWeight: 600,
              background: auditDisabled ? '#e5e7eb' : '#f1f5f9',
              color: auditDisabled ? '#64748b' : '#0f172a',
              border: auditDisabled ? '1px solid #e5e7eb' : '1px solid #e2e8f0',
              borderRadius: 6,
              cursor: auditDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            Audit overlaps
          </button>
          <button
            type="button"
            onClick={onApplyRules}
            disabled={applyDisabled}
            style={{
              padding: '0.4rem 0.85rem',
              fontWeight: 600,
              background: applyDisabled ? '#e5e7eb' : '#f1f5f9',
              color: applyDisabled ? '#64748b' : '#0f172a',
              border: applyDisabled ? '1px solid #e5e7eb' : '1px solid #e2e8f0',
              borderRadius: 6,
              cursor: applyDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {applyRulesBusy ? 'Applying…' : 'Apply rules to transactions'}
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {rulesLoading ? (
            <div style={{ color: '#64748b' }}>Loading rules…</div>
          ) : rules.length === 0 ? (
            <div style={{ color: '#64748b' }}>No rules yet.</div>
          ) : (
            <>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: '0.85rem',
                  marginBottom: '0.75rem',
                  width: '100%',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                <input
                  type="search"
                  aria-label="Search rules"
                  placeholder="Search rules…"
                  value={rulesTableSearchText}
                  onChange={(e) => setRulesTableSearchText(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                  }}
                />
              </label>
              {rulesFilteredForTable.length === 0 && rulesSearchNorm !== '' ? (
                <div style={{ color: '#64748b' }}>No rules match this search.</div>
              ) : (
                <div
                  style={{
                    overflow: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th
                          scope="col"
                          aria-sort={
                            rulesTableSort.column === 'name'
                              ? rulesTableSort.direction === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                          style={{ textAlign: 'left', padding: 0, borderBottom: '1px solid #e5e7eb' }}
                        >
                          <button
                            type="button"
                            onClick={() => onRulesSortHeaderClick('name')}
                            aria-label="Sort by name"
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              font: 'inherit',
                              color: 'inherit',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Name
                            {rulesTableSort.column === 'name'
                              ? rulesTableSort.direction === 'asc'
                                ? '\u00a0▲'
                                : '\u00a0▼'
                              : null}
                          </button>
                        </th>
                        <th
                          scope="col"
                          aria-sort={
                            rulesTableSort.column === 'label'
                              ? rulesTableSort.direction === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                          style={{ textAlign: 'left', padding: 0, borderBottom: '1px solid #e5e7eb' }}
                        >
                          <button
                            type="button"
                            onClick={() => onRulesSortHeaderClick('label')}
                            aria-label="Sort by label"
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              font: 'inherit',
                              color: 'inherit',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Label
                            {rulesTableSort.column === 'label'
                              ? rulesTableSort.direction === 'asc'
                                ? '\u00a0▲'
                                : '\u00a0▼'
                              : null}
                          </button>
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                          Enabled
                        </th>
                        <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
                          Approved uses
                        </th>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rulesSortedForTable.map((r) => {
                        const lbl = labelById.get(r.label_id)
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.name}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{lbl?.name ?? r.label_id.slice(0, 8)}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{r.enabled ? 'Yes' : 'No'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              {ruleUsageApproved[r.id] ?? 0}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <button
                                type="button"
                                onClick={() => onEditRule(r)}
                                style={{
                                  marginRight: 8,
                                  padding: '2px 8px',
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteRule(r)}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.8rem',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#b91c1c',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
