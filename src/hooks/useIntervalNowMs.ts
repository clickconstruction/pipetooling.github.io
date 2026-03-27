import { useEffect, useState } from 'react'

/** Returns current time in ms; updates on a fixed interval (for live elapsed durations). */
export function useIntervalNowMs(intervalMs: number): number {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return nowMs
}
