import { createContext, useContext } from 'react'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * Crew modal opener (v2.3373): the Pipeline tab provides it; the Crew & Dates
 * line and the phone card's ⋯ sheet call it. Null outside the Pipeline, where
 * the line renders as plain text.
 */
export const StagesCrewModalContext = createContext<((job: JobWithDetails) => void) | null>(null)

export function useStagesCrewModalOpener(): ((job: JobWithDetails) => void) | null {
  return useContext(StagesCrewModalContext)
}
