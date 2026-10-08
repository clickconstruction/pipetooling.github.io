/**
 * GC mode, the real build: the trade portal's Spanish voice, one word for each thing a trade reads about, the words the voice review
 * retired and the words kept out, moved word for word from the GC mode prototype (branch spike/gc-mode, `gcSpanishVoice.ts`)
 * by the Portal lane. The prototype's corpus, which plays its reducer, stays there; main scans its own portal words.
 */

export interface SpanishTerm {
  /** The thing, in the office's English. */
  en: string
  /** The one word a trade reads for it. */
  es: string
  /** Where the word bends: said short once named, or a sense that keeps another word. */
  note?: string
  /** The forms that count as the word in use. Unset: `es` itself. */
  seen?: string[]
  /** Kept for when it comes: no string names the thing today. */
  notYet?: boolean
  /** Retired by the voice review (2026-10-06): no string may say them. */
  retired: string[]
  /** What a writer might reach for, which no string uses: kept out. */
  keptOut: string[]
}

/**
 * The tú forms, kept out because the portal says usted throughout. Not *estás*: without its accent
 * it is *estas*, "these". Not the tú imperatives (*envía*, *firma*): they read the same as "he
 * sends", "he signs", so a scan cannot tell them apart; every imperative today is usted's.
 */
export const TU_MARKERS = ['tú', 'tu', 'tus', 'te', 'ti', 'contigo', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'puedes', 'tienes', 'debes', 'necesitas', 'quieres', 'eres', 'sabes', 'vas']

/** One word for each thing (the lead's fourteen, then the four found while reading). */
export const SPANISH_TERMS: SpanishTerm[] = [
  { en: 'master agreement', es: 'contrato maestro', retired: [], keptOut: ['acuerdo maestro', 'convenio maestro', 'contrato marco'] },
  { en: 'statement of work', es: 'orden de trabajo', seen: ['orden de trabajo', 'órdenes de trabajo'], retired: [], keptOut: ['declaración de trabajo'] },
  {
    en: 'insurance certificate',
    es: 'certificado de seguro',
    note: 'certificado once seguro is named in the same string or message',
    retired: [],
    keptOut: ['constancia de seguro', 'comprobante de seguro'],
  },
  { en: 'a draw', es: 'pago', note: 'Pago 2', retired: [], keptOut: ['desembolso', 'anticipo', 'estimación'] },
  {
    en: 'a pay application',
    es: 'solicitud de pago',
    note: 'solicitud once named',
    seen: ['solicitud de pago', 'solicitudes de pago'],
    retired: [],
    keptOut: ['aplicación de pago', 'factura'],
  },
  {
    en: 'a change order',
    es: 'orden de cambio',
    note: 'cambio alone stays for a change a trade asks for, and in the headings',
    seen: ['orden de cambio', 'órdenes de cambio'],
    retired: [],
    keptOut: ['orden de modificación'],
  },
  { en: 'a submittal', es: 'documento para aprobación', seen: ['documento para aprobación', 'documentos para aprobación'], retired: ['submittal'], keptOut: [] },
  { en: 'an RFI', es: 'pregunta', note: 'preguntas sobre los planos', retired: [], keptOut: ['solicitud de información', 'RFI'] },
  { en: 'the daily log', es: 'registro diario', retired: [], keptOut: ['bitácora', 'reporte diario', 'diario de obra'] },
  { en: 'the look-ahead', es: 'las próximas tres semanas', seen: ['próximas tres semanas'], retired: [], keptOut: ['vista anticipada', 'look-ahead'] },
  {
    en: 'late, a late notice',
    es: 'atraso',
    note: 'atrasarse, atrasado',
    seen: ['atraso', 'atrasado', 'atrasados', 'atrasada', 'atrasarse', 'atrasarnos'],
    retired: ['retraso'],
    keptOut: ['demora'],
  },
  { en: 'a crew count', es: 'personas al día', retired: [], keptOut: ['trabajadores al día'] },
  { en: 'the dates to meet', es: 'fechas a cumplir', notYet: true, retired: [], keptOut: ['hito'] },
  { en: 'the form of address', es: 'usted', retired: [], keptOut: TU_MARKERS },
  // Found while reading.
  { en: 'the schedule', es: 'cronograma', retired: ['calendario de obra', 'programa'], keptOut: [] },
  { en: 'a trade', es: 'especialidad', seen: ['especialidad', 'especialidades'], retired: ['oficio'], keptOut: [] },
  {
    en: 'billed',
    es: 'facturado',
    note: 'cobre stays for "get paid"',
    seen: ['facturado', 'facturada', 'facturadas', 'facturados', 'facturación', 'facturar'],
    retired: ['cobrado', 'cobro'],
    keptOut: [],
  },
  { en: 'a crew', es: 'cuadrilla', retired: [], keptOut: [] },
]

/** A string as the scan reads it: no accents, lower case. */
export function spanishPlain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Whether `text` says `word` as a whole word, ignoring case and accents, its plural too. */
export function saysWord(text: string, word: string): boolean {
  const w = spanishPlain(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${w}(s|es)?(?![a-z0-9])`).test(spanishPlain(text))
}

/** The words a string says that the voice keeps out: the retired, the kept out and the tú forms. */
export function offWords(text: string): { word: string; term: string; why: 'retired' | 'kept out' }[] {
  return SPANISH_TERMS.flatMap((t) => [
    ...t.retired.filter((w) => saysWord(text, w)).map((word) => ({ word, term: t.en, why: 'retired' as const })),
    ...t.keptOut.filter((w) => saysWord(text, w)).map((word) => ({ word, term: t.en, why: 'kept out' as const })),
  ])
}
