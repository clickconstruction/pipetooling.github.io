import { createContext, useContext } from 'react'

/** The company window's three tabs (the owner, 2026-10-04). */
export type CompanyTab = 'about' | 'activity' | 'documents'

/**
 * GC mode design spike: open a trade's company window from anywhere below the page, at the tab
 * and paper that was clicked. Null outside the page (a portal, a test): chips then stay plain.
 */
export interface CompanyOpener {
  openPartner: (partnerId: string, at?: { tab?: CompanyTab; doc?: string }) => void
}

export const GcCompanyOpenerContext = createContext<CompanyOpener | null>(null)

export function useCompanyOpener(): CompanyOpener | null {
  return useContext(GcCompanyOpenerContext)
}
