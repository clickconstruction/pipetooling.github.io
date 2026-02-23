import { createContext, useContext, useState, useCallback } from 'react'
import type { Database } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type NewCustomerModalOptions = {
  onCreated?: (customer: CustomerRow) => void
}

type NewCustomerModalContextValue = {
  openNewCustomerModal: (options?: NewCustomerModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  onCreated: ((customer: CustomerRow) => void) | null
}

const NewCustomerModalContext = createContext<NewCustomerModalContextValue | null>(null)

export function NewCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [onCreated, setOnCreated] = useState<((customer: CustomerRow) => void) | null>(null)

  const openNewCustomerModal = useCallback((options?: NewCustomerModalOptions) => {
    setOnCreated(options?.onCreated ?? null)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setOnCreated(null)
  }, [])

  return (
    <NewCustomerModalContext.Provider value={{ openNewCustomerModal, closeModal, isOpen, onCreated }}>
      {children}
    </NewCustomerModalContext.Provider>
  )
}

export function useNewCustomerModal(): NewCustomerModalContextValue | null {
  return useContext(NewCustomerModalContext)
}
