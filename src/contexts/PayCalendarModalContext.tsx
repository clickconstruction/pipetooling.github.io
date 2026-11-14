import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import PayCalendarModal, { type PayCalendarInitial, type PayCalendarJob, type PayCalendarJobToBe } from '../components/customers/PayCalendarModal'

/**
 * App-level opener for the Pay calendar window (punch list #323), the
 * CustomerProfileModalContext pattern: any screen that knows a payer opens the
 * one window on it, so the setting is never more than a press from where the
 * payer is named. First door: the customer's profile. `onSaved` runs after a
 * save or a removal, for a screen that reads the calendar and should read again.
 *
 * Remount-by-key: reopening on another payer resets the window's own state.
 */

export type PayCalendarModalContextValue = {
  openPayCalendar: (payer: { id: string; name: string }, options?: PayCalendarOpenOptions) => void
  closePayCalendar: () => void
}

/** What an opener can hand the window. */
export type PayCalendarOpenOptions = {
  onSaved?: () => void
  /** The job the press sits on (PR 4), so the window can set a calendar for that job alone. */
  job?: PayCalendarJob | null
  /** A job New Job has not made yet: the window can be for it alone and hands the calendar back instead of saving. */
  jobToBe?: PayCalendarJobToBe | null
  /** A clause and its words to start the form with when nothing is stored yet (PR 7): the paper the press sat on. Or whole terms an estimator read. */
  initial?: PayCalendarInitial | null
  /** The layer to draw at, for an opener that is itself a window above the usual one (PR 7). */
  zIndex?: number
}

const PayCalendarModalContext = createContext<PayCalendarModalContextValue | null>(null)

export function PayCalendarModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ id: string; name: string; job: PayCalendarJob | null; jobToBe: PayCalendarJobToBe | null; initial: PayCalendarOpenOptions['initial']; zIndex: number | undefined; instanceKey: number } | null>(null)
  const onSavedRef = useRef<(() => void) | undefined>(undefined)

  const openPayCalendar = useCallback((payer: { id: string; name: string }, options?: PayCalendarOpenOptions) => {
    onSavedRef.current = options?.onSaved
    setOpen((prev) => ({ id: payer.id, name: payer.name, job: options?.job ?? null, jobToBe: options?.jobToBe ?? null, initial: options?.initial ?? null, zIndex: options?.zIndex, instanceKey: (prev?.instanceKey ?? 0) + 1 }))
  }, [])

  const closePayCalendar = useCallback(() => {
    onSavedRef.current = undefined
    setOpen(null)
  }, [])

  return (
    <PayCalendarModalContext.Provider value={{ openPayCalendar, closePayCalendar }}>
      {children}
      {open != null && (
        <PayCalendarModal
          key={`${open.id}-${open.instanceKey}`}
          payerId={open.id}
          payerName={open.name}
          job={open.job}
          jobToBe={open.jobToBe}
          initial={open.initial}
          zIndex={open.zIndex}
          onClose={closePayCalendar}
          onSaved={() => onSavedRef.current?.()}
          // The payer's window lists the jobs that carry their own calendar (punch list #341); a press reopens it on that job,
          // and the screen that opened the window is still told of a save.
          onOpenJob={(job) => openPayCalendar({ id: open.id, name: open.name }, { job, onSaved: onSavedRef.current, zIndex: open.zIndex })}
        />
      )}
    </PayCalendarModalContext.Provider>
  )
}

/** Null outside the provider (a render test, a public page): a caller then draws no press. */
export function usePayCalendarModal(): PayCalendarModalContextValue | null {
  return useContext(PayCalendarModalContext)
}
