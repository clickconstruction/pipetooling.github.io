/**
 * The sub's calendar (v2.2928): the weeks of the window, weekdays only, tap a
 * start and the job's working days light up to its end. Days outside the
 * window, weekends and days behind today are dead. Pure over the shared
 * pick kernel; the parent owns the value and the submit.
 */
import { useMemo } from 'react'
import { addDays, isWeekendYmd, pickEndFromStart, pickableStarts } from '../../../supabase/functions/_shared/subPick'
import { COPPER, FAINT, HAIR, INK, MUTED } from '../../lib/portal/portalTheme'
import type { SubPortalLang } from '../../lib/subPortal/subPortalI18n'

export type SubPortalDatePickerProps = {
  window: { start: string; end: string }
  workDays: number | null
  todayYmd: string
  lang: SubPortalLang
  value: string | null
  onChange: (start: string | null) => void
  disabled?: boolean
}

const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DOW_ES = ['lun', 'mar', 'mié', 'jue', 'vie']
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function mondayOnOrBefore(ymd: string): string {
  let d = ymd
  while (new Date(d + 'T00:00:00Z').getUTCDay() !== 1) d = addDays(d, -1)
  return d
}

export function SubPortalDatePicker({ window, workDays, todayYmd, lang, value, onChange, disabled }: SubPortalDatePickerProps) {
  const starts = useMemo(() => new Set(pickableStarts(window, workDays, todayYmd)), [window, workDays, todayYmd])
  const pickedEnd = value ? pickEndFromStart(value, workDays) : null
  const weeks = useMemo(() => {
    const rows: string[][] = []
    for (let monday = mondayOnOrBefore(window.start); monday <= window.end; monday = addDays(monday, 7)) {
      const row: string[] = []
      for (let i = 0; i < 5; i++) row.push(addDays(monday, i))
      rows.push(row)
    }
    return rows
  }, [window])
  const dow = lang === 'es' ? DOW_ES : DOW_EN
  const mon = lang === 'es' ? MON_ES : MON_EN
  const monthOf = (ymd: string) => mon[Number(ymd.slice(5, 7)) - 1]

  let lastMonth = ''
  return (
    <div role="group" aria-label={lang === 'es' ? 'Elija su día de inicio' : 'Pick your start day'} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5, fontSize: 12.5 }}>
      {dow.map((d) => (
        <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT }}>
          {d}
        </div>
      ))}
      {weeks.flatMap((row) =>
        row.map((ymd) => {
          const inWindow = ymd >= window.start && ymd <= window.end
          const pickable = starts.has(ymd) && !disabled
          const inPick = value && pickedEnd ? ymd >= value && ymd <= pickedEnd : false
          const isStart = value === ymd
          const m = monthOf(ymd) ?? ''
          const showMonth = m !== lastMonth && (ymd.slice(8) === '01' || lastMonth === '')
          lastMonth = m
          const dead = !inWindow || isWeekendYmd(ymd) || ymd < todayYmd
          return (
            <button
              key={ymd}
              type="button"
              disabled={!pickable}
              onClick={() => onChange(isStart ? null : ymd)}
              aria-pressed={isStart}
              aria-label={ymd}
              style={{
                minHeight: 42,
                borderRadius: 7,
                border: `1px solid ${inPick ? COPPER : inWindow ? COPPER : 'transparent'}`,
                background: inPick ? COPPER : inWindow && !dead ? '#f6e6d8' : 'transparent',
                color: inPick ? '#fff' : dead ? FAINT : INK,
                fontWeight: isStart ? 800 : inWindow ? 600 : 400,
                cursor: pickable ? 'pointer' : 'default',
                opacity: !inWindow ? 0.45 : dead && !inPick ? 0.6 : 1,
                lineHeight: 1.1,
                padding: '4px 0',
                fontFamily: 'inherit',
              }}
              title={pickable ? `${ymd} → ${pickEndFromStart(ymd, workDays)}` : undefined}
            >
              <span style={{ display: 'block', fontSize: 13 }}>{Number(ymd.slice(8))}</span>
              {showMonth ? <span style={{ display: 'block', fontSize: 9, color: inPick ? '#fbe6d4' : MUTED }}>{m}</span> : null}
            </button>
          )
        }),
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: MUTED, marginTop: 2 }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f6e6d8', border: `1px solid ${COPPER}`, marginRight: 4, verticalAlign: -1 }} />{lang === 'es' ? 'Ventana' : 'Window'}</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: COPPER, marginRight: 4, verticalAlign: -1 }} />{lang === 'es' ? 'Sus días' : 'Your days'}</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, border: `1px solid ${HAIR}`, marginRight: 4, verticalAlign: -1 }} />{lang === 'es' ? 'No disponible' : 'Not offered'}</span>
      </div>
    </div>
  )
}

export default SubPortalDatePicker
