import { Suspense, useState, type ReactNode } from 'react'
import { WindowLoadBoundary } from './WindowLoadBoundary'
import { WindowOpening } from './WindowOpening'

/**
 * Holds a window that used to be mounted all the time and drew nothing until it was opened (the main
 * chunk's split). It mounts the window the first time `open` is true, so the window's code loads then
 * (`lazyWindow`), and keeps it mounted after, so whatever the window does as it closes still runs.
 * Before a first open the window was drawing nothing and doing nothing, so nothing is lost by its absence.
 *
 * A window whose code does not come gives up alone (`WindowLoadBoundary`): it is unmounted, `onGaveUp`
 * closes it in its host, and the next open mounts it and asks again. Until the host has closed it, it
 * stays unmounted, so a host that could not close is not asked again by a render alone.
 */
export function OnDemandWindow({
  open,
  opening,
  what,
  onGaveUp,
  children,
}: {
  open: boolean
  opening?: ReactNode
  /** The window as its line names it, with its article (`WINDOW_NAMES`). */
  what: string
  /** Closes the window in its host when its code did not come. */
  onGaveUp: () => void
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(open)
  const [gaveUp, setGaveUp] = useState(false)
  if (!open && gaveUp) setGaveUp(false)
  if (open && !mounted && !gaveUp) setMounted(true)
  if (!mounted) return null
  return (
    <WindowLoadBoundary
      what={what}
      onGaveUp={() => {
        setMounted(false)
        setGaveUp(true)
        onGaveUp()
      }}
    >
      <Suspense fallback={open ? (opening ?? <WindowOpening />) : null}>{children}</Suspense>
    </WindowLoadBoundary>
  )
}
