import { useEffect, useRef } from 'react'

/**
 * The browser tab's title for a page that stands outside the app's shell (v2.7630). Nothing in the app sets the title
 * back, so a page that named itself kept its name on the tab through the sign-in and every page after it. The title
 * the tab had when the page first named itself is put back when the page closes. `null` leaves the tab as it is.
 */
export function useTabTitle(title: string | null): void {
  const before = useRef<string | null>(null)
  useEffect(() => {
    if (title == null) return
    if (before.current == null) before.current = document.title
    document.title = title
  }, [title])
  useEffect(
    () => () => {
      if (before.current != null) document.title = before.current
    },
    [],
  )
}
