import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import CustomerProfileModal from '../components/customers/CustomerProfileModal'

/**
 * App-level opener for the Customer Profile modal (v2.1322) — the
 * EditCustomerModalContext pattern. First consumer: the customer icon/name on
 * Jobs → Pipeline rows; any surface with a customer_id can call
 * openCustomerProfile later (Customers page, AR modal, Bill Customer).
 *
 * Remount-by-key: reopening with a different customer resets the modal's
 * internal state (fetch, jobs-rail expansion).
 */

export type CustomerProfileModalContextValue = {
  openCustomerProfile: (customerId: string) => void
  closeCustomerProfile: () => void
  isOpen: boolean
}

const CustomerProfileModalContext = createContext<CustomerProfileModalContextValue | null>(null)

export function CustomerProfileModalProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<{ customerId: string; instanceKey: number } | null>(null)

  const openCustomerProfile = useCallback((customerId: string) => {
    setOpenState((prev) => ({ customerId, instanceKey: (prev?.instanceKey ?? 0) + 1 }))
  }, [])

  const closeCustomerProfile = useCallback(() => setOpenState(null), [])

  return (
    <CustomerProfileModalContext.Provider
      value={{ openCustomerProfile, closeCustomerProfile, isOpen: openState != null }}
    >
      {children}
      {openState != null && (
        <CustomerProfileModal
          key={`${openState.customerId}-${openState.instanceKey}`}
          customerId={openState.customerId}
          onClose={closeCustomerProfile}
        />
      )}
    </CustomerProfileModalContext.Provider>
  )
}

export function useCustomerProfileModal(): CustomerProfileModalContextValue | null {
  return useContext(CustomerProfileModalContext)
}
