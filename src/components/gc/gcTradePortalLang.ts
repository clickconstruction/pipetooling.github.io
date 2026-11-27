import { createContext, useContext } from 'react'
import { type PortalLang } from '../../lib/gc/portalI18n'
import { portalWord, type PortalWordKey } from './gcTradePortalWords'

/**
 * GC mode, the trade partner portal (P1b-ii-b): the language the portal is showing, from the design spike's
 * `gcPortalLang.ts`. The page sets it once, from the company's record and Spanish's hold; every block reads it here.
 * `t` reads a kernel word (`portalI18n.ts`) or one of the page's own (`gcTradePortalWords.ts`) by its key.
 */
export const PortalLangContext = createContext<PortalLang>('en')

export function usePortalLang(): { lang: PortalLang; t: (key: PortalWordKey, vars?: Record<string, string | number>) => string } {
  const lang = useContext(PortalLangContext)
  return { lang, t: (key, vars) => portalWord(lang, key, vars) }
}
