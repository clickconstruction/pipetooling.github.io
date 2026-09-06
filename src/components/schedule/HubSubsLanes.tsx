/**
 * Subs lanes on the dispatch People tab (v2.2929): read-only rows fed from
 * sub work orders — a pick is a solid chip, a window a striped one, an
 * unanswered offer a dashed one. Nothing here is a schedule block; a chip
 * opens the job. Sits under the crew grid with the same day columns.
 */
import type { SubLane } from '../../lib/subs/subDispatch'

export type HubSubsLanesProps = {
  lanes: SubLane[]
  visibleDayKeys: string[]
  scheduleTodayYmd: string
  onOpenJob: (jobId: string) => void
}

function dayHeader(dk: string): string {
  const d = new Date(dk + 'T00:00:00Z')
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()}`
}

const chipStyle = (kind: 'pick' | 'window' | 'offered', clickable: boolean) =>
  ({
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'left',
    padding: '3px 6px',
    marginBottom: 3,
    borderRadius: 5,
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: clickable ? 'pointer' : 'default',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: kind === 'pick' ? 'var(--text-green-700)' : 'var(--text-muted)',
    background: kind === 'pick' ? 'var(--bg-green-tint)' : kind === 'window' ? 'repeating-linear-gradient(90deg, var(--bg-subtle) 0 5px, var(--surface) 5px 10px)' : 'transparent',
    border: kind === 'offered' ? '1px dashed var(--border-strong)' : kind === 'pick' ? '1px solid var(--border-green)' : '1px solid var(--border)',
  }) as const

export function HubSubsLanes({ lanes, visibleDayKeys, scheduleTodayYmd, onOpenJob }: HubSubsLanesProps) {
  if (lanes.length === 0) return null
  return (
    <div data-testid="hub-subs-lanes" style={{ marginTop: '0.9rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0.45rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Subs</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>from their work orders · read-only · a chip opens the job</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', marginRight: 4, verticalAlign: -1 }} />picked</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(90deg, var(--bg-subtle) 0 3px, var(--surface) 3px 6px)', border: '1px solid var(--border)', marginRight: 4, verticalAlign: -1 }} />window, not picked</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, border: '1px dashed var(--border-strong)', marginRight: 4, verticalAlign: -1 }} />offer out</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg, var(--border) 0 3px, var(--bg-subtle) 3px 6px)', marginRight: 4, verticalAlign: -1 }} />day off</span>
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 120 + visibleDayKeys.length * 96 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.3rem 0.6rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Sub</th>
            {visibleDayKeys.map((dk) => (
              <th key={dk} style={{ padding: '0.3rem 0.35rem', fontSize: '0.68rem', color: dk === scheduleTodayYmd ? 'var(--text-blue-700)' : 'var(--text-muted)', fontWeight: dk === scheduleTodayYmd ? 700 : 600, borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                {dayHeader(dk)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.personId} data-testid="hub-subs-lane">
              <td style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                {lane.name}
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>{lane.total} work order{lane.total === 1 ? '' : 's'} this week</div>
              </td>
              {visibleDayKeys.map((dk) => {
                const items = lane.cells.get(dk) ?? []
                const off = lane.offDays.has(dk)
                return (
                  <td key={dk} title={off ? 'Day off (marked on their portal)' : undefined} style={{ padding: '0.3rem 0.35rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', verticalAlign: 'top', maxWidth: 160, background: off ? 'repeating-linear-gradient(45deg, var(--border) 0 4px, var(--bg-subtle) 4px 8px)' : dk === scheduleTodayYmd ? 'var(--bg-blue-tint)' : undefined }}>
                    {off && items.length === 0 ? <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>off</span> : null}
                    {items.map((it) => (
                      <button key={`${it.orderId}:${dk}`} type="button" title={it.title} onClick={() => it.jobId && onOpenJob(it.jobId)} style={chipStyle(it.kind, !!it.jobId)} disabled={!it.jobId}>
                        {it.kind === 'offered' ? '? ' : ''}{it.label}
                      </button>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default HubSubsLanes
