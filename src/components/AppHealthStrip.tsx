import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOptionalAuth } from '../hooks/useAuth'
import { useAppHealth } from '../hooks/useAppHealth'
import { useKeptReadOnScreen } from '../hooks/useKeptRead'
import { useOutbox } from '../hooks/useOutbox'
import { RETRY_LABEL, appHealth, appHealthStripWords, type AppHealthStore } from '../lib/appHealth'
import { keptReadOnScreen, type KeptReadOnScreenStore } from '../lib/keptRead'
import { NOTHING_LOST_WORDS, markDueNow, markSeen, needsAPerson, outboxBarWords, outboxHoldsEverything, waitingCountWords, type OutboxBarWords } from '../lib/offline/outbox'
import { outbox, type OutboxStateStore } from '../lib/offline/outboxState'
import { OutboxDoor } from './OutboxDoor'

/**
 * The strip at the top of every screen (punch list #183, PR 1, v2.6009): the first row of the
 * nav chrome, in flow, so it pushes the nav down one line instead of covering it. It reads the
 * app-health kernel (`src/lib/appHealth.ts`) and says, in the owner's words, *The app is slow
 * right now.* the moment something has waited four seconds with nothing landing; *Could not
 * reach the app.* with **Retry** when nothing answers at all; *No signal.* when the phone is
 * offline. A dev's screen adds the runbook's first rule once the trouble is a minute old.
 *
 * Since punch list #163 PR 2 it is also the queue's one face: one row, the health words first,
 * the queue's count and its door after, so a phone never carries two bars. While the app is
 * fine the strip is the bar alone (`outboxBarWords`): amber for a press waiting with its
 * countdown and **Try now**, green for a press that landed with **Got it**, red for a press the
 * office refused or one that has waited since yesterday, with its reason and **Fix**; a tap on
 * the words opens the list (`OutboxDoor`). While the page on screen is a kept one (#183 PR 2,
 * v2.6031: `useKeptRead` registers on `keptReadOnScreen`) the strip adds *The page you see was
 * read at 7:52 AM.* after the lead. Retry reloads the page: the shell is precached, so the reload
 * is cheap, and it is the same everywhere.
 */
export function AppHealthStrip({
  store = appHealth,
  keptStore = keptReadOnScreen,
  outboxStore = outbox,
  retry = () => window.location.reload(),
  onTryNow,
}: {
  store?: AppHealthStore
  keptStore?: KeptReadOnScreenStore
  outboxStore?: OutboxStateStore
  retry?: () => void
  /** Try now: the replay runs at once (`useOutboxReplay`'s `tryNow`); unset, the next due try sends. */
  onTryNow?: () => void
}) {
  const auth = useOptionalAuth()
  const navigate = useNavigate()
  const reading = useAppHealth(store)
  const keptReadAt = useKeptReadOnScreen(keptStore)
  const presses = useOutbox(outboxStore)
  const [doorOpen, setDoorOpen] = useState(false)
  const now = Date.now()
  const words = appHealthStripWords(reading, { dev: auth?.role === 'dev', now, keptReadAt })
  const bar = presses.length > 0 ? outboxBarWords(presses, now, { offline: reading.state === 'offline' }) : null
  // The countdown moves: re-draw each second while one is on the strip.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!bar?.countdown) return
    const t = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [bar?.countdown != null])

  const tryNow = () => {
    if (onTryNow) onTryNow()
    else outboxStore.replace(outboxStore.presses().map((p) => (p.state === 'waiting' ? markDueNow(p) : p)))
  }
  const gotIt = (ids: readonly string[]) => outboxStore.replace(markSeen(outboxStore.presses(), ids))
  const door = doorOpen ? <OutboxDoor store={outboxStore} onClose={() => setDoorOpen(false)} onSendNow={tryNow} /> : null

  if (words) {
    // The health words lead; the queue's count and its door follow on the same row.
    const needing = presses.filter((p) => needsAPerson(p, now) && !p.seen).length
    const sentUnseen = presses.filter((p) => p.state === 'sent' && !p.seen)
    const count = waitingCountWords(presses)
    const nothingLost = reading.state !== 'offline' && outboxHoldsEverything(presses, now) ? [NOTHING_LOST_WORDS] : []
    return (
      <>
        <div className="appHealthStrip" data-tone={words.tone} data-app-health={reading.state} role="status" aria-live="polite">
          <strong>{words.lead}</strong>
          {[...words.lines, ...nothingLost].map((line) => (
            <span key={line}>{line}</span>
          ))}
          {needing > 0 ? (
            <button type="button" className="appHealthStripLink" onClick={() => setDoorOpen(true)}>
              {needing === 1 ? '1 press needs you' : `${needing} presses need you`} ›
            </button>
          ) : count ? (
            <button type="button" className="appHealthStripLink" onClick={() => setDoorOpen(true)}>
              {count} ›
            </button>
          ) : sentUnseen.length > 0 ? (
            <>
              <button type="button" className="appHealthStripLink" onClick={() => setDoorOpen(true)}>
                {sentUnseen.length} sent ✓
              </button>
              <button type="button" className="appHealthStripRetry" onClick={() => gotIt(sentUnseen.map((p) => p.id))}>
                Got it
              </button>
            </>
          ) : null}
          {words.retry && (
            <button type="button" className="appHealthStripRetry" onClick={retry}>
              {RETRY_LABEL}
            </button>
          )}
        </div>
        {door}
      </>
    )
  }

  if (!bar) return null
  return (
    <>
      <OutboxBar
        bar={bar}
        onOpen={() => setDoorOpen(true)}
        onTryNow={tryNow}
        onGotIt={gotIt}
        onFix={(ids, to) => {
          // The door opened: the red comes off the bar; the press stays under Needs you in the list.
          gotIt(ids)
          if (to) navigate(to)
          else setDoorOpen(true)
        }}
      />
      {door}
    </>
  )
}

function OutboxBar({
  bar,
  onOpen,
  onTryNow,
  onGotIt,
  onFix,
}: {
  bar: OutboxBarWords
  onOpen: () => void
  onTryNow: () => void
  onGotIt: (ids: readonly string[]) => void
  onFix: (ids: readonly string[], door: string | null) => void
}) {
  const button = bar.button
  return (
    <div className="appHealthStrip" data-tone={bar.tone} data-outbox={button?.kind ?? 'none'} data-pulsing={bar.pulsing ? 'true' : undefined} role="status" aria-live="polite">
      <button type="button" className="appHealthStripWords" onClick={onOpen} aria-label="Open the list of presses waiting to send">
        <strong>{bar.lead}</strong>
        {bar.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        {bar.countdown ? <span className="appHealthStripCountdown">{bar.countdown}</span> : null}
        {bar.opensList ? <span aria-hidden>›</span> : null}
      </button>
      {button ? (
        <button
          type="button"
          className="appHealthStripRetry"
          onClick={() => {
            if (button.kind === 'try-now') onTryNow()
            else if (button.kind === 'got-it') onGotIt(button.pressIds)
            else onFix(button.pressIds, button.door)
          }}
        >
          {button.label}
        </button>
      ) : null}
    </div>
  )
}

export default AppHealthStrip
