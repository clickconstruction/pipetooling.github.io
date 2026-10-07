/**
 * GC mode, the real build: a date in Spanish for the trades, moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcPortalI18n.ts`) by the schedule's PR 1b, which reads it. The Portal lane's lift adds the rest of `gcPortalI18n.ts` here: its words in both languages.
 */
import { shortDate, weekdayDate } from './words'

export type PortalLang = 'en' | 'es'

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** "Oct 8" in English, "8 oct" in Spanish. */
export function pDate(lang: PortalLang, iso: string | null): string {
  if (lang === 'en' || !iso) return shortDate(iso)
  const [, m, d] = iso.split('-')
  const month = MONTHS_ES[Number(m) - 1]
  return month ? `${Number(d)} ${month}` : iso
}

/** "Thu Oct 8" in English, "jue 8 oct" in Spanish. */
export function pWeekday(lang: PortalLang, iso: string | null): string {
  if (lang === 'en' || !iso) return weekdayDate(iso)
  const [y, m, d] = iso.split('-').map(Number)
  const day = WEEKDAYS_ES[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()]
  return `${day} ${pDate(lang, iso)}`
}
