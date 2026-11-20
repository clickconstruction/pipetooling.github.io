import { Suspense, useState, type ReactNode } from 'react'
import { WindowOpening } from './WindowOpening'

/**
 * Holds a window that used to be mounted all the time and drew nothing until it was opened (the main
 * chunk's split). It mounts the window the first time `open` is true, so the window's code loads then
 * (`lazyWindow`), and keeps it mounted after, so whatever the window does as it closes still runs.
 * Before a first open the window was drawing nothing and doing nothing, so nothing is lost by its absence.
 */
export function OnDemandWindow({ open, opening, children }: { open: boolean; opening?: ReactNode; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  if (!mounted && !open) return null
  return <Suspense fallback={open ? (opening ?? <WindowOpening />) : null}>{children}</Suspense>
}
