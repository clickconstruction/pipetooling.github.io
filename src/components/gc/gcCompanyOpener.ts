import { createContext, useContext } from 'react'

/**
 * GC mode, the real build (the Board's B3-c), from the design spike's `gcCompanyOpener.ts`: open a
 * trade's company window from anywhere below the page. Null outside the page (a test, a portal):
 * names then stay plain. Since B6-b-ii it opens at a tab and a paper (`CompanyAt`), as the spike's
 * does: a not-ready bar's paper on the schedule opens Documents at that paper with its send open.
 */

/** The company window's tabs. Activity since the Board's B2b-iv. */
export type CompanyTab = 'about' | 'activity' | 'documents' | 'portal'

/**
 * Where the window opens. `doc` is a Documents row's key: 'msa', 'insurance', 'w9' (`DOC_KEYS`) or
 * 'sow-<package id>'. `send` opens that paper's send beside the list when it has a next step the
 * reader may send; otherwise the window opens at the row. Unset: About.
 */
export interface CompanyAt {
  tab?: CompanyTab
  doc?: string
  send?: boolean
}

export interface CompanyOpener {
  openPartner: (partnerId: string, at?: CompanyAt) => void
}

export const GcCompanyOpenerContext = createContext<CompanyOpener | null>(null)

export function useCompanyOpener(): CompanyOpener | null {
  return useContext(GcCompanyOpenerContext)
}
