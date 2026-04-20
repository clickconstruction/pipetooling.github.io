import { useEffect } from 'react'

/** Locks document scroll (iOS-friendly fixed body + restore). No-op when `locked` is false. */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const prevOverflow = document.body.style.overflow
    const prevPosition = document.body.style.position
    const prevTop = document.body.style.top
    const prevLeft = document.body.style.left
    const prevRight = document.body.style.right

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.position = prevPosition
      document.body.style.top = prevTop
      document.body.style.left = prevLeft
      document.body.style.right = prevRight
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
