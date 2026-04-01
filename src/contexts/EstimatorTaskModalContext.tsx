import { createContext, useContext, useState, useCallback } from 'react'

type EstimatorTaskModalContextValue = {
  openEstimatorModal: () => void
  closeEstimatorModal: () => void
  isEstimatorModalOpen: boolean
}

const EstimatorTaskModalContext = createContext<EstimatorTaskModalContextValue | null>(null)

export function EstimatorTaskModalProvider({ children }: { children: React.ReactNode }) {
  const [isEstimatorModalOpen, setIsEstimatorModalOpen] = useState(false)

  const openEstimatorModal = useCallback(() => {
    setIsEstimatorModalOpen(true)
  }, [])
  const closeEstimatorModal = useCallback(() => {
    setIsEstimatorModalOpen(false)
  }, [])

  return (
    <EstimatorTaskModalContext.Provider
      value={{ openEstimatorModal, closeEstimatorModal, isEstimatorModalOpen }}
    >
      {children}
    </EstimatorTaskModalContext.Provider>
  )
}

export function useEstimatorTaskModal(): EstimatorTaskModalContextValue | null {
  return useContext(EstimatorTaskModalContext)
}
