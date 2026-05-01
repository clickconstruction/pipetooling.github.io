import { createContext, useContext, useState, useCallback } from 'react'

export type ChecklistAddModalPreset = {
  title: string
  links: string[]
}

export type ChecklistAddModalOpenOptions = {
  assigneeUserId?: string | null
  preset?: ChecklistAddModalPreset | null
}

type ChecklistAddModalContextValue = {
  /** Pass a user id string (legacy), or options with optional preset / assigneeUserId. */
  openAddModal: (arg?: string | ChecklistAddModalOpenOptions) => void
  closeModal: () => void
  isOpen: boolean
  initialAssigneeUserId: string | null
  initialPreset: ChecklistAddModalPreset | null
}

const ChecklistAddModalContext = createContext<ChecklistAddModalContextValue | null>(null)

export function ChecklistAddModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialAssigneeUserId, setInitialAssigneeUserId] = useState<string | null>(null)
  const [initialPreset, setInitialPreset] = useState<ChecklistAddModalPreset | null>(null)

  const openAddModal = useCallback((arg?: string | ChecklistAddModalOpenOptions) => {
    if (typeof arg === 'string') {
      setInitialAssigneeUserId(arg || null)
      setInitialPreset(null)
    } else if (arg != null && typeof arg === 'object') {
      setInitialAssigneeUserId(arg.assigneeUserId ?? null)
      setInitialPreset(arg.preset ?? null)
    } else {
      setInitialAssigneeUserId(null)
      setInitialPreset(null)
    }
    setIsOpen(true)
  }, [])
  const closeModal = useCallback(() => {
    setIsOpen(false)
    setInitialAssigneeUserId(null)
    setInitialPreset(null)
  }, [])

  return (
    <ChecklistAddModalContext.Provider
      value={{ openAddModal, closeModal, isOpen, initialAssigneeUserId, initialPreset }}
    >
      {children}
    </ChecklistAddModalContext.Provider>
  )
}

export function useChecklistAddModal(): ChecklistAddModalContextValue | null {
  return useContext(ChecklistAddModalContext)
}
