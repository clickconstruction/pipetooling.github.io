import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useOptionalAuth } from '../../hooks/useAuth'

/**
 * A prototype's switch (punch list #217, *Show it, don't say it*): every shape the owner asked to see
 * live sits behind a per-user switch on its card, remembered on the device and off by default, so
 * nothing changes for anyone until they turn it on. And a dev-only side by side: when the page's URL
 * carries `?sbs=1` and the signed-in person is a dev, the card draws today's look and the shape one
 * above the other on the same live data (`SideBySide`). The same helper, under the same names, is in
 * the rhythm-strips prototype; the two fold together when either merges.
 */

const STORAGE_PREFIX = 'shape_view'

/** Per person per shape, so one teammate's switch never reaches another on a shared phone. */
export function shapeViewStorageKey(key: string, userId: string | null): string {
  return `${STORAGE_PREFIX}_${key}_${userId ?? 'anon'}`
}

/** `'1'` is on; anything else, and no value, is off. */
export function parseShapeViewStored(raw: string | null | undefined): boolean {
  return raw === '1'
}

/** `?sbs=1` on the page asks for the side by side. */
export function sideBySideRequested(search: string): boolean {
  return new URLSearchParams(search).get('sbs') === '1'
}

export type ShapeView = {
  /** The switch is on for this person on this device. */
  on: boolean
  toggle: () => void
  /** A dev with `?sbs=1` on the URL: draw today's look and the shape together. */
  sideBySide: boolean
}

export function useShapeView(key: string): ShapeView {
  const auth = useOptionalAuth()
  const userId = auth?.user?.id ?? null
  const isDev = auth?.role === 'dev'
  const { search } = useLocation()
  const [on, setOn] = useState(false)

  useEffect(() => {
    try {
      setOn(parseShapeViewStored(localStorage.getItem(shapeViewStorageKey(key, userId))))
    } catch {
      setOn(false)
    }
  }, [key, userId])

  const toggle = useCallback(() => {
    setOn((cur) => {
      const next = !cur
      try {
        localStorage.setItem(shapeViewStorageKey(key, userId), next ? '1' : '0')
      } catch {
        // A device that keeps nothing still shows the shape for this visit.
      }
      return next
    })
  }, [key, userId])

  return { on, toggle, sideBySide: isDev && sideBySideRequested(search) }
}
