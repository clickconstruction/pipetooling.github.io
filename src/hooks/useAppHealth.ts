import { useEffect, useState } from 'react'
import { appHealth, type AppHealthReading, type AppHealthStore } from '../lib/appHealth'

function same(a: AppHealthReading, b: AppHealthReading): boolean {
  return a.state === b.state && a.troubleSince === b.troubleSince && a.nextChangeAt === b.nextChangeAt
}

/**
 * The app's health as the strip and the auth gate read it (#183 PR 1, v2.6009). Re-reads on
 * every request event and once more at the instant the kernel says the reading could change
 * with no new event (`nextChangeAt`), so a quiet page sets no interval.
 */
export function useAppHealth(store: AppHealthStore = appHealth): AppHealthReading {
  const [reading, setReading] = useState<AppHealthReading>(() => store.read(Date.now()))
  useEffect(() => {
    const refresh = () =>
      setReading((prev) => {
        const next = store.read(Date.now())
        return same(prev, next) ? prev : next
      })
    refresh()
    return store.subscribe(refresh)
  }, [store])
  useEffect(() => {
    if (reading.nextChangeAt == null) return
    const t = window.setTimeout(
      () =>
        setReading((prev) => {
          const next = store.read(Date.now())
          return same(prev, next) ? prev : next
        }),
      Math.max(1, reading.nextChangeAt - Date.now() + 1),
    )
    return () => window.clearTimeout(t)
  }, [store, reading])
  return reading
}
