/**
 * A job's insurance sheet on a trade partner's own page (punch list #404, step 5): what the page reads out of the
 * trade portal's answer, and the words of its block, in English and Spanish. The sheet itself is English only, since
 * an insurance agent reads it: the owner's open call, on its default. The words are placeholders in plain words.
 *
 * The words live here and not in `portal/pageWords.ts` or `gc/portalI18n.ts`: both are copied to the edge functions,
 * and a change to either means regenerating the copy and redeploying every function that reads it.
 *
 * Pure: no React, no supabase.
 */
import { documentBuilderLinkUrl } from './link'
import { parseResolvedSheet, type ResolvedSheet } from './sheet'

export type TradeSheet = {
  sheetId: string
  projectId: string
  job: string
  revision: number
  sheet: ResolvedSheet
  linkCode: string | null
  opened: boolean
  changed: boolean
}

/** The sheets out of the trade portal's answer. A function deployed before this sends none, and the page draws no block. */
export function tradeSheetsFrom(body: unknown): TradeSheet[] {
  if (typeof body !== 'object' || body === null) return []
  const raw = (body as Record<string, unknown>).sheets
  if (!Array.isArray(raw)) return []
  const out: TradeSheet[] = []
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) continue
    const r = one as Record<string, unknown>
    const sheet = parseResolvedSheet(r.sheet)
    if (!sheet || typeof r.sheetId !== 'string' || typeof r.projectId !== 'string' || typeof r.revision !== 'number') continue
    out.push({ sheetId: r.sheetId, projectId: r.projectId, job: typeof r.job === 'string' ? r.job : '', revision: r.revision, sheet, linkCode: typeof r.linkCode === 'string' && r.linkCode ? r.linkCode : null, opened: r.opened === true, changed: r.changed === true })
  }
  return out
}

export type TradeSheetLang = 'en' | 'es'

export const TRADE_SHEET_WORDS = {
  title: { en: 'What your certificate must show', es: 'Lo que debe mostrar su certificado' },
  mustName: { en: 'It must name {names}.', es: 'Debe nombrar a {names}.' },
  and: { en: ' and ', es: ' y ' },
  open: { en: 'Open the sheet', es: 'Abrir la hoja' },
  close: { en: 'Close the sheet', es: 'Cerrar la hoja' },
  agent: { en: 'Send it to my insurance agent', es: 'Enviarla a mi agente de seguros' },
  ownPage: { en: 'Open it on its own page to print', es: 'Abrirla en su propia página para imprimir' },
  isNew: { en: 'New', es: 'Nueva' },
  changed: { en: 'Changed since you opened it', es: 'Cambió desde que la abrió' },
  english: { en: 'The sheet is in English. Your insurance agent reads it.', es: 'La hoja está en inglés. La lee su agente de seguros.' },
  agentSubject: { en: 'Insurance requirements for {job}', es: 'Requisitos de seguro para {job}' },
  agentBody: { en: 'This page says what my certificate of insurance must show on {job}. It needs no login: {url}', es: 'Esta página dice lo que debe mostrar mi certificado de seguro en {job}. No pide contraseña: {url}' },
} as const

export type TradeSheetWord = keyof typeof TRADE_SHEET_WORDS

export function tradeSheetWords(lang: TradeSheetLang, key: TradeSheetWord, fill: Record<string, string> = {}): string {
  let out: string = TRADE_SHEET_WORDS[key][lang]
  for (const [k, v] of Object.entries(fill)) out = out.split(`{${k}}`).join(v)
  return out
}

/** *It must name Pecan Ridge Holdings and Lone Oak Property Management.* A name's own full stop is not doubled. */
export function mustNameLine(lang: TradeSheetLang, names: ReadonlyArray<string>): string {
  const clean = names.map((n) => n.trim()).filter(Boolean)
  if (clean.length === 0) return ''
  const joined = clean.length === 1 ? (clean[0] as string) : `${clean.slice(0, -1).join(', ')}${TRADE_SHEET_WORDS.and[lang]}${clean[clean.length - 1]}`
  return tradeSheetWords(lang, 'mustName', { names: joined }).replace(/\.\.$/, '.')
}

/** The mail a trade starts to their insurance agent: the sheet's own link, which needs no login. Null with no link. */
export function agentMailto(lang: TradeSheetLang, sheet: Pick<TradeSheet, 'job' | 'linkCode'>, origin: string): string | null {
  if (!sheet.linkCode) return null
  const url = documentBuilderLinkUrl(origin, sheet.linkCode)
  const job = sheet.job.trim() || (lang === 'es' ? 'este trabajo' : 'this job')
  return `mailto:?subject=${encodeURIComponent(tradeSheetWords(lang, 'agentSubject', { job }))}&body=${encodeURIComponent(tradeSheetWords(lang, 'agentBody', { job, url }))}`
}
