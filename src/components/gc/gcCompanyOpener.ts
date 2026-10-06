import { createContext, useContext } from 'react'

/** The company window's tabs (the owner, 2026-10-04): About, Activity, Documents, then Their portal. */
export type CompanyTab = 'about' | 'activity' | 'documents' | 'portal'

/**
 * GC mode design spike: open a trade's company window from anywhere below the page, at the tab
 * and paper that was clicked. Null outside the page (a portal, a test): chips then stay plain.
 */
export interface CompanyOpener {
  /**
   * `focus`: an Activity line to light and scroll to, like a promise (`promise:<id>`, `ask:<invite id>`).
   * `send`: open on the paper's send, its next step already pressed (a not-ready bar's button, G-77), as `openCustomer` does.
   */
  openPartner: (partnerId: string, at?: { tab?: CompanyTab; doc?: string; focus?: string; send?: boolean }) => void
  /** A customer's window, at a tab or a paper, its send open (`send`): Get started's Send to sign. */
  openCustomer: (customerId: string, at?: { tab?: CompanyTab; doc?: string; send?: boolean }) => void
}

export const GcCompanyOpenerContext = createContext<CompanyOpener | null>(null)

export function useCompanyOpener(): CompanyOpener | null {
  return useContext(GcCompanyOpenerContext)
}
