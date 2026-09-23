import type { CSSProperties } from 'react'
import { describeRoundRow, roundHeadline, roundQueue, type RoundRow, type RoundState } from '../../lib/quickfill/round'

const dotColor: Record<RoundState, string> = {
  due: '#dc2626',
  never: '#dc2626',
  due_today: '#d97706',
  not_yet: 'var(--border-strong)',
  fresh: '#16a34a',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.6rem 0.75rem',
  minHeight: 56,
  border: 'none',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  boxSizing: 'border-box',
}

/**
 * The phone Quickfill (punch list #30, PR 3): the sections' marks as rows measured against
 * each section's own rhythm — due first, fresh last, the personal doors at the bottom.
 */
export function QuickfillRoundList({
  rows,
  search,
  onSearch,
  onOpen,
  now,
}: {
  rows: RoundRow[]
  search: string
  onSearch: (q: string) => void
  onOpen: (sectionId: string) => void
  now: Date
}) {
  const queue = roundQueue(rows)
  const q = search.trim().toLowerCase()
  const shown = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          <b>{roundHeadline(rows).split(' · ')[0]}</b>
          {roundHeadline(rows).includes(' · ') ? ` · ${roundHeadline(rows).split(' · ').slice(1).join(' · ')}` : ''}
        </div>
        {queue.length > 0 ? (
          <button
            type="button"
            onClick={() => onOpen(queue[0]!)}
            style={{ flexShrink: 0, padding: '0.4rem 0.7rem', borderRadius: 999, border: '1px solid var(--text-link)', background: 'var(--text-link)', color: '#fff', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            Round · {queue.length} ›
          </button>
        ) : (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-green-700)', fontWeight: 600 }}>Round done ✓</span>
        )}
      </div>
      <input
        type="search"
        placeholder="Search sections…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search Quickfill sections"
        style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: 16, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', marginBottom: '0.6rem' }}
      />
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No sections match your search.</p>
        ) : (
          shown.map((r) => (
            <button key={r.sectionId} type="button" onClick={() => onOpen(r.sectionId)} style={rowStyle} aria-label={`${r.label} — ${describeRoundRow(r, now)}`}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: r.personal ? 'var(--border-strong)' : dotColor[r.state], flexShrink: 0 }} />
              <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{describeRoundRow(r, now)}</span>
              </span>
              {r.personal ? (
                <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: '1.1rem' }}>›</span>
              ) : r.countSource === 'none' ? (
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
              ) : (
                <span style={{ textAlign: 'right', flexShrink: 0, minWidth: 40 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: '1rem', color: 'var(--text-strong)' }}>{r.count}</span>
                  <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{r.countSource === 'open' ? 'open' : 'at last look'}</span>
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
