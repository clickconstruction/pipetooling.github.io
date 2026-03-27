import type { CSSProperties } from 'react'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import type { ClockSessionRow } from '../types/clockSessions'

const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

function personName(s: ClockSessionRow): string {
  return s.users?.name?.trim() ?? 'Unknown'
}

/** Elapsed since clock-in for an open session, using `nowMs` instead of Date.now() for testability and tick alignment. */
function formatElapsedOpen(clockedInAt: string, nowMs: number): string {
  const inMs = new Date(clockedInAt).getTime()
  const sec = Math.max(0, Math.floor((nowMs - inMs) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

const th = {
  padding: '0.25rem 0.4rem',
  textAlign: 'left' as const,
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#374151',
}
const td = {
  padding: '0.2rem 0.4rem',
  fontSize: '0.75rem',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle' as const,
}

function formatHoursH(h: number): string {
  return `${h.toFixed(2)}h`
}

/** Compact read-only summary of open clock sessions (Dashboard My Team). Mount only when `sessions.length > 0` so the tick interval is not left running. */
export function DashboardTeamActiveClockStrip({
  sessions,
  hoursTodayByUserId,
}: {
  sessions: ClockSessionRow[]
  hoursTodayByUserId: Readonly<Record<string, number>>
}) {
  const nowMs = useIntervalNowMs(45_000)

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div style={{ overflowX: 'auto' }} aria-live="polite">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th scope="col" style={{ ...th, position: 'relative' as const }}>
                <span style={srOnly}>Name</span>
                Currently clocked in ({sessions.length})
              </th>
              <th scope="col" style={th}>
                Clocked in
              </th>
              <th scope="col" style={{ ...th, textAlign: 'right' as const }}>
                Elapsed
              </th>
              <th scope="col" style={{ ...th, textAlign: 'right' as const }}>
                Today
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const inDate = new Date(s.clocked_in_at)
              const todayH = hoursTodayByUserId[s.user_id] ?? 0
              return (
                <tr key={s.id}>
                  <td style={td}>{personName(s)}</td>
                  <td style={{ ...td, color: '#4b5563' }}>{inDate.toLocaleTimeString(undefined, timeOpts)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>
                    {formatElapsedOpen(s.clocked_in_at, nowMs)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                    {formatHoursH(todayH)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
