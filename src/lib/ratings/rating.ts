/**
 * The customer's own word (v2.5876, measuring follow-ups item 6): the /rate?t= page's words and rules.
 * Pure; the page is `src/pages/CustomerRating.tsx`, the reads and the save the `job-rating` function
 * (service role, by the ask's `public_token`), the ask's mint `mint_customer_rating` through the
 * `{rate}` fill in the reply box (the next PR). One tap saves the score; the words are optional after.
 *
 * Since v2.5934 (punch list #185) the page is the owner's review ask: five stars, the Google ask after a five, what we
 * could have done better below it, and the office's call on a low score. The rules and the words for those are the
 * section at the end.
 */
import { SAMPLE_HOMEOWNER, SAMPLE_TOKEN, SAMPLE_TOKEN_DONE, SAMPLE_TOKEN_LOW } from '../customerSample'
import { PORTAL_SPANISH_ON } from '../gc/portalI18n'

/** The five scores, 1 to 5, left to right. */
export const SCORE_LABELS = ['Bad', 'Poor', 'Okay', 'Good', 'Great'] as const

export const WORDS_MAX = 1000

/** A token as the link carries it: the row's default is two uuids' hex, but any of ours passes. */
export function tokenOk(t: string | null | undefined): t is string {
  return typeof t === 'string' && /^[0-9a-f-]{32,80}$/i.test(t)
}

export function scoreOk(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
}

/** What the function answers a GET with. */
export interface RatingState {
  name: string
  score: number | null
  words: string
  answered: boolean
}

export function parseRatingState(json: unknown): RatingState | null {
  const o = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null
  if (!o || o.ok !== true) return null
  return {
    name: typeof o.name === 'string' ? o.name : '',
    score: scoreOk(o.score) ? o.score : null,
    words: typeof o.words === 'string' ? o.words : '',
    answered: o.answered === true,
  }
}

export const RATE_WORDS = {
  title: (name: string) => (name ? `${name}, how did we do?` : 'How did we do?'),
  sub: 'One tap answers it.',
  thanks: 'Thank you. Your answer is saved.',
  thanksLow: 'Thank you for the honest answer. We will do better.',
  wordsLabel: 'Anything we should know? (optional)',
  send: 'Send the words',
  sent: 'Sent. Thank you.',
  change: 'Tap a different star any time to change your answer.',
  badLink: 'This link is incomplete or has expired. Reply to our text and we will send a fresh one.',
  problem: 'Your answer could not be saved. Check your connection and tap again.',
}

/** The thanks line for a saved score: a 1 or a 2 answers with the honest version. */
export function thanksFor(score: number): string {
  return score <= 2 ? RATE_WORDS.thanksLow : RATE_WORDS.thanks
}

// ---------- the review ask (v2.5934, punch list #185; the plan to-dos/customer-reviews/) ----------

export type RatingLang = 'en' | 'es'

/** What the function answers around the score since v2.5934: each field degrades to a safe blank. */
export interface RatingExtras {
  /** The job the ask is about, as the office named it: "Water heater". Null when the ask is tied to no job. */
  jobName: string | null
  company: { name: string; phone: string }
  lang: RatingLang
  /** The company's Google review link, for a customer's ask while one is set. Null: the page never names Google. */
  googleLink: string | null
  googlePressed: boolean
  /** Their portal's short address, for the footer. */
  portalUrl: string | null
}

export const RATING_COMPANY = { name: 'Click Plumbing and Electrical', phone: '(512) 360-0599' } as const

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function parseRatingExtras(json: unknown): RatingExtras {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const company = (o.company && typeof o.company === 'object' ? o.company : {}) as Record<string, unknown>
  const link = str(o.googleLink)
  return {
    jobName: str(o.jobName),
    company: { name: str(company.name) ?? RATING_COMPANY.name, phone: str(company.phone) ?? RATING_COMPANY.phone },
    lang: o.lang === 'es' ? 'es' : 'en',
    googleLink: link && (/^https:\/\/\S+$/i.test(link) || link === '#sample') ? link : null,
    googlePressed: o.googlePressed === true,
    portalUrl: str(o.portalUrl),
  }
}

/**
 * Where the Google ask shows, the owner's call (#185). `everyone`: the same ask to every customer who answers, under
 * the better question below a five, which is Google's policy's own shape. `five`: only at five stars, which the policy
 * lists under rating manipulation ("selectively solicit positive reviews from customers"). One line to change.
 */
export type GoogleAskAt = 'everyone' | 'five'
export const GOOGLE_ASK_AT: GoogleAskAt = 'everyone'

/** Whether the page shows the Google ask: never without a link or an answer; at five always; below five for everyone. */
export function showGoogleAsk(score: number | null | undefined, link: string | null | undefined, at: GoogleAskAt = GOOGLE_ASK_AT): boolean {
  if (!link || !score || score < 1) return false
  return at === 'everyone' || score >= 5
}

/** Below five the words box asks what we could have done better. */
export const asksBetter = (score: number): boolean => score < 5

/** At three or fewer the page promises the office's call, and the office's Needs you line asks for it. */
export const CALL_AT_OR_BELOW = 3
export const callPromised = (score: number): boolean => score >= 1 && score <= CALL_AT_OR_BELOW

/** The page's own words in English, beside `RATE_WORDS`. */
export const REVIEW_WORDS = {
  titleOn: (name: string, job: string) => (name ? `${name}, how did we do on ${job}?` : `How did we do on ${job}?`),
  stars: 'How many stars',
  tapStar: 'Tap a star',
  betterLabel: 'What could we have done better? (optional)',
  googleAsk: 'Would you put this on Google for us? It takes a minute, and it helps the next family find us.',
  googleAskBelow: 'If you want to say it on Google too, the same button is here.',
  googleButton: 'Post it on Google',
  copied: 'Your words are copied. Paste them there.',
  googlePressed: 'Thank you for taking it to Google.',
  call: 'Someone from the office will call you. We want to make this right.',
  everything: 'Everything about this job:',
  callUs: 'Call',
}

/** The same in Spanish, held behind `PORTAL_SPANISH_ON` until a native speaker reads them, as the portal's are. */
export const RATE_WORDS_ES: typeof RATE_WORDS = {
  title: (name: string) => (name ? `${name}, ¿cómo lo hicimos?` : '¿Cómo lo hicimos?'),
  sub: 'Un toque basta.',
  thanks: 'Gracias. Su respuesta quedó guardada.',
  thanksLow: 'Gracias por la respuesta honesta. Lo haremos mejor.',
  wordsLabel: '¿Algo que debamos saber? (opcional)',
  send: 'Enviar las palabras',
  sent: 'Enviado. Gracias.',
  change: 'Toque otra estrella cuando quiera para cambiar su respuesta.',
  badLink: 'Este enlace está incompleto o ya venció. Responda a nuestro mensaje y le enviamos uno nuevo.',
  problem: 'Su respuesta no se pudo guardar. Revise su conexión y toque de nuevo.',
}

export const REVIEW_WORDS_ES: typeof REVIEW_WORDS = {
  titleOn: (name: string, job: string) => (name ? `${name}, ¿cómo lo hicimos con ${job}?` : `¿Cómo lo hicimos con ${job}?`),
  stars: 'Cuántas estrellas',
  tapStar: 'Toque una estrella',
  betterLabel: '¿Qué pudimos haber hecho mejor? (opcional)',
  googleAsk: '¿Lo pondría en Google por nosotros? Toma un minuto y ayuda a la siguiente familia a encontrarnos.',
  googleAskBelow: 'Si también quiere decirlo en Google, aquí está el mismo botón.',
  googleButton: 'Publicarlo en Google',
  copied: 'Sus palabras quedaron copiadas. Péguelas allí.',
  googlePressed: 'Gracias por llevarlo a Google.',
  call: 'Alguien de la oficina le llamará. Queremos arreglarlo.',
  everything: 'Todo sobre este trabajo:',
  callUs: 'Llame al',
}

/** The scores' words in Spanish, beside `SCORE_LABELS`. */
export const SCORE_LABELS_ES = ['Mal', 'Regular', 'Bien', 'Bueno', 'Excelente'] as const

/** The page's words in the customer's language: Spanish only once the gate is open. */
export function rateWordsFor(lang: RatingLang, gate: boolean = PORTAL_SPANISH_ON) {
  const es = lang === 'es' && gate
  return { rate: es ? RATE_WORDS_ES : RATE_WORDS, review: es ? REVIEW_WORDS_ES : REVIEW_WORDS, labels: es ? SCORE_LABELS_ES : SCORE_LABELS }
}

/** The heading: the job by name when the ask is about one. */
export function titleFor(name: string, job: string | null, lang: RatingLang = 'en', gate: boolean = PORTAL_SPANISH_ON): string {
  const w = rateWordsFor(lang, gate)
  return job ? w.review.titleOn(name, job) : w.rate.title(name)
}

/** The words box's question: a five is asked for anything we should know, below five what we could have done better. */
export function wordsLabelFor(score: number, lang: RatingLang = 'en', gate: boolean = PORTAL_SPANISH_ON): string {
  const w = rateWordsFor(lang, gate)
  return asksBetter(score) ? w.review.betterLabel : w.rate.wordsLabel
}

/** The portal's address as the footer reads it: "my.clickplumbing.com/dana-whitfield". */
export const portalReadable = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/\/$/, '')

// ---------- the samples (What customers see) ----------

/** The answered-low sample, beside the shared `sample` (open) and `sample-done` (answered at five). */
export const RATE_SAMPLE_LOW = SAMPLE_TOKEN_LOW

/** A sample token's page: made-up state, no read, no save. Null for a real token. */
export function sampleRating(token: string | null | undefined): { state: RatingState; extras: RatingExtras } | null {
  const extras: RatingExtras = {
    jobName: 'the water heater',
    company: { ...RATING_COMPANY },
    lang: 'en',
    googleLink: '#sample',
    googlePressed: false,
    portalUrl: `https://my.clickplumbing.com/${SAMPLE_HOMEOWNER.portalSlug}`,
  }
  const name = SAMPLE_HOMEOWNER.name.split(' ')[0] ?? 'Sam'
  if (token === SAMPLE_TOKEN) return { state: { name, score: null, words: '', answered: false }, extras }
  if (token === SAMPLE_TOKEN_DONE) return { state: { name, score: 5, words: 'In and out in an hour, and the closet was cleaner than they found it.', answered: true }, extras }
  if (token === RATE_SAMPLE_LOW) return { state: { name, score: 2, words: 'The water is hot, but the closet floor was left a mess.', answered: true }, extras }
  return null
}
