import { createContext, useContext } from 'react'
import { pt, type PortalKey, type PortalLang } from '../../lib/gc/portalI18n'

/**
 * GC mode, the trade partner portal (P1b-ii-b): the language the portal is showing, from the design spike's
 * `gcPortalLang.ts`. The page sets it once, from the company's record and Spanish's hold; every block reads it here.
 */
export const PortalLangContext = createContext<PortalLang>('en')

export function usePortalLang(): { lang: PortalLang; t: (key: PortalKey, vars?: Record<string, string | number>) => string } {
  const lang = useContext(PortalLangContext)
  return { lang, t: (key, vars) => pt(lang, key, vars) }
}
