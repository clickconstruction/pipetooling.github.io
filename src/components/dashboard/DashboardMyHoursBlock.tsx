/**
 * Your hours, inside My Time (design spike): the hours you said you can work in a week, this
 * week against them, and your last eight pay weeks as bars with the 100 percent line. The one
 * press is Set hours or Change, which opens the same window the office uses on People →
 * Utilization. Salaried people read the schedule's hours and have no press.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { defaultAvailabilityIo, type AvailabilityIo } from '../../lib/people/availabilityIo'
import { fetchMyUtilization } from '../../lib/people/fetchUtilizationBoard'
import { hoursOfWords, UTILIZATION_ASSUMED_HOURS, UTILIZATION_LONG_DAY_HOURS, type PersonUtilization } from '../../lib/people/utilization'
import { describeWeek } from '../../lib/people/weekAvailability'
import { AvailableHoursModal } from '../people/AvailableHoursModal'
import { BAND_FILL } from '../../lib/people/utilizationColors'
import { UtilizationWeekBars } from '../people/UtilizationWeekBars'

const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const PRESS: CSSProperties = { padding: '0.25rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }

export function DashboardMyHoursBlock({ userId, displayName, role, isSalary, framed = false, io: ioIn }: { userId: string; displayName: string; role: string; isSalary: boolean; /** Job Mode: a card of its own instead of a row inside My Time. */ framed?: boolean; io?: AvailabilityIo }) {
  const io = useMemo(() => ioIn ?? defaultAvailabilityIo(), [ioIn])
  const [row, setRow] = useState<PersonUtilization | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    try {
      const read = await fetchMyUtilization({ userId, name: displayName, role, isSalary, io })
      setRow(read.board.people[0] ?? null)
    } catch {
      setRow(null)
    }
  }, [userId, displayName, role, isSalary, io])
  useEffect(() => {
    void load()
  }, [load])
  if (row === undefined) return null
  const current = row?.weeks[row.weeks.length - 1] ?? null
  const last = row?.lastFullWeek ?? null
  const canWork = row?.canWork ?? { hours: UTILIZATION_ASSUMED_HOURS, source: isSalary ? ('schedule' as const) : ('assumed' as const), setAt: null, setBy: null, days: null }
  const asked = canWork.source !== 'assumed'
  const weekLine = current && current.workedHours > 0 ? `This week ${hoursOfWords(current.workedHours, current.availableHours)} so far.` : null
  const outside = last?.outsideHours != null && last.outsideHours >= 0.5 ? `, ${last.outsideHours} h outside the hours you drew` : ''
  const lastLine = last && last.workedHours > 0 ? `Last week ${hoursOfWords(last.workedHours, last.availableHours)}${last.pct != null ? `, ${last.pct} percent` : ''}${last.longDays ? `, ${last.longDays} day${last.longDays === 1 ? '' : 's'} over ${UTILIZATION_LONG_DAY_HOURS} hours` : ''}${outside}.` : null
  const drawnWords = canWork.days ? describeWeek(canWork.days) : null
  return (
    <div
      style={
        framed
          ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1rem', marginTop: '0.75rem' }
          : { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-subtle)', borderRadius: 6, padding: '0.5rem 0.7rem', marginBottom: '0.75rem' }
      }
      data-testid="my-hours-block"
    >
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            {canWork.source === 'schedule' ? `Salaried: the schedule is ${canWork.hours} h a week.` : asked ? `You can work ${canWork.hours} h a week.` : 'How many hours a week can you work?'}
          </span>
          {canWork.source !== 'schedule' ? (
            <button type="button" style={PRESS} onClick={() => setOpen(true)}>
              {asked ? 'Change' : 'Set hours'}
            </button>
          ) : null}
        </div>
        {drawnWords ? <span style={{ ...MUTED, color: 'var(--text-700)' }}>{drawnWords}</span> : null}
        <span style={MUTED}>{[weekLine, lastLine].filter(Boolean).join(' ') || (asked ? 'Nothing on the clock yet these weeks.' : `Until you answer, the office assumes ${UTILIZATION_ASSUMED_HOURS} h.`)}</span>
      </div>
      {row ? (
        <div style={{ display: 'grid', gap: 2, justifyItems: 'end' }}>
          <UtilizationWeekBars weeks={row.weeks} height={30} />
          <span style={{ ...MUTED, fontSize: '0.68rem' }}>
            {row.weeks.length} weeks · <span style={{ color: BAND_FILL.over }}>over</span> · <span style={{ color: BAND_FILL.full }}>full</span> · <span style={{ color: BAND_FILL.ok }}>steady</span> · <span style={{ color: BAND_FILL.light }}>light</span>
          </span>
        </div>
      ) : null}
      <AvailableHoursModal open={open} subject={{ userId, name: displayName }} current={row?.canWork ?? null} isSelf setBy={userId} io={io} onClose={() => setOpen(false)} onSaved={() => void load()} />
    </div>
  )
}
