import { useOptionalAuth } from '../hooks/useAuth'
import { useAppHealth } from '../hooks/useAppHealth'
import { RETRY_LABEL, appHealth, appHealthStripWords, type AppHealthStore } from '../lib/appHealth'

/**
 * The strip at the top of every screen (punch list #183, PR 1, v2.6009): the first row of the
 * nav chrome, in flow, so it pushes the nav down one line instead of covering it. It reads the
 * app-health kernel (`src/lib/appHealth.ts`) and says, in the owner's words, *The app is slow
 * right now.* the moment something has waited four seconds with nothing landing; *Could not
 * reach the app.* with **Retry** when nothing answers at all; *No signal.* when the phone is
 * offline. A dev's screen adds the runbook's first rule once the trouble is a minute old.
 *
 * It is the same strip #163's waiting bar will use — one row, the health words first, the
 * queue's count and its door after — so a phone never carries two bars. PR 2 adds *The page you
 * see was read at 7:52 AM.* on a kept page. Retry reloads the page: the shell is precached, so
 * the reload is cheap, and it is the same everywhere.
 */
export function AppHealthStrip({ store = appHealth, retry = () => window.location.reload() }: { store?: AppHealthStore; retry?: () => void }) {
  const auth = useOptionalAuth()
  const reading = useAppHealth(store)
  const words = appHealthStripWords(reading, { dev: auth?.role === 'dev', now: Date.now() })
  if (!words) return null
  return (
    <div className="appHealthStrip" data-tone={words.tone} data-app-health={reading.state} role="status" aria-live="polite">
      <strong>{words.lead}</strong>
      {words.lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      {words.retry && (
        <button type="button" className="appHealthStripRetry" onClick={retry}>
          {RETRY_LABEL}
        </button>
      )}
    </div>
  )
}

export default AppHealthStrip
