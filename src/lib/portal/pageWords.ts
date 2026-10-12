/**
 * Messages, cut 8 (the portals): every word of ours on a person's own page, in English and Spanish, lifted from the
 * Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178): `PT` (the trade's and the
 * architect's first page, the step readings), `PB` (the customer's page, shape B) and `PW` (what a step asks of them, by
 * paper). The kernels beside it (`flows/portalPage.ts`, `flows/customerMove.ts`, `portal/moneyLines.ts`,
 * `portal/moneyStory.ts`, `portal/papers.ts`) read only this table, so a sentence changes in one place and
 * `pageWords.test.ts` holds both languages to the same blanks and to the plain-words rules.
 *
 * What changed from the prototype's tables: a date is a `{day}` blank filled by main's `pDate` / `pWeekday`, never an
 * English string inside Spanish; the company, its phone, the superintendent, the days to pay and the card's fee are
 * blanks; a paper's name has both languages (the prototype's `PAPER_NAMES` and `PAPER_LABEL` were English only); a
 * paper says what to expect while we are on it (`onIt`) apart from when it comes (`comes`), since the prototype's one
 * `withus` line read stale once the step was on; the Spanish trade words follow main's trade portal (`portalI18n.ts`:
 * *renuncia de gravamen*, *documento para aprobación*, *pago* for a draw); a sentence with a semicolon or parentheses is
 * two sentences.
 * The words nothing reads any more (the v1.162 Money tab's, the unused question words) stayed behind.
 *
 * The page shows Spanish only through main's gate: it passes `portalShownLang(lang)` (`gc/portalI18n.ts`), so until a
 * native speaker reads the portal's Spanish every page reads English. Pure.
 */

import type { PaperId } from '../flows/facts'
import { pDate, pWeekday, type PortalLang } from '../gc/portalI18n'
import { money } from '../gc/words'

export type { PortalLang }

/** A line in both languages, as the flow and this table hold them. */
export interface Bilingual {
  en: string
  es: string
}

/** A line the office types for the customer: English always, Spanish once someone writes it. */
export interface TypedLine {
  en: string
  es: string | null
}

/** A typed line in a language: its Spanish when written, else its English. Readiness names the missing Spanish. */
export function typed(lang: PortalLang, line: TypedLine): string {
  return lang === 'es' && line.es ? line.es : line.en
}

/** Whether a typed line still waits on its Spanish. */
export function lacksSpanish(line: TypedLine | null | undefined): boolean {
  return !!line && line.en.trim() !== '' && !(line.es ?? '').trim()
}

const W = {
  // The trade's and the architect's first page (PT)
  pageTitle: { en: 'Where you are with {company}', es: 'Dónde está con {company}' },
  setUp: { en: 'Getting set up', es: 'Para empezar' },
  openSection: { en: 'Open', es: 'Pendiente' },
  questions: { en: 'Questions: text or call {phone}.', es: 'Preguntas: escriba o llame al {phone}.' },
  switchLang: { en: 'Español', es: 'English' },
  offThanks: {
    en: 'Thank you for considering us. If you need us again, text us.',
    es: 'Gracias por considerarnos. Si vuelve a necesitarnos, escríbanos.',
  },

  // One step, read from their side
  onIt: { en: 'We are on it.', es: 'Estamos en ello.' },
  later: { en: 'Later.', es: 'Después.' },
  doneWord: { en: 'done', es: 'listo' },
  dueOn: { en: 'due {day}', es: 'para el {day}' },
  lateSince: { en: 'late since {day}', es: 'atrasado desde el {day}' },
  yourMove: { en: 'Your move.', es: 'Le toca a usted.' },
  afterStep: { en: 'After {step}.', es: 'Después de {step}.' },
  sendBy: { en: 'We send it to you by {day}.', es: 'Se lo enviamos para el {day}.' },
  ranOut: { en: '{paper} ran out.', es: '{paper} venció.' },
  sayYesNo: { en: 'Say yes or no here.', es: 'Diga sí o no aquí.' },
  tellUsYesNo: { en: 'Tell us yes or no', es: 'Díganos sí o no' },
  acceptBid: { en: 'Accept the bid', es: 'Aceptar la oferta' },
  notThisTime: { en: 'Not this time', es: 'Esta vez no' },
  waitCertificate: { en: 'Waiting on your architect for the certificate.', es: 'Esperando el certificado de su arquitecto.' },
  waitArchitect: { en: 'Waiting on your architect.', es: 'Esperando a su arquitecto.' },
  waitOwner: { en: 'Waiting on the owner.', es: 'Esperando al dueño.' },
  waitOther: { en: 'Waiting on someone else first.', es: 'Esperando a otra persona primero.' },
  waiverWhy: {
    en: 'Send your pay application for {month} by {day}, with its conditional waiver.',
    es: 'Envíe su solicitud de pago de {month} antes del {day}, con su renuncia condicional.',
  },
  waiverWhyPlain: {
    en: 'Send your pay application with its conditional waiver.',
    es: 'Envíe su solicitud de pago con su renuncia condicional.',
  },

  // The customer's page, shape B (PB): the frame and Home
  withCompany: { en: 'with {company}', es: 'con {company}' },
  tabHome: { en: 'Home', es: 'Inicio' },
  tabMoney: { en: 'Money', es: 'Dinero' },
  tabSchedule: { en: 'Schedule', es: 'Calendario' },
  tabPapers: { en: 'Papers', es: 'Documentos' },
  tabMessages: { en: 'Messages', es: 'Mensajes' },
  yourMoveTitle: { en: 'Your move', es: 'Le toca a usted' },
  nothingToday: { en: 'Nothing from you today.', es: 'Hoy no necesitamos nada de usted.' },
  weAreOn: { en: 'We are on {step}.', es: 'Estamos en {step}.' },
  whereTitle: { en: 'Where you are', es: 'Dónde está' },
  whereCount: { en: '{done} of {total} done', es: '{done} de {total} listos' },
  allSteps: { en: 'All {n} steps', es: 'Los {n} pasos' },
  fewer: { en: 'Fewer', es: 'Menos' },
  weekTitle: { en: 'This week', es: 'Esta semana' },
  everyFriday: { en: 'Every Friday.', es: 'Cada viernes.' },
  peopleTitle: { en: 'Your people', es: 'Sus contactos' },

  // A change order waiting on them
  changeWaits: { en: 'Change order {n} waits on your answer', es: 'La orden de cambio {n} espera su respuesta' },
  readAndSign: { en: 'Read and sign', es: 'Leer y firmar' },
  decline: { en: 'Decline', es: 'Rechazar' },
  addsNoDays: { en: 'adds no days', es: 'no agrega días' },
  addsOneDay: { en: 'adds 1 working day', es: 'agrega 1 día hábil' },
  addsDays: { en: 'adds {n} working days', es: 'agrega {n} días hábiles' },
  creditOf: { en: 'a credit of {amount}', es: 'un crédito de {amount}' },
  waitingAnswer: { en: 'Waiting on your answer', es: 'Esperando su respuesta' },
  signingAdds: {
    en: 'Signing it adds it to the sum. Declining it changes nothing.',
    es: 'Firmarla la agrega a la suma. Rechazarla no cambia nada.',
  },

  // Money: the win first
  builtPct: { en: '{pct}% built', es: '{pct}% construido' },
  investedOf: { en: '{paid} of {sum} invested', es: '{paid} de {sum} invertido' },
  paidOnTime: { en: '{n} of {n} paid on time', es: '{n} de {n} pagadas a tiempo' },
  startingTitle: { en: 'Getting started', es: 'Para empezar' },
  soFarOf: { en: '{paid} of {sum} so far', es: '{paid} de {sum} hasta ahora' },
  firstAppAbout: { en: 'first pay application about {day}', es: 'primera solicitud de pago cerca del {day}' },
  sumIsNone: { en: 'The sum is your contract. Nothing else.', es: 'La suma es su contrato. Nada más.' },
  sumIsOne: {
    en: 'The sum is your contract plus the one change you signed. Nothing else.',
    es: 'La suma es su contrato más el cambio que firmó. Nada más.',
  },
  sumIsMany: {
    en: 'The sum is your contract plus the {n} changes you signed. Nothing else.',
    es: 'La suma es su contrato más los {n} cambios que firmó. Nada más.',
  },
  howPayTitle: { en: 'How paying works', es: 'Cómo funciona el pago' },
  howPayWords: {
    en: "Once a month we send a pay application for that month's work, with photos. Your architect certifies it. Then it is due in {days} days. Every one comes with a lien waiver from every trade we paid.",
    es: 'Una vez al mes enviamos una solicitud de pago por el trabajo de ese mes, con fotos. Su arquitecto la certifica. Luego vence en {days} días. Cada una trae una renuncia de gravamen de cada oficio que pagamos.',
  },
  howPayWordsNoDays: {
    en: "Once a month we send a pay application for that month's work, with photos. Your architect certifies it. Every one comes with a lien waiver from every trade we paid.",
    es: 'Una vez al mes enviamos una solicitud de pago por el trabajo de ese mes, con fotos. Su arquitecto la certifica. Cada una trae una renuncia de gravamen de cada oficio que pagamos.',
  },

  // Money: one card per pay application
  payAppN: { en: 'Pay application {n}', es: 'Solicitud de pago {n}' },
  paidOnDay: { en: 'paid {day}', es: 'pagada el {day}' },
  withArchitect: {
    en: 'With your architect, {name}, for the certificate since {day}.',
    es: 'Con su arquitecto, {name}, para el certificado desde el {day}.',
  },
  withArchitectUnnamed: {
    en: 'With your architect for the certificate since {day}.',
    es: 'Con su arquitecto para el certificado desde el {day}.',
  },
  dueDaysAfter: { en: 'Due {days} days after it.', es: 'Vence {days} días después.' },
  nothingYet: { en: 'Nothing to do yet.', es: 'Nada que hacer por ahora.' },
  certifiedBy: { en: 'Certified by {name}, {day}.', es: 'Certificada por {name}, el {day}.' },
  dueOnDay: { en: 'Due {day}.', es: 'Vence el {day}.' },
  waiversOne: { en: '1 lien waiver, the trade on it paid {day}', es: '1 renuncia de gravamen, el oficio pagado el {day}' },
  waiversMany: { en: '{n} lien waivers, every trade on it paid {day}', es: '{n} renuncias de gravamen, cada oficio pagado el {day}' },
  thankYou: { en: 'Thank you', es: 'Gracias' },
  thankYouSmall: { en: 'thank you', es: 'gracias' },
  receipt: { en: 'Receipt', es: 'Recibo' },
  waiversButton: { en: 'Waivers', es: 'Renuncias' },
  payIt: { en: 'Pay it', es: 'Pagar' },
  readApp: { en: 'Read the application', es: 'Leer la solicitud' },
  olderPaid: { en: 'Pay applications {list}, paid', es: 'Solicitudes de pago {list}, pagadas' },
  and: { en: ' and ', es: ' y ' },

  // Money: After that, the next one sized
  afterThatTitle: { en: 'After that', es: 'Después' },
  afterRange: { en: 'roughly {low} to {high}, about {day}', es: 'aproximadamente {low} a {high}, cerca del {day}' },
  afterAbout: { en: 'about {amount}, around {day}', es: 'cerca de {amount}, alrededor del {day}' },
  sizesNote: {
    en: 'Sizes follow the schedule. The real number comes with the application.',
    es: 'Los montos siguen el calendario. La cifra real llega con la solicitud.',
  },

  // Money: History, folded
  historyTitle: { en: 'History', es: 'Historial' },
  contractSigned: { en: 'Contract signed', es: 'Contrato firmado' },
  payAppPaid: { en: 'Pay application {n} paid', es: 'Solicitud de pago {n} pagada' },
  changeSigned: { en: 'Change order {n} signed', es: 'Orden de cambio {n} firmada' },
  tradesPaidOne: { en: '1 trade paid {day}', es: '1 oficio pagado el {day}' },
  tradesPaidMany: { en: '{n} trades paid {day}', es: '{n} oficios pagados el {day}' },
  withArchitectSince: { en: 'with your architect since {day}', es: 'con su arquitecto desde el {day}' },
  aboutDay: { en: 'about {day}', es: 'cerca del {day}' },
  investedSoFar: { en: 'Invested so far', es: 'Invertido hasta ahora' },
  toFinish: { en: 'To finish', es: 'Por terminar' },

  // Money: the statement, the six lines
  statementTitle: { en: 'The statement', es: 'El estado de cuenta' },
  lineContract: { en: 'Contract', es: 'Contrato' },
  lineChanges: { en: 'Changes signed', es: 'Cambios firmados' },
  lineRevised: { en: 'Revised sum', es: 'Suma revisada' },
  lineBilled: { en: 'Billed so far', es: 'Facturado' },
  linePaid: { en: 'Paid so far', es: 'Pagado' },
  lineBalance: { en: 'Balance to finish', es: 'Saldo por terminar' },
  payNoteCard: {
    en: 'Pay by bank transfer at no fee, or by card with a {fee} fee. The details are on each bill.',
    es: 'Pague por transferencia sin cargo, o con tarjeta con un cargo del {fee}. Los datos van en cada factura.',
  },
  payNoteBank: { en: 'Pay by bank transfer at no fee. The details are on each bill.', es: 'Pague por transferencia sin cargo. Los datos van en cada factura.' },

  // Papers
  signedTitle: { en: 'Signed', es: 'Firmados' },
  signedOn: { en: 'signed {day}', es: 'firmado el {day}' },
  readCopy: { en: 'Read or save a copy', es: 'Leer o guardar una copia' },
  waitingOnYou: { en: 'Waiting on you', es: 'Esperando por usted' },
  signBy: { en: 'Sign by {day}.', es: 'Fírmelo antes del {day}.' },
  comesLater: { en: 'Comes later', es: 'Vienen después' },
  laterPayApps: { en: 'Pay applications', es: 'Solicitudes de pago' },
  laterPayAppsWhen: { en: "one a month, with the architect's certificate", es: 'una al mes, con el certificado del arquitecto' },
  laterWaivers: { en: 'Lien waivers', es: 'Renuncias de gravamen' },
  laterWaiversWhen: { en: 'one per payment', es: 'una por pago' },
  laterBinder: { en: 'Closeout binder', es: 'Carpeta de cierre' },
  laterBinderWhen: { en: 'warranties, manuals, as-builts, at the end', es: 'garantías, manuales, planos finales, al terminar' },
  everyPaper: {
    en: 'Every paper here is also in the email we sent it in.',
    es: 'Cada documento aquí también está en el correo con el que se lo enviamos.',
  },
  changeOrderN: { en: 'Change order {n}', es: 'Orden de cambio {n}' },

  // Schedule
  milestones: { en: 'Milestones', es: 'Hitos' },
  whatMoved: { en: 'What moved', es: 'Qué se movió' },
  nothingMoved: { en: 'Nothing has moved since the schedule went.', es: 'Nada se ha movido desde que salió el calendario.' },
  nothingYetShort: { en: 'Nothing yet.', es: 'Aún nada.' },

  // Messages: the same thread, read from their side
  messagesSame: {
    en: 'The same conversation as your texts and emails with us. Write here, by text or by email. It all lands in one place.',
    es: 'La misma conversación que sus mensajes y correos con nosotros. Escriba aquí, por mensaje o por correo. Todo llega al mismo lugar.',
  },
  you: { en: 'You', es: 'Usted' },
  writeToUs: { en: 'Write to us…', es: 'Escríbanos…' },
  send: { en: 'Send', es: 'Enviar' },
  repliesHours: {
    en: 'Replies come from the office in business hours. For something urgent on site, call {name}.',
    es: 'Las respuestas salen de la oficina en horario de trabajo. Para algo urgente en obra, llame a {name}.',
  },
  doorHere: { en: 'here', es: 'aquí' },
  doorText: { en: 'by text', es: 'por mensaje' },
  doorEmail: { en: 'by email', es: 'por correo' },
} satisfies Record<string, Bilingual>

export type PortalWordKey = keyof typeof W

/** Every key, for the test that holds both languages to the same blanks. */
export const PORTAL_WORD_KEYS = Object.keys(W) as PortalWordKey[]

/** One of our sentences in a language, its {blanks} filled. */
export function say(lang: PortalLang, key: PortalWordKey, vars?: Record<string, string | number>): string {
  let out: string = W[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/** The raw text of a key in both languages, for the test and for Settings → Customer page. */
export function portalWord(key: PortalWordKey): Bilingual {
  return W[key]
}

/** The papers a step can turn on: the flow's own list (`flows/facts.ts`), so every paper there has words here. */
export type PortalPaperId = PaperId

/**
 * What a paper says on their page (PW): its name, a name that is theirs for the line that says it ran out, why we ask,
 * the press that does it (and a second one), what to expect while we are on it, when it comes when the flow's own step
 * has no when-line, and what to do once it ran out.
 */
export interface PaperWords {
  label: string
  yours?: string
  why?: string
  button?: string
  button2?: string
  onIt?: string
  comes?: string
  renew?: string
}

export const PAPER_WORDS: Record<PortalPaperId, Record<PortalLang, PaperWords>> = {
  invitation: { en: { label: 'Invitation' }, es: { label: 'Invitación' } },
  w9: {
    en: { label: 'W-9', yours: 'Your W-9', why: 'Sign it here. It takes a minute.', button: 'Sign your W-9' },
    es: { label: 'W-9', yours: 'Su W-9', why: 'Fírmelo aquí. Toma un minuto.', button: 'Firme su W-9' },
  },
  coi: {
    en: {
      label: 'Insurance certificate',
      yours: 'Your certificate of insurance',
      why: 'We need it before we can send you an agreement. A photo of it is fine.',
      button: 'Upload your certificate',
      renew: 'Upload the new one here. A photo of it is fine.',
    },
    es: {
      label: 'Certificado de seguro',
      yours: 'Su certificado de seguro',
      why: 'La necesitamos antes de enviarle el acuerdo. Una foto basta.',
      button: 'Suba su certificado',
      renew: 'Suba el nuevo aquí. Una foto basta.',
    },
  },
  msa: {
    en: {
      label: 'Master agreement',
      why: 'Read it and sign it here.',
      button: 'Sign the agreement',
      onIt: 'We are getting it ready. You sign it here.',
      comes: 'We send it once your certificate is in. You sign it here.',
    },
    es: {
      label: 'Acuerdo marco',
      why: 'Léalo y fírmelo aquí.',
      button: 'Firme el acuerdo',
      onIt: 'Lo estamos preparando. Lo firma aquí.',
      comes: 'Se lo enviamos cuando llegue su certificado. Lo firma aquí.',
    },
  },
  quote: {
    en: { label: 'Quote', why: 'Per the plans and the addenda.', button: 'Enter your quote', button2: 'Open the plans' },
    es: { label: 'Cotización', why: 'Según los planos y las adendas.', button: 'Ingrese su cotización', button2: 'Abra los planos' },
  },
  sow: {
    en: {
      label: 'Statement of work',
      why: 'Read it and sign it here.',
      button: 'Sign the statement of work',
      onIt: 'We are getting it ready. You sign it here.',
      comes: 'After the bid.',
    },
    es: {
      label: 'Alcance de trabajo',
      why: 'Léalo y fírmelo aquí.',
      button: 'Firme el alcance de trabajo',
      onIt: 'Lo estamos preparando. Lo firma aquí.',
      comes: 'Después de la licitación.',
    },
  },
  waiver: {
    en: { label: 'Lien waiver', button: 'Enter a draw' },
    es: { label: 'Renuncia de gravamen', button: 'Pida un pago' },
  },
  final_waiver: {
    en: { label: 'Final lien waiver', why: 'Upload the unconditional final waiver.', button: 'Upload the final waiver' },
    es: { label: 'Renuncia final de gravamen', why: 'Suba la renuncia final incondicional.', button: 'Suba la renuncia final' },
  },
  bid: {
    en: { label: 'Our bid', onIt: 'We are working on your number.' },
    es: { label: 'Nuestra oferta', onIt: 'Estamos preparando su número.' },
  },
  contract: {
    en: {
      label: 'Our contract',
      why: 'Read it and sign it here.',
      button: 'Sign the contract',
      onIt: 'We are getting it ready. You sign it here.',
      comes: 'We send it once you say yes.',
    },
    es: {
      label: 'Nuestro contrato',
      why: 'Léalo y fírmelo aquí.',
      button: 'Firme el contrato',
      onIt: 'Lo estamos preparando. Lo firma aquí.',
      comes: 'Se lo enviamos cuando acepte.',
    },
  },
  schedule: {
    en: { label: 'Start date letter', onIt: 'We are setting your start date.', comes: 'We send your start date once the contract is signed.' },
    es: {
      label: 'Carta de fecha de inicio',
      onIt: 'Estamos fijando su fecha de inicio.',
      comes: 'Le enviamos la fecha de inicio cuando el contrato esté firmado.',
    },
  },
  payapp: {
    en: { label: 'Pay application', why: 'Pay by the day on it.', button: 'See the pay application' },
    es: { label: 'Solicitud de pago', why: 'Pague para la fecha indicada.', button: 'Ver la solicitud de pago' },
  },
  co: {
    en: { label: 'Change order', why: 'Sign it or decline it here.', button: 'See the change order' },
    es: { label: 'Orden de cambio', why: 'Fírmela o recházela aquí.', button: 'Ver la orden de cambio' },
  },
  plans: {
    en: { label: 'Plan set', why: 'Upload the plan set.', button: 'Upload the plans' },
    es: { label: 'Juego de planos', why: 'Suba los planos.', button: 'Suba los planos' },
  },
  addendum: {
    en: { label: 'Addendum', onIt: 'We send it to the trades.' },
    es: { label: 'Adenda', onIt: 'La enviamos a los oficios.' },
  },
  submittal: {
    en: { label: 'Submittal', why: 'Review it here.', button: 'Review the submittal' },
    es: { label: 'Documento para aprobación', why: 'Revíselo aquí.', button: 'Revise el documento para aprobación' },
  },
  certificate: {
    en: { label: "Architect's certificate", why: 'Certify it or send it back with a note.', button: 'Certify the pay application' },
    es: { label: 'Certificado del arquitecto', why: 'Certifíquela o devuélvala con una nota.', button: 'Certifique la solicitud de pago' },
  },
}

/** A paper's words in a language. */
export function paperWords(lang: PortalLang, paper: PortalPaperId): PaperWords {
  return PAPER_WORDS[paper][lang]
}

/**
 * The words a page reads: the code's table (`CODE_WORDS`), or the table with the office's edits from Settings →
 * Customer page laid over it (`wordsWith`, the `customer_page_words` rows). Every kernel that writes a sentence for a
 * person's page takes one, so an edit reaches every place the sentence shows.
 */
export interface PageWords {
  say(lang: PortalLang, key: PortalWordKey, vars?: Record<string, string | number>): string
  paper(lang: PortalLang, paper: PortalPaperId): PaperWords
}

export const CODE_WORDS: PageWords = { say: (lang, key, vars) => say(lang, key, vars), paper: paperWords }

function fill(text: string, vars?: Record<string, string | number>): string {
  let out = text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/**
 * The code's words with each row laid over its key: a page key (`nothingToday`) or a paper's field
 * (`paper.contract.why`). A row whose key the code no longer has is left out, so a stale row never shows.
 */
export function wordsWith(rows: readonly { key: string; en: string; es: string }[]): PageWords {
  const page = new Map<string, Bilingual>()
  const papers = new Map<string, Bilingual>()
  for (const r of rows) {
    if (r.key.startsWith('paper.')) papers.set(r.key, { en: r.en, es: r.es })
    else if (r.key in W) page.set(r.key, { en: r.en, es: r.es })
  }
  return {
    say: (lang, key, vars) => fill((page.get(key) ?? W[key])[lang], vars),
    paper: (lang, id) => {
      const base = PAPER_WORDS[id][lang]
      const out: PaperWords = { ...base }
      for (const field of Object.keys(base) as (keyof PaperWords)[]) {
        const edit = papers.get(`paper.${id}.${field}`)
        if (edit) out[field] = edit[lang]
      }
      return out
    },
  }
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "October" in English, "octubre" in Spanish: the month a pay application is for, from any day in it. */
export function pMonth(lang: PortalLang, iso: string): string {
  const m = Number(iso.split('-')[1])
  return (lang === 'es' ? MONTHS_ES : MONTHS_EN)[m - 1] ?? iso
}

/** "Oct 8" / "8 oct", and "Thu Oct 8" / "jue 8 oct": main's portal dates, so every page writes a day one way. */
export { pDate, pWeekday }

/** "2 and 1", "3, 2 and 1" in English; "2 y 1", "3, 2 y 1" in Spanish. */
export function listWords(lang: PortalLang, items: (string | number)[], words: PageWords = CODE_WORDS): string {
  const parts = items.map(String)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')}${words.say(lang, 'and')}${parts[parts.length - 1]}`
}

/** "$41,200", the same in both languages. */
export { money }

/** "+$2,150" for a change that adds, "−$500" for a credit: a signed change's amount on the statement and in History. */
export function signedMoney(n: number): string {
  return n < 0 ? `−${money(-n)}` : `+${money(n)}`
}

/** What a change order does to the sum, in their words: "+$2,150", or "a credit of $500" for one that takes off. */
export function changeAmount(lang: PortalLang, price: number, words: PageWords = CODE_WORDS): string {
  return price < 0 ? words.say(lang, 'creditOf', { amount: money(-price) }) : `+${money(price)}`
}

/** What a change order does to the finish: "adds no days", "adds 1 working day", "adds 3 working days". */
export function changeDays(lang: PortalLang, days: number, words: PageWords = CODE_WORDS): string {
  if (days <= 0) return words.say(lang, 'addsNoDays')
  return days === 1 ? words.say(lang, 'addsOneDay') : words.say(lang, 'addsDays', { n: days })
}
