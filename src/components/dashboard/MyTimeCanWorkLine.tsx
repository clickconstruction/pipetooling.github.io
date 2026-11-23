/**
 * The quiet line at the foot of My Time's picture: the hours the office has for this person. With working hours
 * set (punch list #429) it reads them, a value at a time, says who sets them and has no press; hours about to
 * start are told a week ahead. With none, it is the hours a week the person says they can work and the press that
 * changes the answer, which the office plans the crew from on People → Utilization. The card measures nothing
 * against either (the owner, 2026-11-23). A salaried person is not asked: their week is on pay.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { defaultAvailabilityIo, type AvailabilityIo } from '../../lib/people/availabilityIo'
import { MY_TIME_HOURS_SET_BY, myTimeCanWorkWords, myTimeHours, type MyTimeHours } from '../../lib/dashboard/myTimeCanWork'
import { AvailableHoursModal } from '../people/AvailableHoursModal'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

export function MyTimeCanWorkLine({ userId, displayName, asks = true, io: ioIn }: { userId: string; displayName: string; /** False for a salaried person, who is told their working hours and never asked for a week. */ asks?: boolean; io?: AvailabilityIo }) {
  const io = useMemo(() => ioIn ?? defaultAvailabilityIo(), [ioIn])
  const [hours, setHours] = useState<MyTimeHours | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    try {
      setHours(myTimeHours(await io.listAnswers([userId]), todayYmdInAppTz(), asks))
    } catch {
      // The line is a convenience: a read that fails leaves it out, and the picture stands without it.
      setHours(undefined)
    }
  }, [io, userId, asks])
  useEffect(() => {
    void load()
  }, [load])
  if (hours === undefined) return null
  const coming = hours.coming ? (
    <div className="myTimeHoursComing" data-testid="my-time-hours-coming">
      <span className="myTimeHoursChip">{hours.coming.chip}</span>
      {hours.coming.sentences.map((text, i) => (
        <span key={i}>
          <ValueSentence text={text} />
        </span>
      ))}
    </div>
  ) : null
  if (hours.kind === 'set') {
    return (
      <div className="myTimeHours" data-testid="my-time-working-hours">
        {hours.sentences.map((text, i) => (
          <div key={i}>
            <ValueSentence text={text} />
          </div>
        ))}
        {coming}
        <div className="myTimeHoursNote">{MY_TIME_HOURS_SET_BY}</div>
      </div>
    )
  }
  if (hours.kind === 'none') return coming ? <div className="myTimeHours">{coming}</div> : null
  const words = myTimeCanWorkWords(hours.canWork)
  return (
    <>
      <div className="myTimeOffice" data-testid="my-time-can-work">
        <span>{words.line}</span>
        <button type="button" onClick={() => setOpen(true)}>
          {words.press}
        </button>
        <AvailableHoursModal open={open} subject={{ userId, name: displayName }} current={hours.canWork} isSelf setBy={userId} io={io} onClose={() => setOpen(false)} onSaved={() => void load()} />
      </div>
      {coming ? <div className="myTimeHours">{coming}</div> : null}
    </>
  )
}
