import { createContext, useContext } from 'react'
import { pt, type PortalKey, type PortalLang } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: the language the trade's portal is showing, English or Spanish. The
 * portal frame (GcTradePortal) holds the choice; every portal screen reads it here.
 */
export const PortalLangContext = createContext<PortalLang>('en')

export function usePortalLang(): { lang: PortalLang; t: (key: PortalKey, vars?: Record<string, string | number>) => string } {
  const lang = useContext(PortalLangContext)
  return { lang, t: (key, vars) => pt(lang, key, vars) }
}
