import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { GcNoticeStepKey } from '../lib/jobs/gcOnNoticeSteps'

/** Which step is in view inside `scrollRef`, and a jump to one. Steps are found by `data-gc-notice-step`. */
export function useGcNoticeStepSpy(scrollRef: RefObject<HTMLElement | null>, keys: ReadonlyArray<GcNoticeStepKey>, active: boolean): [GcNoticeStepKey, (key: GcNoticeStepKey) => void] {
  const [current, setCurrent] = useState<GcNoticeStepKey>(keys[0]!)

  useEffect(() => {
    const sc = scrollRef.current
    if (!active || !sc) return
    const read = () => {
      // Not laid out yet (or a test's DOM, where every box is 0): the first step stands.
      if (sc.clientHeight === 0) return
      const bar = sc.querySelector<HTMLElement>('[data-gc-notice-stepbar]')
      const line = sc.getBoundingClientRect().top + (bar?.offsetHeight ?? 0) + 40
      let cur = keys[0]!
      for (const k of keys) {
        const el = sc.querySelector<HTMLElement>(`[data-gc-notice-step="${k}"]`)
        if (el && el.getBoundingClientRect().top <= line) cur = k
      }
      // The last step is often too short to reach the line; the bottom of the scroll is it.
      if (sc.scrollHeight > sc.clientHeight && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = keys[keys.length - 1]!
      setCurrent(cur)
    }
    read()
    sc.addEventListener('scroll', read, { passive: true })
    return () => sc.removeEventListener('scroll', read)
  }, [scrollRef, keys, active])

  const jump = useCallback(
    (key: GcNoticeStepKey) => {
      const sc = scrollRef.current
      const el = sc?.querySelector<HTMLElement>(`[data-gc-notice-step="${key}"]`)
      if (!sc || !el) return
      const bar = sc.querySelector<HTMLElement>('[data-gc-notice-stepbar]')
      const top = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top - (bar?.offsetHeight ?? 0) - 12
      if (typeof sc.scrollTo === 'function') sc.scrollTo({ top, behavior: 'smooth' })
      else sc.scrollTop = top
    },
    [scrollRef],
  )

  return [current, jump]
}
