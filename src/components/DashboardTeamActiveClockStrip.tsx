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

const scopeBtn = (active: boolean): CSSProperties => ({
  padding: '0.2rem 0.45rem',
  fontSize: '0.7rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: active ? '#e5e7eb' : 'white',
  cursor: 'pointer',
  color: '#374151',
  fontWeight: active ? 600 : 500,
})

/** Compact read-only summary of open clock sessions (Dashboard My Team). Mount only when `sessions.length > 0` so the tick interval is not left running. */
export function DashboardTeamActiveClockStrip({
  sessions,
  hoursTodayByUserId,
  showScopeToggle = false,
  clockStripScope = 'team',
  onClockStripScopeChange,
}: {
  sessions: ClockSessionRow[]
  hoursTodayByUserId: Readonly<Record<string, number>>
  showScopeToggle?: boolean
  clockStripScope?: 'team' | 'everyone'
  onClockStripScopeChange?: (scope: 'team' | 'everyone') => void
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
      {showScopeToggle && onClockStripScopeChange && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.35rem',
            padding: '0.35rem 0.5rem',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div role="group" aria-label="Clocked-in list scope">
            <button
              type="button"
              aria-pressed={clockStripScope === 'team'}
              onClick={() => onClockStripScopeChange('team')}
              style={{ ...scopeBtn(clockStripScope === 'team'), borderTopRightRadius: 0, borderBottomRightRadius: 0, marginRight: -1 }}
            >
              My team
            </button>
            <button
              type="button"
              aria-pressed={clockStripScope === 'everyone'}
              onClick={() => onClockStripScopeChange('everyone')}
              style={{ ...scopeBtn(clockStripScope === 'everyone'), borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
            >
              Everyone
            </button>
          </div>
        </div>
      )}
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
