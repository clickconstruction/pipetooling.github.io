import type { ReactNode } from 'react'
import { formatHours1, formatHours2, formatWindow, type TeamBoardSubSheet, type TeamCell, type TeamTargetLabel } from '../../../lib/teamBoard'
import { chipStyle, toneForCell } from './teamBoardStyles'
import { TeamTimeTrack } from './TeamTimeTrack'

const subLine = (text: string, extra?: React.CSSProperties) => (
  <span style={{ gridColumn: '1 / -1', fontSize: '0.6875rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...extra }}>{text}</span>
)

/**
 * One person-on-one-target-on-one-day. `lens` decides the name on the chip:
 * the person (rows are jobs) or the target (rows are people). `actions`
 * renders under the track when a caller provides them.
 */
export function TeamChip({
  cell,
  lens,
  label,
  suggestion,
  actions,
}: {
  cell: TeamCell
  lens: 'job' | 'person'
  label: TeamTargetLabel | undefined
  /** For unlinked cells: the dispatch block that day, already formatted ("J650 · ATI Schertz 8a–4p"). */
  suggestion?: string | null
  actions?: ReactNode
}) {
  const tone = toneForCell(cell)
  const who = lens === 'person' ? (label?.label ?? cell.targetKey) : cell.personName
  const clockText = cell.clock.map(formatWindow).join(', ')
  const planText = cell.plan.map(formatWindow).join(', ')
  const hoursText = cell.clockHours > 0 ? `${formatHours2(cell.clockHours)} h` : `plan ${formatHours1(cell.planHours)} h`
  let title: string
  let sub: ReactNode = null
  if (cell.kind === 'unlinked') {
    title = `${cell.personName} · ${formatHours2(cell.clockHours)} h with no job or bid · ${clockText}`
    sub = subLine(suggestion ? `dispatch: ${suggestion}` : 'nothing on the dispatch plan')
  } else if (cell.kind === 'office') {
    title = `${cell.personName} · office · ${clockText || planText}`
  } else if (cell.kind === 'ok') {
    title = `${cell.personName} · clocked ${clockText} · planned ${planText}${cell.over ? (cell.acked ? ' · ran long, accepted' : ' · ran long') : ''}`
    sub = subLine(`${cell.acked ? '✓ accepted · ' : ''}plan ${formatHours1(cell.planHours)} h · ${planText}`, { fontVariantNumeric: 'tabular-nums' })
  } else if (cell.kind === 'unplanned') {
    title = `${cell.personName} · clocked ${clockText} · nothing on the dispatch plan for this job${cell.acked ? ' · accepted' : ''}`
    sub = subLine(`${cell.acked ? '✓ accepted · ' : ''}not on the plan · ${clockText}`)
  } else {
    title = `${cell.personName} · planned ${planText} · no clock on this job`
    sub = subLine(`${planText} · no clock`)
  }
  return (
    <div style={chipStyle(tone)} title={title} data-team-cell={`${cell.targetKey}|${cell.workDate}|${cell.personName}`}>
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</span>
      <span style={{ fontWeight: cell.kind === 'miss' ? 500 : 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {cell.over ? <span aria-label="ran long" style={{ fontSize: '0.6875rem' }}>▲ </span> : null}
        {hoursText}
        {cell.pending ? <span style={{ fontWeight: 500 }}> · pending</span> : null}
      </span>
      <span style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
        <TeamTimeTrack plan={cell.plan} clock={cell.clock} tone={tone} />
      </span>
      {sub}
      {actions ? <span style={{ gridColumn: '1 / -1', marginTop: '0.25rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>{actions}</span> : null}
    </div>
  )
}

export function TeamSubSheetChip({ sheet, lens, label }: { sheet: TeamBoardSubSheet; lens: 'job' | 'person'; label: TeamTargetLabel | undefined }) {
  return (
    <div style={chipStyle('sub')} title={`Sub sheet · ${sheet.contractor} · ${sheet.stage}`}>
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lens === 'person' ? (label?.label ?? sheet.jobNumber ?? 'Sub sheet') : sheet.contractor}</span>
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>sub sheet</span>
      {subLine(`where it stands: ${sheet.stage}`)}
    </div>
  )
}
