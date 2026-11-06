import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PICKER_WORDS, suggestedSignalForRole, WEEK_SIGNAL_WORDS, WEEK_SIGNALS, type WeekSignal } from '../../../lib/techWeek/weekSignal'
import { supabaseWeekSignalIo, type WeekSignalIo } from '../../../lib/techWeek/weekSignalIo'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { BTN, BTN_BLUE, BTN_QUIET, DeskRow, DeskSection, deskBtn } from '../personDeskShared'

/**
 * The People desk's **Your week** section (punch list #255, v2.6589): the office picks the one signal this person sees
 * move on their home (`users.week_signal` through `set_week_signal`): License hours, Jobs without a callback, or Crew
 * hours against target, with the role's guess named. **No card** clears it. The leader and the office press; a
 * training account reads. Renders nothing for anyone else.
 */

const canPick = (viewer: PersonDeskViewer): boolean => (viewer.role === 'dev' || viewer.role === 'master_technician' || viewer.role === 'assistant') && !viewer.readOnly
const sees = (viewer: PersonDeskViewer): boolean => viewer.role === 'dev' || viewer.role === 'master_technician' || viewer.role === 'assistant' || viewer.role === 'controller'

const HINT: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' }

export function PersonDeskWeekSection({ userId, displayName, personRole, viewer, changeKey, io: ioIn }: { userId: string | null; displayName: string; personRole: string | null; viewer: PersonDeskViewer; changeKey: number; io?: WeekSignalIo }) {
  const io = useMemo(() => ioIn ?? supabaseWeekSignalIo(), [ioIn])
  const [signal, setSignal] = useState<WeekSignal | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const visible = Boolean(userId) && sees(viewer)

  useEffect(() => {
    if (!userId || !visible) return
    let live = true
    void io.read(userId).then((s) => live && setSignal(s), () => live && setSignal(null))
    return () => {
      live = false
    }
  }, [io, userId, visible, changeKey])

  if (!userId || !visible) return null
  const first = displayName.trim().split(/\s+/)[0] || 'this person'
  const suggested = suggestedSignalForRole(personRole)
  const editable = canPick(viewer)

  const pick = async (next: WeekSignal | null) => {
    if (!editable || next === signal) return
    setBusy(true)
    setProblem(null)
    try {
      await io.set(userId, next)
      setSignal(next)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The signal was not saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DeskSection title="Your week" id="week" who={editable ? 'the office picks' : 'read only'}>
      <DeskRow label={PICKER_WORDS.label}>
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={HINT}>{PICKER_WORDS.hint(first)}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label={PICKER_WORDS.label}>
            {WEEK_SIGNALS.map((s) => {
              const on = signal === s
              return (
                <button key={s} type="button" aria-pressed={on} title={WEEK_SIGNAL_WORDS[s].hint} disabled={!editable || busy || signal === undefined} style={deskBtn(on ? BTN_BLUE : BTN, !editable || busy)} onClick={() => void pick(s)}>
                  {WEEK_SIGNAL_WORDS[s].label}
                </button>
              )
            })}
            {editable && signal ? (
              <button type="button" disabled={busy} style={deskBtn(BTN_QUIET, busy)} onClick={() => void pick(null)}>
                {PICKER_WORDS.clear}
              </button>
            ) : null}
          </div>
          <span style={HINT}>
            {signal === undefined ? 'Reading…' : signal ? WEEK_SIGNAL_WORDS[signal].hint : PICKER_WORDS.none}
            {!signal && suggested ? ` ${PICKER_WORDS.suggested(WEEK_SIGNAL_WORDS[suggested].label)}` : ''}
          </span>
          {problem ? (
            <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--text-red-600)' }}>
              {problem}
            </span>
          ) : null}
        </div>
      </DeskRow>
    </DeskSection>
  )
}
