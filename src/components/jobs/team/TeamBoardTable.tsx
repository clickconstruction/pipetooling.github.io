import type { ReactNode } from 'react'
import { formatBoardDay, formatHours1, formatWindow, hhmmToHours, type TeamBoard, type TeamCell, type TeamRow } from '../../../lib/teamBoard'
import type { TeamBoardBlock } from '../../../lib/teamBoard'
import { barTrack } from './teamBoardStyles'
import { TeamChip, TeamSubSheetChip } from './TeamChip'

const th: React.CSSProperties = { position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 2, padding: '0.55rem 0.6rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-700)', fontSize: '0.8125rem', borderBottom: '1px solid var(--border)' }

function RowHead({ row, maxHours }: { row: TeamRow; maxHours: number }) {
  const isNone = row.kind === 'none', isOffice = row.kind === 'office', isPerson = row.kind === 'person'
  const mx = isOffice || isPerson ? Math.max(row.planned, row.clocked, row.target ?? 0, 1) : Math.max(maxHours, 1)
  const bar = (label: string, value: number, color: string) => (
    <>
      <span>{label}</span>
      <span style={barTrack}>
        <i style={{ display: 'block', height: '100%', borderRadius: 3, width: `${Math.round((value / mx) * 100)}%`, background: color }} />
      </span>
      <span style={{ textAlign: 'right', color: 'var(--text-700)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatHours1(value)} h</span>
    </>
  )
  return (
    <>
      <div style={{ fontWeight: 600, color: isNone ? 'var(--text-amber-700)' : 'var(--text-strong)' }}>{row.label}</div>
      {row.sub ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem' }}>{row.sub}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '3.6rem 1fr 3rem', gap: '0.15rem 0.4rem', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        {isNone ? bar('To sort', row.clocked, '#f59e0b') : (
          <>
            {bar(isPerson && row.target != null && row.planned === 0 ? 'Target' : 'Planned', isPerson && row.target != null && row.planned === 0 ? row.target : row.planned, 'var(--border-strong)')}
            {bar('Clocked', row.clocked, isOffice ? 'var(--text-faint-300)' : '#22c55e')}
          </>
        )}
      </div>
    </>
  )
}

export type TeamCellActions = (cell: TeamCell) => ReactNode

export function TeamBoardTable({
  board,
  lens,
  hideOffice,
  onlyExceptions,
  blocksByDayPerson,
  renderActions,
  focusKey,
}: {
  board: TeamBoard
  lens: 'job' | 'person'
  hideOffice: boolean
  onlyExceptions: boolean
  /** `${workDate}|${personName}` → that person's blocks, for the unlinked-chip suggestion. */
  blocksByDayPerson: Map<string, TeamBoardBlock[]>
  renderActions?: TeamCellActions
  /** Row key to flash + scroll into view (the `?teamLaborJob=` deep link). */
  focusKey?: string | null
}) {
  const rows = (lens === 'person' ? board.personRows : board.jobRows).filter((r) => !(hideOffice && r.kind === 'office') && !(onlyExceptions && !r.hasException))
  const maxHours = Math.max(0, ...board.jobRows.filter((r) => r.kind !== 'office' && r.kind !== 'none').map((r) => Math.max(r.clocked, r.planned)))
  const suggestionFor = (c: TeamCell): string | null => {
    const b = (blocksByDayPerson.get(`${c.workDate}|${c.personName}`) ?? []).slice().sort((x, y) => x.timeStart.localeCompare(y.timeStart))[0]
    if (!b) return null
    const key = b.jobId ? `job:${b.jobId}` : b.bidId ? `bid:${b.bidId}` : null
    const lbl = key ? (board.labels[key]?.label ?? key) : 'unassigned block'
    return `${lbl} ${formatWindow({ start: hhmmToHours(b.timeStart), end: hhmmToHours(b.timeEnd) })}`
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1240, fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 262, minWidth: 262 }}>{lens === 'person' ? 'Person' : 'Job'}</th>
            {board.days.map((d, i) => {
              const t = board.dayTotals[i]!
              return (
                <th key={d} style={th}>
                  <span style={{ color: 'var(--text-strong)' }}>{formatBoardDay(d)}</span>
                  <span style={{ display: 'block', fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.1rem', fontVariantNumeric: 'tabular-nums' }}>
                    {formatHours1(t.clocked)} h clocked · {formatHours1(t.planned)} h planned
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '1rem', color: 'var(--text-muted)' }}>Nothing on the board for this week.</td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const rowBg = row.kind === 'office' ? 'var(--bg-subtle)' : row.kind === 'none' ? 'var(--bg-amber-tint)' : 'var(--surface)'
            const focused = focusKey != null && row.key === focusKey
            return (
              <tr key={row.key} data-team-row={row.key} style={{ background: focused ? 'var(--bg-blue-tint)' : rowBg }}>
                <td style={{ padding: '0.55rem 0.6rem', position: 'sticky', left: 0, zIndex: 1, background: focused ? 'var(--bg-blue-tint)' : rowBg, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <RowHead row={row} maxHours={maxHours} />
                </td>
                {board.days.map((d) => {
                  const cells = row.cellsByDay[d] ?? []
                  const sheets = lens === 'job' ? (row.subSheetsByDay[d] ?? []) : []
                  return (
                    <td key={d} style={{ padding: '0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {cells.map((c) => (
                          <TeamChip key={`${c.targetKey}|${c.personName}`} cell={c} lens={lens} label={board.labels[c.targetKey]} suggestion={c.kind === 'unlinked' ? suggestionFor(c) : null} actions={renderActions?.(c)} />
                        ))}
                        {sheets.map((s) => (
                          <TeamSubSheetChip key={s.id} sheet={s} lens={lens} label={board.labels[row.key]} />
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
