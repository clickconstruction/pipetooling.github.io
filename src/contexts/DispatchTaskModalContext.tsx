import { createContext, useContext, useState, useCallback } from 'react'

type DispatchTaskModalContextValue = {
  openDispatchModal: () => void
  closeDispatchModal: () => void
  isDispatchModalOpen: boolean
}

const DispatchTaskModalContext = createContext<DispatchTaskModalContextValue | null>(null)

export function DispatchTaskModalProvider({ children }: { children: React.ReactNode }) {
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)

  const openDispatchModal = useCallback(() => {
    setIsDispatchModalOpen(true)
  }, [])
  const closeDispatchModal = useCallback(() => {
    setIsDispatchModalOpen(false)
  }, [])

  return (
    <DispatchTaskModalContext.Provider
      value={{ openDispatchModal, closeDispatchModal, isDispatchModalOpen }}
    >
      {children}
    </DispatchTaskModalContext.Provider>
  )
}

export function useDispatchTaskModal(): DispatchTaskModalContextValue | null {
  return useContext(DispatchTaskModalContext)
}
