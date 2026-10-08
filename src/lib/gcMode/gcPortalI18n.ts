/**
 * GC mode — design spike: the trade partner's portal in English and Spanish. Every word the portal
 * shows a company lives here, so the Español button covers the whole page and the messages we send.
 * The Spanish follows the sub portal's (`src/lib/subPortal/subPortalI18n.ts`): formal usted, plain
 * Mexican construction words, its terms for the same things (Contrato Maestro, orden de trabajo).
 * What the office typed (project names, trades, scope lines, notes) stays as typed.
 *
 * English is the words the portal had before Spanish, kept exactly, so a key's English is the
 * sentence a test or a screenshot already knows.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PortalKey } from '../gc/portalI18n'
export { EXCLUSION_ES, PORTAL_KEYS, pDiscipline, pExclusion, pTime, portalString, pt } from '../gc/portalI18n'

export type { PortalLang } from '../gc/portalI18n'
export { pDate, pWeekday } from '../gc/portalI18n'
