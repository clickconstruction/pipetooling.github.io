import { createContext, useContext } from 'react'

/**
 * GC mode, the real build (the Board's B6-d-ii), after the company opener (`gcCompanyOpener.ts`) and the design spike's
 * `openCustomer`: open a customer's window from anywhere below the page, at a tab and a paper with its send open (Get
 * started's **Send to sign** opens it at our contract on that job). Null outside the page (a test, a portal): names then
 * stay plain.
 */

/** The customer window's tabs, first cut: B2b adds the rest. */
export type CustomerTab = 'about' | 'documents'

/** Where the window opens. `doc` is a Documents row's key (`contract-<project id>`); `send` opens its send. Unset: About. */
export interface CustomerAt {
  tab?: CustomerTab
  doc?: string
  send?: boolean
}

export interface CustomerOpener {
  openCustomer: (customerId: string, at?: CustomerAt) => void
}

export const GcCustomerOpenerContext = createContext<CustomerOpener | null>(null)

export function useCustomerOpener(): CustomerOpener | null {
  return useContext(GcCustomerOpenerContext)
}
