import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import PayCalendarModal from '../components/customers/PayCalendarModal'

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
  openPayCalendar: (payer: { id: string; name: string }, options?: { onSaved?: () => void }) => void
  closePayCalendar: () => void
}

const PayCalendarModalContext = createContext<PayCalendarModalContextValue | null>(null)

export function PayCalendarModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ id: string; name: string; instanceKey: number } | null>(null)
  const onSavedRef = useRef<(() => void) | undefined>(undefined)

  const openPayCalendar = useCallback((payer: { id: string; name: string }, options?: { onSaved?: () => void }) => {
    onSavedRef.current = options?.onSaved
    setOpen((prev) => ({ id: payer.id, name: payer.name, instanceKey: (prev?.instanceKey ?? 0) + 1 }))
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
          onClose={closePayCalendar}
          onSaved={() => onSavedRef.current?.()}
        />
      )}
    </PayCalendarModalContext.Provider>
  )
}

/** Null outside the provider (a render test, a public page): a caller then draws no press. */
export function usePayCalendarModal(): PayCalendarModalContextValue | null {
  return useContext(PayCalendarModalContext)
}
