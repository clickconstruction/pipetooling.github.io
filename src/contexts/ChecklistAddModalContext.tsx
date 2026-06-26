import { createContext, useContext, useState, useCallback } from 'react'

export type ChecklistAddModalPreset = {
  title: string
  links: string[]
}

export type ChecklistAddModalOpenOptions = {
  assigneeUserId?: string | null
  preset?: ChecklistAddModalPreset | null
  /** Called after a task is successfully saved (before the modal closes). */
  onSaved?: (() => void) | null
}

type ChecklistAddModalContextValue = {
  /** Pass a user id string (legacy), or options with optional preset / assigneeUserId / onSaved. */
  openAddModal: (arg?: string | ChecklistAddModalOpenOptions) => void
  closeModal: () => void
  isOpen: boolean
  initialAssigneeUserId: string | null
  initialPreset: ChecklistAddModalPreset | null
  /** Invoke from the modal's save handler so openers can react to a successful save. */
  onSaved: (() => void) | null
}

const ChecklistAddModalContext = createContext<ChecklistAddModalContextValue | null>(null)

export function ChecklistAddModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialAssigneeUserId, setInitialAssigneeUserId] = useState<string | null>(null)
  const [initialPreset, setInitialPreset] = useState<ChecklistAddModalPreset | null>(null)
  // Stored via the functional setState form so the callback itself isn't treated as an updater.
  const [onSavedCb, setOnSavedCb] = useState<(() => void) | null>(null)

  const openAddModal = useCallback((arg?: string | ChecklistAddModalOpenOptions) => {
    if (typeof arg === 'string') {
      setInitialAssigneeUserId(arg || null)
      setInitialPreset(null)
      setOnSavedCb(null)
    } else if (arg != null && typeof arg === 'object') {
      setInitialAssigneeUserId(arg.assigneeUserId ?? null)
      setInitialPreset(arg.preset ?? null)
      setOnSavedCb(() => arg.onSaved ?? null)
    } else {
      setInitialAssigneeUserId(null)
      setInitialPreset(null)
      setOnSavedCb(null)
    }
    setIsOpen(true)
  }, [])
  const closeModal = useCallback(() => {
    setIsOpen(false)
    setInitialAssigneeUserId(null)
    setInitialPreset(null)
    setOnSavedCb(null)
  }, [])

  return (
    <ChecklistAddModalContext.Provider
      value={{ openAddModal, closeModal, isOpen, initialAssigneeUserId, initialPreset, onSaved: onSavedCb }}
    >
      {children}
    </ChecklistAddModalContext.Provider>
  )
}

export function useChecklistAddModal(): ChecklistAddModalContextValue | null {
  return useContext(ChecklistAddModalContext)
}
