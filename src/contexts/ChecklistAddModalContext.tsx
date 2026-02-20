import { createContext, useContext, useState, useCallback } from 'react'

type ChecklistAddModalContextValue = {
  openAddModal: () => void
  closeModal: () => void
  isOpen: boolean
}

const ChecklistAddModalContext = createContext<ChecklistAddModalContextValue | null>(null)

export function ChecklistAddModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openAddModal = useCallback(() => setIsOpen(true), [])
  const closeModal = useCallback(() => setIsOpen(false), [])

  return (
    <ChecklistAddModalContext.Provider value={{ openAddModal, closeModal, isOpen }}>
      {children}
    </ChecklistAddModalContext.Provider>
  )
}

export function useChecklistAddModal(): ChecklistAddModalContextValue | null {
  return useContext(ChecklistAddModalContext)
}
