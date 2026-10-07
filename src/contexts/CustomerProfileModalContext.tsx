import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CustomerProfileModal from '../components/customers/CustomerProfileModal'
import type { CustomerProfileView } from '../lib/customers/customerProfileView'
import { readCustomerTimelineParam } from '../lib/customers/customerTimelineSearch'

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
  /** `view` opens a named view (the Timeline, punch list #97); without it, the one last picked on this device. */
  openCustomerProfile: (customerId: string, options?: { view?: CustomerProfileView }) => void
  closeCustomerProfile: () => void
  isOpen: boolean
}

const CustomerProfileModalContext = createContext<CustomerProfileModalContextValue | null>(null)

export function CustomerProfileModalProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<{ customerId: string; instanceKey: number; view?: CustomerProfileView } | null>(null)

  const openCustomerProfile = useCallback((customerId: string, options?: { view?: CustomerProfileView }) => {
    setOpenState((prev) => ({ customerId, instanceKey: (prev?.instanceKey ?? 0) + 1, view: options?.view }))
  }, [])

  const closeCustomerProfile = useCallback(() => setOpenState(null), [])

  // `?customerTimeline=<id>` on any page opens that customer's timeline once (punch list #97,
  // PR 3), then leaves the address as it was without the link.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const link = readCustomerTimelineParam(location.search)
    if (!link) return
    navigate({ pathname: location.pathname, search: link.nextSearch, hash: location.hash }, { replace: true })
    if (link.customerId) openCustomerProfile(link.customerId, { view: 'timeline' })
  }, [location.search, location.pathname, location.hash, navigate, openCustomerProfile])

  return (
    <CustomerProfileModalContext.Provider
      value={{ openCustomerProfile, closeCustomerProfile, isOpen: openState != null }}
    >
      {children}
      {openState != null && (
        <CustomerProfileModal
          key={`${openState.customerId}-${openState.instanceKey}`}
          customerId={openState.customerId}
          initialView={openState.view}
          onClose={closeCustomerProfile}
        />
      )}
    </CustomerProfileModalContext.Provider>
  )
}

export function useCustomerProfileModal(): CustomerProfileModalContextValue | null {
  return useContext(CustomerProfileModalContext)
}
