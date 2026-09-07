import type { ReactNode } from 'react'
import { formatBoardDay, formatHours1, formatHours2, formatWindow, teamCellStanding, teamLedgerRows, type TeamBoard, type TeamCell } from '../../../lib/teamBoard'
import { pill, toneForCell } from './teamBoardStyles'
import { TeamTimeTrack } from './TeamTimeTrack'

const th: React.CSSProperties = { position: 'sticky', top: 0, background: 'var(--bg-subtle)', textAlign: 'left', padding: '0.55rem 0.6rem', fontWeight: 600, color: 'var(--text-700)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }

/** The Subs-tab shape for people on the clock: one row per person-day-target, "where it stands" in the same vocabulary. */
export function TeamLedgerTable({ board, hideOffice, onlyExceptions, renderActions }: { board: TeamBoard; hideOffice: boolean; onlyExceptions: boolean; renderActions?: (cell: TeamCell) => ReactNode }) {
  const rows = teamLedgerRows(board).filter((c) => !(hideOffice && c.kind === 'office') && !(onlyExceptions && (c.kind === 'ok' && !c.over || c.kind === 'office')))
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100, fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            <th style={th}>Date</th><th style={th}>Job</th><th style={th}>Person</th><th style={th}>Plan vs clock · 6a–12a</th><th style={th}>Plan</th><th style={th}>Clocked</th>
            <th style={{ ...th, textAlign: 'right' }}>Hours</th><th style={{ ...th, textAlign: 'right' }}>Plan h</th><th style={{ ...th, textAlign: 'right' }}>Δ</th><th style={th}>Payroll</th><th style={th}>Where it stands</th>{renderActions ? <th style={th}></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={12} style={{ padding: '1rem', color: 'var(--text-muted)' }}>Nothing to list for this week.</td></tr>
          ) : null}
          {rows.map((c) => {
            const st = teamCellStanding(c)
            const lbl = board.labels[c.targetKey]
            const delta = c.clockHours > 0 && c.planHours > 0 ? c.clockHours - c.planHours : null
            return (
              <tr key={`${c.targetKey}|${c.workDate}|${c.personName}`}>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatBoardDay(c.workDate)}</td>
                <td style={td}>{c.kind === 'unlinked' ? <b style={{ color: 'var(--text-amber-700)' }}>No job</b> : <b style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{lbl?.label ?? c.targetKey}</b>}</td>
                <td style={td}>{c.personName}</td>
                <td style={td}><TeamTimeTrack plan={c.plan} clock={c.clock} tone={toneForCell(c)} width={150} /></td>
                <td style={{ ...td, ...mono }}>{c.plan.map(formatWindow).join(', ') || '—'}</td>
                <td style={{ ...td, ...mono }}>{c.clock.map(formatWindow).join(', ') || '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.clockHours > 0 ? formatHours2(c.clockHours) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.planHours > 0 ? formatHours1(c.planHours) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: delta != null && delta > 0 ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: delta != null && delta > 0 ? 600 : 400 }}>{delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatHours1(delta)}`}</td>
                <td style={{ ...td, color: c.pending ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: c.pending ? 600 : 400 }}>{c.clockHours > 0 ? (c.pending ? 'pending' : 'approved') : '—'}</td>
                <td style={td}><span style={pill(st.tone)}>{st.text}</span></td>
                {renderActions ? <td style={td}><span style={{ display: 'flex', gap: '0.3rem' }}>{renderActions(c)}</span></td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
