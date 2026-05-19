import { createContext, useCallback, useContext, useState } from 'react'

type EditProjectModalOptions = {
  onSaved?: () => void
  onDeleted?: () => void
}

type EditProjectModalContextValue = {
  openEditProjectModal: (projectId: string, options?: EditProjectModalOptions) => void
  closeModal: () => void
  isOpen: boolean
  projectId: string | null
  onSaved: (() => void) | null
  onDeleted: (() => void) | null
}

const EditProjectModalContext = createContext<EditProjectModalContextValue | null>(null)

export function EditProjectModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [onSaved, setOnSaved] = useState<(() => void) | null>(null)
  const [onDeleted, setOnDeleted] = useState<(() => void) | null>(null)

  const openEditProjectModal = useCallback(
    (id: string, options?: EditProjectModalOptions) => {
      setProjectId(id)
      // useState treats a function argument as an updater (prev => next). Callbacks
      // are functions, so always wrap them in an indirection that returns the
      // callback reference as the next state.
      setOnSaved(() => options?.onSaved ?? null)
      setOnDeleted(() => options?.onDeleted ?? null)
      setIsOpen(true)
    },
    [],
  )

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setProjectId(null)
    setOnSaved(null)
    setOnDeleted(null)
  }, [])

  return (
    <EditProjectModalContext.Provider
      value={{ openEditProjectModal, closeModal, isOpen, projectId, onSaved, onDeleted }}
    >
      {children}
    </EditProjectModalContext.Provider>
  )
}

export function useEditProjectModal(): EditProjectModalContextValue | null {
  return useContext(EditProjectModalContext)
}
