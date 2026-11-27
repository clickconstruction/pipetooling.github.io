/** Settings → Data & recovery → "Today's goals check (dev)" (punch list #443, row 19): the take-back of
 * **Continue to app** on the day's goals check. A dev reads whether their own account passed today's check and
 * takes that record back, so the check asks again. The rule is lib/goalsCheckTakeBack.ts; the reads and the delete
 * lib/goalsCheckTakeBackIo.ts. Self-contained like the sibling sections, and it draws nothing for any role but a
 * dev. It reads only once it is opened. */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { toLocalDateString } from '../../lib/dailyGoalsGate'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { GOALS_CHECK_TAKEN_BACK, goalsCheckAsksAgain, goalsCheckDayWords, goalsCheckDays, goalsCheckTakeBackConfirm, goalsCheckTakeBackDrawn, goalsCheckTakeBackProblem, type GoalsCheckToday } from '../../lib/goalsCheckTakeBack'
import { readGoalsCheckToday, takeGoalsCheckBack } from '../../lib/goalsCheckTakeBackIo'
import { formatDenverTimeOnly, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ValueLine, ValueLines, ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/** When **Continue to app** was pressed, as the block says it: the time, with its day when today is two days. */
const passedWords = (ack: { localDate: string; completedAtIso: string | null }, withDay: boolean): string => {
  const ms = ack.completedAtIso ? Date.parse(ack.completedAtIso) : NaN
  const time = Number.isFinite(ms) ? formatDenverTimeOnly(ms) : 'yes'
  return withDay ? `${goalsCheckDayWords(ack.localDate)}, ${time}` : time
}

export default function GoalsCheckTakeBackBlock({ role, userId }: { role: string | null | undefined; userId: string | null | undefined }) {
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  /** What the last read found; null before any read and after one that failed. */
  const [today, setToday] = useState<GoalsCheckToday | null>(null)
  const [reading, setReading] = useState(false)
  /** Why the last read failed. */
  const [readWhy, setReadWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const drawn = goalsCheckTakeBackDrawn(role) && !!userId
  /** Worked out when the block opens, so a block left open over midnight reads the new day on its next read. */
  const days = useMemo(() => (open ? goalsCheckDays(todayYmdInAppTz(), toLocalDateString(new Date())) : []), [open])

  const read = useCallback(async () => {
    if (!userId || days.length === 0) return
    setReading(true)
    setReadWhy('')
    try {
      setToday(await readGoalsCheckToday(userId, days))
    } catch (e) {
      setToday(null)
      setReadWhy(formatErrorMessage(e, 'Today’s goals check did not read.'))
    } finally {
      setReading(false)
    }
  }, [userId, days])

  useEffect(() => {
    if (drawn && open) void read()
  }, [drawn, open, read])

  if (!drawn) return null

  const problem = today ? goalsCheckTakeBackProblem(role, today) : ''
  const dead = !today || !!problem || busy || reading
  const takeBack = async () => {
    if (dead || !today || !userId) return
    if (!(await confirmDialog({ ...goalsCheckTakeBackConfirm(today), danger: true }))) return
    setBusy(true)
    try {
      await takeGoalsCheckBack(userId, days)
      showToast(GOALS_CHECK_TAKEN_BACK, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The check was not taken back.'), 'error')
    } finally {
      setBusy(false)
      await read()
    }
  }

  const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem' }
  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8125rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, color: 'var(--text-link)' }
  return (
    <div data-testid="goals-check-take-back" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: '1rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, textAlign: 'left', color: 'var(--text-base)' }}
      >
        <span style={{ fontSize: '0.75rem' }}>{open ? '▼' : '▶'}</span>
        Today’s goals check (dev)
      </button>
      {open ? (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ ...muted, margin: '0.75rem 0' }}>
            After your first clock in of a day the app asks you to check your goals. Continue to app records that you passed, and the check does not come again that day. This takes your own record for today back, so the check asks again. It is for a walk on your own account.
          </p>
          {readWhy ? (
            <p style={{ ...muted, margin: '0.75rem 0', color: 'var(--text-red-700)' }} role="alert" data-testid="goals-check-read-why">
              {readWhy}
            </p>
          ) : null}
          {today ? (
            <div style={{ fontSize: '0.875rem' }} data-testid="goals-check-today">
              <ValueLines>
                <ValueLine label="Today">
                  <WorkedOutValue>{days.map(goalsCheckDayWords).join(' and ')}</WorkedOutValue>
                </ValueLine>
                <ValueLine label="Passed">
                  {today.acks.length === 0 ? <WorkedOutValue>not yet</WorkedOutValue> : <WorkedOutValue tone="green">{today.acks.map((a) => passedWords(a, days.length > 1)).join(' and ')}</WorkedOutValue>}
                </ValueLine>
                <ValueLine label="Your goals">
                  <WorkedOutValue>{String(today.goals)}</WorkedOutValue>
                </ValueLine>
                <ValueLine label="Clock sessions today">
                  <WorkedOutValue>{String(today.sessions)}</WorkedOutValue>
                </ValueLine>
              </ValueLines>
            </div>
          ) : !readWhy ? (
            <p style={{ ...muted, margin: '0.75rem 0' }}>Reading today’s check…</p>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => void takeBack()}
              disabled={dead}
              style={{ minHeight: 44, padding: '0.5rem 1rem', border: 'none', borderRadius: 4, fontFamily: 'inherit', fontWeight: 600, cursor: dead ? 'default' : 'pointer', background: dead ? DEAD_PRESS_FILL : '#b91c1c', color: dead ? DEAD_PRESS_TEXT : '#fff' }}
            >
              {busy ? 'Taking it back…' : 'Take today’s check back…'}
            </button>
            <button type="button" onClick={() => void read()} disabled={reading || busy} style={{ ...word, cursor: reading || busy ? 'default' : 'pointer' }}>
              {reading ? 'Reading…' : 'Read again'}
            </button>
          </div>
          {today ? (
            <p style={{ ...muted, margin: '0.5rem 0 0' }} data-testid="goals-check-why">
              {problem ? problem : <ValueSentence text={goalsCheckAsksAgain(today)} />}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
