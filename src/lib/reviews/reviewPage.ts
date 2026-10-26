/**
 * The customer's review page, as a kernel (v2.5896, punch list #185; the plan `to-dos/customer-reviews/README.md`).
 * `/r/<token>` opens from the Review asked step's text after a job is paid: five stars, a line in their words, Send.
 * Then two paths. At five stars, the ask to put it on Google with the company's own review link; at fewer, *what
 * could we have done better* and the office's call. Pure: the words in English and Spanish, the star words, the
 * Google rule, the answer's parse and the page's state from the function's reply. The page is
 * `pages/CustomerReview.tsx`; the function is `customer-review`.
 */
import { SAMPLE_HOMEOWNER, type SampleState } from '../customerSample'
import type { PortalLang } from '../gc/portalI18n'

export type ReviewLang = PortalLang

/**
 * Where the Google ask shows. The owner's call (#185): `everyone` shows the same ask to every customer who answers,
 * which is Google's policy's own shape; `five` shows it only at five stars, which the policy lists under rating
 * manipulation ("selectively solicit positive reviews"). One constant to change if the owner takes the risk.
 */
export type GoogleAskAt = 'everyone' | 'five'
export const GOOGLE_ASK_AT: GoogleAskAt = 'everyone'

/** Whether the page shows the Google ask: never without a link or an answer; at five stars always; below, only for everyone. */
export function showGoogleAsk(stars: number | null | undefined, link: string | null | undefined, at: GoogleAskAt = GOOGLE_ASK_AT): boolean {
  if (!link || !stars || stars < 1) return false
  return at === 'everyone' || stars >= 5
}

/** Stars at or above this read as a good review; below, the page asks what we could have done better. */
export const REVIEW_GOOD_STARS = 5

export interface ReviewWords {
  pageTitle: string
  question: (first: string, job: string) => string
  sub: string
  tap: string
  stars: readonly string[]
  wordsHint: string
  send: string
  sendStars: (n: number) => string
  sending: string
  fine: (company: string) => string
  thanks: (first: string) => string
  thanksLow: (first: string) => string
  yourWords: string
  googleAsk: string
  googleAskLow: string
  googleButton: string
  copied: string
  googlePressed: string
  better: string
  betterHint: string
  betterSend: string
  betterSent: string
  call: string
  officeReads: (company: string) => string
  everything: string
  callUs: string
  alreadyAnswered: string
  notFound: string
  expired: string
  error: string
  loading: string
  langLink: string
}

export const REVIEW_WORDS: Readonly<Record<ReviewLang, ReviewWords>> = {
  en: {
    pageTitle: 'How did we do?',
    question: (first, job) => `How did we do on ${job}${first ? `, ${first}` : ''}?`,
    sub: 'Two taps here. If you have a minute more, Google.',
    tap: 'Tap a star',
    stars: ['', 'Not good', 'Could be better', 'All right', 'Good', 'Great'],
    wordsHint: 'A sentence in your words, if you like.',
    send: 'Send',
    sendStars: (n) => `Send ${n} ${n === 1 ? 'star' : 'stars'}`,
    sending: 'Sending…',
    fine: (company) => `Nothing is posted anywhere. This goes to the office at ${company}.`,
    thanks: (first) => `Thank you${first ? `, ${first}` : ''}.`,
    thanksLow: (first) => `Thank you for telling us${first ? `, ${first}` : ''}.`,
    yourWords: 'Your words:',
    googleAsk: 'Would you put this on Google for us? It takes a minute, and it helps the next family find us.',
    googleAskLow: 'If you want to say it on Google too, the same button is here.',
    googleButton: 'Post it on Google',
    copied: 'Your words are copied. Paste them there.',
    googlePressed: 'Thank you for posting it.',
    better: 'What could we have done better?',
    betterHint: 'Say it plainly. It helps us.',
    betterSend: 'Send',
    betterSent: 'Thank you. The office reads this today.',
    call: 'Someone from the office will call you. We want to make this right.',
    officeReads: (company) => `The office at ${company} reads this today.`,
    everything: 'Everything about this job:',
    callUs: 'Call',
    alreadyAnswered: 'This review was already sent. Thank you.',
    notFound: 'This link does not open a review. Call us and we will send a new one.',
    expired: 'This link has run out. Call us and we will send a new one.',
    error: 'The page could not load. Check your connection and try again.',
    loading: 'One moment…',
    langLink: 'Español',
  },
  es: {
    pageTitle: '¿Cómo lo hicimos?',
    question: (first, job) => `¿Cómo lo hicimos con ${job}${first ? `, ${first}` : ''}?`,
    sub: 'Dos toques aquí. Si tiene un minuto más, Google.',
    tap: 'Toque una estrella',
    stars: ['', 'Mal', 'Podría ser mejor', 'Regular', 'Bien', 'Excelente'],
    wordsHint: 'Una frase en sus palabras, si gusta.',
    send: 'Enviar',
    sendStars: (n) => `Enviar ${n} ${n === 1 ? 'estrella' : 'estrellas'}`,
    sending: 'Enviando…',
    fine: (company) => `No se publica en ningún lado. Esto llega a la oficina de ${company}.`,
    thanks: (first) => `Gracias${first ? `, ${first}` : ''}.`,
    thanksLow: (first) => `Gracias por decírnoslo${first ? `, ${first}` : ''}.`,
    yourWords: 'Sus palabras:',
    googleAsk: '¿Lo pondría en Google por nosotros? Toma un minuto y ayuda a la siguiente familia a encontrarnos.',
    googleAskLow: 'Si también quiere decirlo en Google, aquí está el mismo botón.',
    googleButton: 'Publicarlo en Google',
    copied: 'Sus palabras quedaron copiadas. Péguelas allí.',
    googlePressed: 'Gracias por publicarlo.',
    better: '¿Qué pudimos haber hecho mejor?',
    betterHint: 'Dígalo sin rodeos. Nos ayuda.',
    betterSend: 'Enviar',
    betterSent: 'Gracias. La oficina lo lee hoy.',
    call: 'Alguien de la oficina le llamará. Queremos arreglarlo.',
    officeReads: (company) => `La oficina de ${company} lo lee hoy.`,
    everything: 'Todo sobre este trabajo:',
    callUs: 'Llame al',
    alreadyAnswered: 'Esta reseña ya se envió. Gracias.',
    notFound: 'Este enlace no abre una reseña. Llámenos y le enviamos uno nuevo.',
    expired: 'Este enlace ya venció. Llámenos y le enviamos uno nuevo.',
    error: 'La página no cargó. Revise su conexión e intente de nuevo.',
    loading: 'Un momento…',
    langLink: 'English',
  },
}

export const reviewWords = (lang: ReviewLang): ReviewWords => REVIEW_WORDS[lang]

/** The word under the stars for a count: "Great" at five, "Tap a star" at none. */
export function starWord(stars: number, lang: ReviewLang): string {
  const w = REVIEW_WORDS[lang]
  return stars >= 1 && stars <= 5 ? w.stars[stars]! : w.tap
}

/** The Send button's words: the count once a star is tapped, Sending while it goes. */
export function sendWords(stars: number, sending: boolean, lang: ReviewLang): string {
  const w = REVIEW_WORDS[lang]
  if (sending) return w.sending
  return stars >= 1 ? w.sendStars(stars) : w.send
}

// ---------- the function's answer ----------

export interface ReviewAnswer {
  state: 'open' | 'answered'
  first: string
  jobName: string
  company: { name: string; phone: string }
  lang: ReviewLang
  stars: number | null
  words: string | null
  better: string | null
  googleLink: string | null
  googlePressed: boolean
  portalUrl: string | null
  /** True for the What customers see fixture: nothing is saved. */
  sample: boolean
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The answer as the page takes it; null for a shape the page cannot draw. Every field degrades to a safe blank. */
export function parseReviewAnswer(json: unknown): ReviewAnswer | null {
  if (!json || typeof json !== 'object') return null
  const j = json as Record<string, unknown>
  if (j.ok !== true) return null
  const state = j.state === 'answered' ? 'answered' : j.state === 'open' ? 'open' : null
  if (!state) return null
  const company = (j.company && typeof j.company === 'object' ? j.company : {}) as Record<string, unknown>
  const stars = typeof j.stars === 'number' && j.stars >= 1 && j.stars <= 5 ? Math.round(j.stars) : null
  const link = str(j.googleLink)
  return {
    state,
    first: str(j.first) ?? '',
    jobName: str(j.jobName) ?? 'your job',
    company: { name: str(company.name) ?? 'Click Plumbing and Electrical', phone: str(company.phone) ?? '' },
    lang: j.lang === 'es' ? 'es' : 'en',
    stars,
    words: str(j.words),
    better: str(j.better),
    googleLink: link && (/^https:\/\//i.test(link) || link === '#sample') ? link : null,
    googlePressed: j.googlePressed === true,
    portalUrl: str(j.portalUrl),
    sample: j.sample === true,
  }
}

export type ReviewView = { kind: 'loading' } | { kind: 'not_found' } | { kind: 'expired' } | { kind: 'error' } | { kind: 'ready'; answer: ReviewAnswer }

/** The page's state from the function's status and body. */
export function reviewView(status: number, json: unknown): ReviewView {
  if (status === 404) return { kind: 'not_found' }
  if (status === 410) return { kind: 'expired' }
  if (status >= 400) return { kind: 'error' }
  const answer = parseReviewAnswer(json)
  return answer ? { kind: 'ready', answer } : { kind: 'error' }
}

/** The page after Send, drawn at once from what was typed, so the thanks never waits on the function. */
export function answered(answer: ReviewAnswer, stars: number, words: string): ReviewAnswer {
  return { ...answer, state: 'answered', stars, words: words.trim() || null }
}

/** The portal's address as the footer reads it: "my.clickplumbing.com/dana-whitfield". */
export const portalReadable = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/\/$/, '')

/** The What customers see fixture: Sam Sample on the water heater, open or answered with five stars. */
export function sampleReviewAnswer(state: SampleState): ReviewAnswer {
  const done = state === 'done'
  return {
    state: done ? 'answered' : 'open',
    first: SAMPLE_HOMEOWNER.name.split(' ')[0]!,
    jobName: 'the water heater',
    company: { name: 'Click Plumbing and Electrical', phone: '(512) 360-0599' },
    lang: 'en',
    stars: done ? 5 : null,
    words: done ? 'In and out in an hour, and the closet was cleaner than they found it.' : null,
    better: null,
    googleLink: '#sample',
    googlePressed: false,
    portalUrl: `https://my.clickplumbing.com/${SAMPLE_HOMEOWNER.portalSlug}`,
    sample: true,
  }
}
