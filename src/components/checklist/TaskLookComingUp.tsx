import { useEffect, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { localCalendarDayKey } from '../../utils/dateUtils'
import { readPersonComingUp } from '../../lib/tasks/personDayIo'
import { COMING_UP_EMPTY_TAIL, COMING_UP_REPEATS, COMING_UP_TITLE, comingUpAddLabel, comingUpAgainWords, comingUpDays, comingUpEmptyMain, comingUpHint, comingUpLastDay, type ComingUpDay } from '../../lib/tasks/comingUp'
import { formatErrorMessage } from '../../utils/errorHandling'

const PANEL: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.9rem' }
const DAY_LABEL: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }

/**
 * Coming up (punch list #381): the person's open tasks dated in the next seven days, beside the look at their Task
 * Mode. It reads once when it is drawn. The window's Read again draws it anew. The press on an empty week is the
 * viewer's own act: it opens the New task window for the person.
 */
export function TaskLookComingUp({ personId, personName, onAddTask }: { personId: string; personName: string; onAddTask: () => void }) {
  const [days, setDays] = useState<ComingUpDay[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    let off = false
    // The same day Today reads by: the calendar day on this screen.
    const today = localCalendarDayKey(new Date())
    void readPersonComingUp(personId, today, comingUpLastDay(today))
      .then((rows) => {
        if (off) return
        if (rows) setDays(comingUpDays(rows, today))
        else setFailed('What is coming up did not load.')
      })
      .catch((e: unknown) => {
        if (!off) setFailed(formatErrorMessage(e, 'What is coming up did not load.'))
      })
    return () => {
      off = true
    }
  }, [personId])

  return (
    <section data-look-coming-up style={PANEL}>
      <h4 style={{ margin: 0, fontSize: '0.9375rem' }}>{COMING_UP_TITLE}</h4>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{comingUpHint(personName)}</p>
      {failed ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {failed}
        </p>
      ) : days === null ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : days.length === 0 ? (
        <EmptyState compact main={comingUpEmptyMain()} next={{ label: comingUpAddLabel(personName), onPress: onAddTask }} tail={COMING_UP_EMPTY_TAIL} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {days.map((day) => (
            <li key={day.ymd} data-coming-up-day={day.ymd} style={{ display: 'grid', gap: 3, padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
              <span style={DAY_LABEL}>{day.label}</span>
              {day.tasks.map((t) => (
                <span key={t.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.875rem', lineHeight: 1.35 }}>
                  <span style={{ minWidth: 0 }}>{t.title}</span>
                  {t.repeats ? <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{COMING_UP_REPEATS}</span> : null}
                </span>
              ))}
              {day.again > 0 ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{comingUpAgainWords(day.again)}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
