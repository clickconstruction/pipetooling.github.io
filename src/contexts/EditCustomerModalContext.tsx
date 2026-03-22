import { createContext, useContext, useState, useCallback } from 'react'

type EditCustomerModalOptions = {
  onSaved?: () => void
  onDeleted?: (customerId: string) => void
}

type EditCustomerModalContextValue = {
  openEditCustomerModal: (customerId: string, options?: EditCustomerModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  customerId: string | null
  onSaved: (() => void) | null
  onDeleted: ((customerId: string) => void) | null
}

const EditCustomerModalContext = createContext<EditCustomerModalContextValue | null>(null)

export function EditCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [onSaved, setOnSaved] = useState<(() => void) | null>(null)
  const [onDeleted, setOnDeleted] = useState<((customerId: string) => void) | null>(null)

  const openEditCustomerModal = useCallback((id: string, options?: EditCustomerModalOptions) => {
    setCustomerId(id)
    setOnSaved(options?.onSaved ?? null)
    setOnDeleted(options?.onDeleted ?? null)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setCustomerId(null)
    setOnSaved(null)
    setOnDeleted(null)
  }, [])

  return (
    <EditCustomerModalContext.Provider value={{ openEditCustomerModal, closeModal, isOpen, customerId, onSaved, onDeleted }}>
      {children}
    </EditCustomerModalContext.Provider>
  )
}

export function useEditCustomerModal(): EditCustomerModalContextValue | null {
  return useContext(EditCustomerModalContext)
}
