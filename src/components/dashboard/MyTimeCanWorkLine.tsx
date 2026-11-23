/**
 * The quiet line at the foot of My Time's picture: the hours a week the office has for this person, and the press
 * that changes the answer. The office plans the crew from it on People → Utilization, so the card still asks; it
 * measures nothing against it (the owner, 2026-11-23). A salaried person has no line: their week is on pay.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { defaultAvailabilityIo, type AvailabilityIo } from '../../lib/people/availabilityIo'
import { canWorkFromAnswers, myTimeCanWorkWords } from '../../lib/dashboard/myTimeCanWork'
import type { CanWork } from '../../lib/people/utilization'
import { AvailableHoursModal } from '../people/AvailableHoursModal'

export function MyTimeCanWorkLine({ userId, displayName, io: ioIn }: { userId: string; displayName: string; io?: AvailabilityIo }) {
  const io = useMemo(() => ioIn ?? defaultAvailabilityIo(), [ioIn])
  const [canWork, setCanWork] = useState<CanWork | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    try {
      setCanWork(canWorkFromAnswers(await io.listAnswers([userId]), todayYmdInAppTz()))
    } catch {
      // The line is a convenience: a read that fails leaves it out, and the picture stands without it.
      setCanWork(undefined)
    }
  }, [io, userId])
  useEffect(() => {
    void load()
  }, [load])
  if (canWork === undefined) return null
  const words = myTimeCanWorkWords(canWork)
  return (
    <div className="myTimeOffice" data-testid="my-time-can-work">
      <span>{words.line}</span>
      <button type="button" onClick={() => setOpen(true)}>
        {words.press}
      </button>
      <AvailableHoursModal open={open} subject={{ userId, name: displayName }} current={canWork} isSelf setBy={userId} io={io} onClose={() => setOpen(false)} onSaved={() => void load()} />
    </div>
  )
}
