import { createContext, useContext, useState, useCallback } from 'react'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'

/** Optional pre-fill when opening the dispatch modal from a specific job/bid (e.g. the Stages bell). */
export type DispatchTaskPreset = { reference?: UnifiedSearchResult | null; titleSeed?: string } | null

type DispatchTaskModalContextValue = {
  openDispatchModal: (preset?: DispatchTaskPreset) => void
  closeDispatchModal: () => void
  isDispatchModalOpen: boolean
  dispatchPreset: DispatchTaskPreset
}

const DispatchTaskModalContext = createContext<DispatchTaskModalContextValue | null>(null)

export function DispatchTaskModalProvider({ children }: { children: React.ReactNode }) {
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [dispatchPreset, setDispatchPreset] = useState<DispatchTaskPreset>(null)

  const openDispatchModal = useCallback((preset?: DispatchTaskPreset) => {
    setDispatchPreset(preset ?? null)
    setIsDispatchModalOpen(true)
  }, [])
  const closeDispatchModal = useCallback(() => {
    setIsDispatchModalOpen(false)
    setDispatchPreset(null)
  }, [])

  return (
    <DispatchTaskModalContext.Provider
      value={{ openDispatchModal, closeDispatchModal, isDispatchModalOpen, dispatchPreset }}
    >
      {children}
    </DispatchTaskModalContext.Provider>
  )
}

export function useDispatchTaskModal(): DispatchTaskModalContextValue | null {
  return useContext(DispatchTaskModalContext)
}
