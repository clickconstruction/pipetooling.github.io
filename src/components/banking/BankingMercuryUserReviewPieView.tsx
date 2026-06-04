import { useEffect, useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatUsd } from './bankingMercuryDragSortLedger'
import {
  buildUserReviewPieData,
  PIE_OTHER_KEY,
  type PieDirection,
  type PieSlice,
} from '../../lib/bankingMercuryUserReviewPie'
import type { UserReviewLabelRow } from '../../lib/bankingMercuryUserReviewPivot'

const PIE_COLORS = [
  '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#0891b2',
  '#ea580c', '#4f46e5', '#db2777', '#059669', '#0d9488', '#7c3aed',
  '#64748b',
]
const OTHER_COLOR = '#cbd5e1'

function colorFor(slice: PieSlice, index: number): string {
  if (slice.key === PIE_OTHER_KEY) return OTHER_COLOR
  return PIE_COLORS[index % PIE_COLORS.length] ?? '#94a3b8'
}

type PrimaryDim = 'person' | 'category'

export type BankingMercuryUserReviewPieViewProps = {
  transactions: { id: string; amount: number }[]
  userIdByTxId: ReadonlyMap<string, string | null>
  personIdByTxId: ReadonlyMap<string, string | null>
  userNameById: Record<string, string>
  personNameById: Record<string, string>
  labelIdByTxId: ReadonlyMap<string, string | null>
  labels: UserReviewLabelRow[]
  /** Open the existing per-cell transaction modal (rowKey = person, colKey = category). */
  onOpenCell: (personKey: string, categoryKey: string) => void
}

const SEG_BTN = (active: boolean) =>
  ({
    padding: '0.3rem 0.7rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    border: '1px solid #d1d5db',
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer',
  }) as const

export function BankingMercuryUserReviewPieView({
  transactions,
  userIdByTxId,
  personIdByTxId,
  userNameById,
  personNameById,
  labelIdByTxId,
  labels,
  onOpenCell,
}: BankingMercuryUserReviewPieViewProps) {
  const [primary, setPrimary] = useState<PrimaryDim>('person')
  const [direction, setDirection] = useState<PieDirection>('out')
  const [drillKey, setDrillKey] = useState<string | null>(null)

  // Drilling only makes sense within the current primary dimension + direction.
  useEffect(() => {
    setDrillKey(null)
  }, [primary, direction])

  const data = useMemo(
    () =>
      buildUserReviewPieData({
        transactions,
        userIdByTxId,
        personIdByTxId,
        userNameById,
        personNameById,
        labelIdByTxId,
        allLabels: labels,
        direction,
      }),
    [transactions, userIdByTxId, personIdByTxId, userNameById, personNameById, labelIdByTxId, labels, direction],
  )

  const topSlices = primary === 'person' ? data.personSlices : data.categorySlices
  const drillSlices =
    drillKey != null
      ? (primary === 'person' ? data.drillByPerson.get(drillKey) : data.drillByCategory.get(drillKey)) ?? []
      : null
  const slices = drillSlices ?? topSlices
  const drillName = drillKey != null ? topSlices.find((s) => s.key === drillKey)?.name ?? '' : null

  const total = useMemo(() => slices.reduce((s, x) => s + x.value, 0), [slices])
  const otherDimLabel = primary === 'person' ? 'category' : 'person'

  const handleSliceClick = (slice: PieSlice | undefined) => {
    if (!slice || slice.key === PIE_OTHER_KEY) return
    if (drillKey == null) {
      setDrillKey(slice.key) // drill into this primary slice
    } else if (slice.personKey && slice.categoryKey) {
      onOpenCell(slice.personKey, slice.categoryKey) // leaf → existing transaction modal
    }
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
          <span style={{ color: '#6b7280' }}>By</span>
          <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }}>
            <button type="button" onClick={() => setPrimary('person')} style={{ ...SEG_BTN(primary === 'person'), borderRadius: '6px 0 0 6px' }}>
              Person
            </button>
            <button type="button" onClick={() => setPrimary('category')} style={{ ...SEG_BTN(primary === 'category'), borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>
              Category
            </button>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}>
          <span style={{ color: '#6b7280' }}>Show</span>
          <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }}>
            <button type="button" onClick={() => setDirection('out')} style={{ ...SEG_BTN(direction === 'out'), borderRadius: '6px 0 0 6px' }}>
              Spending
            </button>
            <button type="button" onClick={() => setDirection('in')} style={{ ...SEG_BTN(direction === 'in'), borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>
              Income
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>
        {drillKey == null ? (
          <span style={{ fontWeight: 600 }}>
            All {primary === 'person' ? 'people' : 'categories'} · {formatUsd(total)}
            <span style={{ fontWeight: 400, color: '#9ca3af' }}> · excludes internal transfers</span>
          </span>
        ) : (
          <span>
            <button
              type="button"
              onClick={() => setDrillKey(null)}
              style={{ all: 'unset', cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}
            >
              ← All {primary === 'person' ? 'people' : 'categories'}
            </button>
            <span style={{ color: '#9ca3af' }}> › </span>
            <span style={{ fontWeight: 700 }}>{drillName}</span>
            <span style={{ color: '#6b7280' }}> — by {otherDimLabel} · {formatUsd(total)}</span>
          </span>
        )}
      </div>

      {slices.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', border: '1px dashed #d1d5db', borderRadius: 6 }}>
          No {direction === 'out' ? 'spending' : 'income'} in this period{drillName ? ` for ${drillName}` : ''}.
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={150}
                  innerRadius={70}
                  paddingAngle={1}
                  onClick={(_, index) => handleSliceClick(slices[index])}
                  isAnimationActive={false}
                >
                  {slices.map((s, i) => (
                    <Cell
                      key={s.key}
                      fill={colorFor(s, i)}
                      stroke="#fff"
                      cursor={s.key === PIE_OTHER_KEY ? 'default' : 'pointer'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                    return [`${formatUsd(value)} (${pct}%)`, name]
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem', textAlign: 'center' }}>
            {drillKey == null
              ? `Click a ${primary} slice to break it down by ${otherDimLabel}.`
              : 'Click a slice to see its transactions.'}
          </div>
        </>
      )}
    </div>
  )
}
