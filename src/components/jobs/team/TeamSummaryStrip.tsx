import type { ReactNode } from 'react'
import { formatHours1, type TeamBoard } from '../../../lib/teamBoard'
import { barTrack } from './teamBoardStyles'

function Tile({ k, v, s, alert, children }: { k: string; v: ReactNode; s?: ReactNode; alert?: boolean; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', minWidth: 0 }}>
      <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: alert ? 'var(--text-amber-700)' : 'var(--text-strong)', lineHeight: 1.15, marginTop: '0.15rem', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{s}</div> : null}
      {children}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <>
      <span>{label}</span>
      <span style={barTrack}>
        <i style={{ display: 'block', height: '100%', borderRadius: 3, width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`, background: color }} />
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours1(value)} h</span>
    </>
  )
}

export function TeamSummaryStrip({ board }: { board: TeamBoard }) {
  const s = board.summary
  const max = Math.max(s.plannedField, s.clockedField)
  const onPlanPct = s.clockedField > 0 ? Math.round((s.onPlanHours / s.clockedField) * 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
      <Tile k="Field time, week" v={`${formatHours1(s.clockedField)} h`}>
        <div style={{ display: 'grid', gridTemplateColumns: '4.2rem 1fr auto', gap: '0.25rem 0.5rem', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Bar label="Planned" value={s.plannedField} max={max} color="var(--border-strong)" />
          <Bar label="Clocked" value={s.clockedField} max={max} color="#22c55e" />
        </div>
      </Tile>
      <Tile k="On plan" v={`${onPlanPct}%`} s={`${formatHours1(s.onPlanHours)} h landed where dispatch put them · ${s.overCount} ran long`} />
      <Tile k="Not on a job" v={`${formatHours1(s.unlinkedHours)} h`} s={`${s.unlinkedSessions} ${s.unlinkedSessions === 1 ? 'session' : 'sessions'} · ${s.pendingUnlinked} pending approval`} alert={s.unlinkedSessions > 0} />
      <Tile k="Planned, no clock" v={s.missCount} s="person-days with a dispatch block and no punch" alert={s.missCount > 0} />
    </div>
  )
}
