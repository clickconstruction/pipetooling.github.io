// Ranked bars — every person on one axis, losses drawn left of a zero line.
// Clicking a name selects the person (same pointer the Team Summary table
// uses), which opens the math drawer beside the list and the person panel
// below it.

import {
  REVIEW_GROUP_LABEL,
  REVIEW_RANK_BY_LABEL,
  type ReviewRankBy,
  type ReviewRankedBars,
} from '../../../lib/people/reviewRanked'
import { fmtMoney } from '../teamSummary/formatters'

const RANK_OPTIONS: ReviewRankBy[] = ['profit', 'profitPerHour', 'gross', 'net']

export function PeopleReviewRankedList({
  ranked,
  rankBy,
  onRankByChange,
  search,
  onSearchChange,
  selectedName,
  onTogglePerson,
  refreshing,
}: {
  ranked: ReviewRankedBars
  rankBy: ReviewRankBy
  onRankByChange: (next: ReviewRankBy) => void
  search: string
  onSearchChange: (next: string) => void
  selectedName: string | null
  onTogglePerson: (name: string) => void
  refreshing: boolean
}) {
  const isPerHour = rankBy === 'profitPerHour'
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Ranked · {REVIEW_RANK_BY_LABEL[rankBy]}
          <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>losses draw left of the line</span>
        </div>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: '0.8rem', color: 'var(--text-700)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Rank by
          <select
            value={rankBy}
            onChange={(e) => onRankByChange(e.target.value as ReviewRankBy)}
            style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-base)' }}
          >
            {RANK_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {REVIEW_RANK_BY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name…"
          aria-label="Search people by name"
          style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8rem', minWidth: 150, background: 'var(--surface)', color: 'var(--text-base)' }}
        />
      </div>
      {refreshing && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Refreshing…</div>
      )}
      <div style={{ display: 'grid', gap: 5 }} role="list">
        {ranked.bars.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No one matches that search.</div>
        )}
        {ranked.bars.map((b) => {
          const selected = b.name === selectedName
          const neg = b.value != null && b.value < 0
          const valueText = b.value == null ? '—' : isPerHour ? `${fmtMoney(b.value)}/hr` : fmtMoney(b.value)
          return (
            <div
              key={b.name}
              role="listitem"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(96px, 150px) minmax(0, 1fr) 92px',
                gap: 10,
                alignItems: 'center',
                fontSize: '0.82rem',
              }}
            >
              <button
                type="button"
                onClick={() => onTogglePerson(b.name)}
                aria-pressed={selected}
                title={`${b.name} · ${REVIEW_GROUP_LABEL[b.group]} · ${b.sub}`}
                style={{
                  font: 'inherit',
                  fontWeight: 600,
                  textAlign: 'left',
                  background: 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  color: selected ? 'var(--text-link)' : 'var(--text-base)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {selected ? '▾ ' : ''}
                {b.name}
                {b.group === 'office' && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> office</small>}
                {b.group === 'none' && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> no time</small>}
                {b.salaried && b.group === 'field' && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (s)</small>}
              </button>
              <div
                style={{ position: 'relative', height: 16, background: 'var(--bg-muted)', borderRadius: 3, overflow: 'hidden' }}
                aria-hidden="true"
              >
                <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${ranked.zeroPct}%`, width: 1, background: 'var(--text-faint)' }} />
                {b.value != null && b.widthPct > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${b.startPct}%`,
                      width: `${b.widthPct}%`,
                      background: neg ? 'var(--text-red-700)' : '#15803d',
                      opacity: selected ? 1 : 0.85,
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: b.value == null ? 'var(--text-faint)' : neg ? 'var(--text-red-700)' : 'var(--text-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                {b.group === 'none' && b.value === 0 ? <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>no time</span> : valueText}
              </div>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        Office & bids rows are negative by construction: their wages are the overhead pool. The Overhead tab is where that pool is judged; here it only shows who it is. Click a name for the math.
      </p>
    </div>
  )
}
