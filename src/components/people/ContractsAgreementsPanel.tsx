import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  formatAgreementShortDate,
  type AgreementComplianceState,
  type AgreementSummary,
} from '../../lib/contractsAgreementsPanel'

/**
 * Desktop Agreements panel for People → Contracts (v2.1407): one card per
 * document with assigned · signed counts and a progress bar; expanding shows
 * per-person compliance (sent / last viewed / signed) with the chase states
 * called out. Presentational — the tab owns data and the jump-to-person hook.
 */

const STATE_CHIP: Record<Exclude<AgreementComplianceState, 'signed'>, { label: string; background: string; color: string }> = {
  viewed_not_signed: { label: 'viewed, not signed', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  never_opened: { label: 'never opened', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  unsent: { label: 'unsent', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
}

const thStyle: CSSProperties = {
  fontWeight: 500,
  padding: '0.2rem 0.3rem',
  textAlign: 'left',
  color: 'var(--text-muted)',
}

const tdStyle: CSSProperties = {
  padding: '0.25rem 0.3rem',
  borderTop: '1px solid var(--border)',
}

export function ContractsAgreementsPanel({
  summaries,
  onJumpToPerson,
  onHide,
}: {
  summaries: AgreementSummary[]
  onJumpToPerson: (personName: string) => void
  onHide: () => void
}) {
  const [expandedDocumentName, setExpandedDocumentName] = useState<string | null>(null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Agreements
        </p>
        <button
          type="button"
          onClick={onHide}
          style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          Hide
        </button>
      </div>
      {summaries.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No agreements yet — add documents in the Contract Book.</p>
      ) : null}
      {summaries.map((s) => {
        const expanded = expandedDocumentName === s.documentName
        const pct = s.assignedCount > 0 ? Math.round((s.signedCount / s.assignedCount) * 100) : 0
        return (
          <div
            key={s.documentName}
            style={{
              border: `1px solid ${expanded ? 'var(--border-strong)' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '0.55rem 0.7rem',
              marginBottom: '0.5rem',
              background: expanded ? 'var(--bg-subtle)' : 'var(--surface)',
            }}
          >
            <button
              type="button"
              onClick={() => setExpandedDocumentName((prev) => (prev === s.documentName ? null : s.documentName))}
              aria-expanded={expanded}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                {s.documentName}
              </span>
              <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
                {s.assignedCount} assigned ·{' '}
                <span style={{ color: 'var(--text-green-800)', fontWeight: 600 }}>{s.signedCount} signed</span>
              </span>
              <span aria-hidden style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {expanded ? '▾' : '▸'}
              </span>
            </button>
            <div
              aria-hidden
              style={{ marginTop: '0.4rem', height: 5, borderRadius: 3, background: 'var(--bg-200)', overflow: 'hidden' }}
              title={`${pct}% signed`}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e' }} />
            </div>
            {expanded ? (
              <div style={{ marginTop: '0.5rem' }}>
                {s.templateNames.length > 0 ? (
                  <p style={{ margin: '0 0 0.35rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Assigned via {s.templateNames.join(', ')}
                  </p>
                ) : null}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '30%' }}>Person</th>
                      <th style={thStyle}>Sent</th>
                      <th style={thStyle}>Last viewed</th>
                      <th style={{ ...thStyle, width: '32%' }}>Signed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r) => (
                      <tr key={r.personName}>
                        <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => onJumpToPerson(r.personName)}
                            title={`Jump to ${r.personName} in the people list`}
                            style={{ padding: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
                          >
                            {r.personName}
                          </button>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
                          {formatAgreementShortDate(r.sentAt) ?? (r.state === 'unsent' ? 'not sent' : '—')}
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text-600)', whiteSpace: 'nowrap' }}>
                          {formatAgreementShortDate(r.lastViewedAt) ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {r.state === 'signed' ? (
                            <span style={{ color: 'var(--text-green-800)', fontWeight: 600 }}>
                              {formatAgreementShortDate(r.signedAt) ?? '✓'}{formatAgreementShortDate(r.signedAt) ? ' ✓' : ''}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                padding: '0.1rem 0.4rem',
                                borderRadius: 999,
                                ...STATE_CHIP[r.state],
                              }}
                            >
                              {STATE_CHIP[r.state].label}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  &ldquo;Last viewed&rdquo; records from Aug 5, 2026 onward.
                </p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
