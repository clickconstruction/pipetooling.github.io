import { createContext, useContext } from 'react'

/**
 * GC mode, the real build (the Board's B3-c), from the design spike's `gcCompanyOpener.ts`: open a
 * trade's company window from anywhere below the page. Null outside the page (a test, a portal):
 * names then stay plain. The spike's tabs and papers come as their kernels land; this opens About.
 */
export interface CompanyOpener {
  openPartner: (partnerId: string) => void
}

export const GcCompanyOpenerContext = createContext<CompanyOpener | null>(null)

export function useCompanyOpener(): CompanyOpener | null {
  return useContext(GcCompanyOpenerContext)
}
