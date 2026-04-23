import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProspectTeamRow } from '../../lib/prospectTeamActivity'
import { buildProspectTeamActivityChartData } from '../../lib/prospectTeamActivityChartData'

const STROKE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#db2777',
  '#059669',
  '#0d9488',
  '#7c3aed',
]

type Props = {
  teamDataByDate: Record<string, ProspectTeamRow[]>
  teamLoading: boolean
  teamError: string | null
}

export function ProspectTeamActivityLineChart({ teamDataByDate, teamLoading, teamError }: Props) {
  const { chartRows, userSeries } = useMemo(
    () => buildProspectTeamActivityChartData(teamDataByDate),
    [teamDataByDate],
  )

  if (teamError) {
    return <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{teamError}</p>
  }
  if (teamLoading) {
    return <p style={{ color: '#6b7280' }}>Loading team activity…</p>
  }
  if (userSeries.length === 0 || chartRows.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No team roster to chart.</p>
  }

  const allZero = chartRows.every((row) =>
    userSeries.every((u) => (Number(row[u.userId]) || 0) === 0),
  )

  return (
    <div>
      {allZero && (
        <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
          No prospect activity in the last 30 days (marked or updated).
        </p>
      )}
      <div style={{ width: '100%', minHeight: 300, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartRows}
            margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tick={{ fontSize: 11 }}
              domain={[0, 'auto']}
            />
            <Tooltip contentStyle={{ fontSize: '0.8125rem' }} />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: '0.75rem', maxHeight: 120, overflowY: 'auto', paddingTop: 8 }}
            />
            {userSeries.map((u, i) => (
              <Line
                key={u.userId}
                type="monotone"
                name={u.name}
                dataKey={u.userId}
                stroke={STROKE_COLORS[i % STROKE_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
