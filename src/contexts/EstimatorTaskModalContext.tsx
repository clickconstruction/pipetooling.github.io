import { createContext, useContext, useState, useCallback } from 'react'

/** Optional pre-fill when opening the estimator modal from a paper (v2.5818, the Physical inbox deck's Ask press). */
export type EstimatorTaskPreset = { titleSeed?: string; onCreated?: (estimatorRequestId: string) => void } | null

type EstimatorTaskModalContextValue = {
  openEstimatorModal: (preset?: EstimatorTaskPreset) => void
  closeEstimatorModal: () => void
  isEstimatorModalOpen: boolean
  estimatorPreset: EstimatorTaskPreset
}

const EstimatorTaskModalContext = createContext<EstimatorTaskModalContextValue | null>(null)

export function EstimatorTaskModalProvider({ children }: { children: React.ReactNode }) {
  const [isEstimatorModalOpen, setIsEstimatorModalOpen] = useState(false)
  const [estimatorPreset, setEstimatorPreset] = useState<EstimatorTaskPreset>(null)

  const openEstimatorModal = useCallback((preset?: EstimatorTaskPreset) => {
    setEstimatorPreset(preset ?? null)
    setIsEstimatorModalOpen(true)
  }, [])
  const closeEstimatorModal = useCallback(() => {
    setIsEstimatorModalOpen(false)
    setEstimatorPreset(null)
  }, [])

  return (
    <EstimatorTaskModalContext.Provider
      value={{ openEstimatorModal, closeEstimatorModal, isEstimatorModalOpen, estimatorPreset }}
    >
      {children}
    </EstimatorTaskModalContext.Provider>
  )
}

export function useEstimatorTaskModal(): EstimatorTaskModalContextValue | null {
  return useContext(EstimatorTaskModalContext)
}
