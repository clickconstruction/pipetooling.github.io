import { createContext, useContext, useState, useCallback } from 'react'

type EditCustomerModalOptions = {
  onSaved?: () => void
  onDeleted?: (customerId: string) => void
  onMerged?: (args: { survivorId: string; removedId: string }) => void
}

type EditCustomerModalContextValue = {
  openEditCustomerModal: (customerId: string, options?: EditCustomerModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  customerId: string | null
  onSaved: (() => void) | null
  onDeleted: ((customerId: string) => void) | null
  onMerged: ((args: { survivorId: string; removedId: string }) => void) | null
}

const EditCustomerModalContext = createContext<EditCustomerModalContextValue | null>(null)

export function EditCustomerModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [onSaved, setOnSaved] = useState<(() => void) | null>(null)
  const [onDeleted, setOnDeleted] = useState<((customerId: string) => void) | null>(null)
  const [onMerged, setOnMerged] = useState<((args: { survivorId: string; removedId: string }) => void) | null>(null)

  const openEditCustomerModal = useCallback((id: string, options?: EditCustomerModalOptions) => {
    setCustomerId(id)
    // useState treats a function argument as an updater (prev => next). Callbacks are functions,
    // so always use an indirection that returns the callback reference as the next state.
    setOnSaved(() => options?.onSaved ?? null)
    setOnDeleted(() => options?.onDeleted ?? null)
    setOnMerged(() => options?.onMerged ?? null)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setCustomerId(null)
    setOnSaved(null)
    setOnDeleted(null)
    setOnMerged(null)
  }, [])

  return (
    <EditCustomerModalContext.Provider value={{ openEditCustomerModal, closeModal, isOpen, customerId, onSaved, onDeleted, onMerged }}>
      {children}
    </EditCustomerModalContext.Provider>
  )
}

export function useEditCustomerModal(): EditCustomerModalContextValue | null {
  return useContext(EditCustomerModalContext)
}
