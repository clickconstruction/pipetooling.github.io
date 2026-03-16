import { createContext, useContext, useState, useCallback } from 'react'

type ChecklistAddModalContextValue = {
  openAddModal: (initialAssigneeUserId?: string) => void
  closeModal: () => void
  isOpen: boolean
  initialAssigneeUserId: string | null
}

const ChecklistAddModalContext = createContext<ChecklistAddModalContextValue | null>(null)

export function ChecklistAddModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialAssigneeUserId, setInitialAssigneeUserId] = useState<string | null>(null)

  const openAddModal = useCallback((userId?: string) => {
    setInitialAssigneeUserId(userId ?? null)
    setIsOpen(true)
  }, [])
  const closeModal = useCallback(() => {
    setIsOpen(false)
    setInitialAssigneeUserId(null)
  }, [])

  return (
    <ChecklistAddModalContext.Provider value={{ openAddModal, closeModal, isOpen, initialAssigneeUserId }}>
      {children}
    </ChecklistAddModalContext.Provider>
  )
}

export function useChecklistAddModal(): ChecklistAddModalContextValue | null {
  return useContext(ChecklistAddModalContext)
}
