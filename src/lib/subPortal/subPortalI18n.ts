/**
 * Sub portal strings — English + Spanish (sub-portal train). Field subs are
 * often Spanish-first; every user-visible string on the portal lives here so
 * the Español toggle covers the whole page. Plain Mexican-Spanish
 * construction vocabulary, reviewed copy — no machine placeholders.
 */

export type SubPortalLang = 'en' | 'es'

const STRINGS = {
  statementKind: { en: 'Subcontractor statement', es: 'Estado de cuenta del subcontratista' },
  preparedOn: { en: 'Prepared', es: 'Preparado el' },
  workAndPay: { en: 'Work & pay statement', es: 'Resumen de trabajo y pagos' },
  currentAsOfToday: { en: 'Everything current as of today', es: 'Todo al día de hoy' },
  owedToYou: { en: 'Owed to you', es: 'Se le debe' },
  queuedForRun: { en: 'queued for the {day} pay run', es: 'en la corrida de pago del {day}' },
  printStatement: { en: 'Print statement', es: 'Imprimir estado' },
  printHint: { en: 'Saves as a PDF from the print dialog', es: 'Se guarda como PDF desde la ventana de impresión' },
  howPayWorks: { en: 'How pay works here', es: 'Así funcionan los pagos' },
  yourJobs: { en: 'Your jobs right now', es: 'Sus trabajos actuales' },
  yourJobsNote: { en: "agreed price · what's been paid · what's open", es: 'precio acordado · pagado · pendiente' },
  noOpenJobs: { en: 'No open balances right now — everything is settled up.', es: 'No hay saldos pendientes — todo está al corriente.' },
  inProgress: { en: 'In progress', es: 'En curso' },
  workComplete: { en: 'Work complete', es: 'Trabajo terminado' },
  agreed: { en: 'Agreed', es: 'Acordado' },
  paidLabel: { en: 'Paid', es: 'Pagado' },
  openLabel: { en: 'Open', es: 'Pendiente' },
  payableAfter: { en: 'Payable after {date}', es: 'Se paga después del {date}' },
  newWork: { en: 'New work for you', es: 'Trabajo nuevo para usted' },
  newWorkNote: { en: 'take it or pass — no pressure', es: 'acéptelo o páselo — sin compromiso' },
  offerExpires: { en: 'Offer good through {date}', es: 'Oferta válida hasta el {date}' },
  signToAccept: { en: 'Sign to accept this work', es: 'Firmar para aceptar este trabajo' },
  pass: { en: 'Pass', es: 'Pasar' },
  orCallOffice: { en: 'or call the office:', es: 'o llame a la oficina:' },
  offerAccepted: { en: "✓ Accepted — we'll be in touch with the schedule.", es: '✓ Aceptado — le avisamos con el calendario.' },
  offerDeclined: { en: 'Passed — thanks for letting us know.', es: 'Pasado — gracias por avisarnos.' },
  declineWhy: { en: 'Tell us why (helps us fix it):', es: 'Díganos por qué (nos ayuda a mejorar):' },
  declineSend: { en: 'Send', es: 'Enviar' },
  workOrder: { en: 'Work order', es: 'Orden de trabajo' },
  underMsa: {
    en: 'This work order is performed under your Master Subcontract Agreement.',
    es: 'Esta orden de trabajo se realiza bajo su Contrato Maestro de Subcontratación.',
  },
  signAgreeLabel: { en: 'I agree to this work order.', es: 'Acepto esta orden de trabajo.' },
  signDisclosure: {
    en: 'By signing, you agree to perform this work for this price under your Master Subcontract Agreement. Typing or drawing your signature has the same force and effect as your written signature.',
    es: 'Al firmar, usted acepta realizar este trabajo por este precio bajo su Contrato Maestro de Subcontratación. Escribir o dibujar su firma tiene la misma validez que su firma manuscrita.',
  },
  signSubmit: { en: 'Accept & sign', es: 'Aceptar y firmar' },
  paidToYou: { en: "What you've been paid", es: 'Lo que se le ha pagado' },
  last90: { en: 'last 90 days', es: 'últimos 90 días' },
  noPayments90: { en: 'No payments in the last 90 days.', es: 'Sin pagos en los últimos 90 días.' },
  colDate: { en: 'Date', es: 'Fecha' },
  colJob: { en: 'Job', es: 'Trabajo' },
  colNote: { en: 'Note', es: 'Nota' },
  colAmount: { en: 'Amount', es: 'Monto' },
  minusNote: {
    en: 'A minus amount is a deduction we went over with you first.',
    es: 'Un monto negativo es un descuento que ya revisamos con usted.',
  },
  earnedToDate: { en: 'Earned with Click to date', es: 'Ganado con Click hasta hoy' },
  paidToDate: { en: 'Paid to date', es: 'Pagado hasta hoy' },
  balanceOwed: { en: 'Balance owed to you', es: 'Saldo a su favor' },
  paperwork: { en: 'Your paperwork on file', es: 'Sus documentos en archivo' },
  paperworkNote: { en: 'so you never have to re-send it', es: 'para que nunca los vuelva a enviar' },
  noPaperwork: { en: 'Nothing on file yet — the office will send what needs signing.', es: 'Aún no hay documentos — la oficina le enviará lo que falte firmar.' },
  docSigned: { en: 'Signed {date}', es: 'Firmado el {date}' },
  docOnFile: { en: 'On file', es: 'En archivo' },
  docExpires: { en: 'Expires {date} — send us the renewal when you get it', es: 'Vence el {date} — envíenos la renovación cuando la tenga' },
  docExpired: { en: 'Expired {date} — please send us the renewal', es: 'Venció el {date} — por favor envíenos la renovación' },
  docNeedsSignature: { en: 'Needs your signature — takes about a minute', es: 'Falta su firma — toma un minuto' },
  signNow: { en: 'Sign now', es: 'Firmar ahora' },
  signAt: { en: '→ Sign online at:', es: '→ Firme en línea en:' },
  paperworkReassure: {
    en: "We keep these on every job's file so builders never hold up your payment over paperwork.",
    es: 'Guardamos estos documentos en el expediente de cada trabajo para que los constructores nunca detengan su pago por papeleo.',
  },
  tearLabel: { en: 'tell us your availability', es: 'díganos su disponibilidad' },
  moreWork: { en: 'Looking for more work?', es: '¿Busca más trabajo?' },
  moreWorkBody: {
    en: "Tell us when you're free and how many hands you have — we'll match you to what's coming.",
    es: 'Díganos cuándo está libre y cuántas manos tiene — lo conectamos con lo que viene.',
  },
  availabilityPlaceholder: {
    en: 'e.g. Free after Sep 20, two of us, prefer south Austin',
    es: 'p. ej. Libre después del 20 sep, somos dos, preferimos el sur de Austin',
  },
  phonePlaceholder: { en: 'Best phone number', es: 'Mejor número de teléfono' },
  sendToOffice: { en: 'Send to the office', es: 'Enviar a la oficina' },
  sentToOffice: { en: "Sent — we'll be in touch.", es: 'Enviado — nos pondremos en contacto.' },
  yourPage: { en: 'Your page, any time', es: 'Su página, a cualquier hora' },
  yourPageBody: {
    en: 'Bookmark it or scan the code — it always shows your latest jobs, pay, and paperwork.',
    es: 'Guárdela o escanee el código — siempre muestra sus trabajos, pagos y documentos al día.',
  },
  footer: {
    en: 'This link is private to you · Questions? Call or text the office',
    es: 'Este enlace es privado para usted · ¿Preguntas? Llame o mande texto a la oficina',
  },
  couldNotOpenTitle: { en: "We couldn't open this page", es: 'No pudimos abrir esta página' },
  opening: { en: 'Opening your statement…', es: 'Abriendo su estado de cuenta…' },
  yourName: { en: 'Your name', es: 'Su nombre' },
  namePlaceholder: { en: 'Your full legal name', es: 'Su nombre legal completo' },
  cancel: { en: 'Cancel', es: 'Cancelar' },
  // ── Sub sheet stages (v2.2767): the tracker rail, its sentence, the sub's one button ──
  railWork: { en: 'Work', es: 'Trabajo' },
  railWalk: { en: 'Walk-through', es: 'Revisión' },
  railCustomer: { en: 'Customer pays', es: 'El cliente paga' },
  railPaid: { en: "You're paid", es: 'Le pagamos' },
  chipWalk: { en: 'Walk-through next', es: 'Sigue la revisión' },
  chipCustomer: { en: 'Customer to pay', es: 'Falta el pago del cliente' },
  stageWorkingLine: {
    en: "Finish up, then tell us below and we'll come walk it.",
    es: 'Termine el trabajo, avísenos abajo y pasamos a revisarlo.',
  },
  stageWalkPortalLine: {
    en: "You told us the work's done {date}. We'll schedule the walk-through and let you know.",
    es: 'Nos avisó que el trabajo quedó listo el {date}. Programaremos la revisión y le avisamos.',
  },
  stageWalkOfficeLine: {
    en: "Work's done — our walk-through is next.",
    es: 'Trabajo terminado — sigue nuestra revisión.',
  },
  stageCustomerLine: {
    en: "Passed the walk-through{date}. The customer's payment is the last thing between you and this money — it queues for the next pay run the day it lands.",
    es: 'Pasó la revisión{date}. El pago del cliente es lo único que falta — el día que llega, entra a la siguiente corrida de pago.',
  },
  workDoneButton: { en: '✓ My work here is done', es: '✓ Ya terminé este trabajo' },
  workDoneTitle: { en: 'Done with the work at {where}?', es: '¿Terminó el trabajo en {where}?' },
  workDoneBody: {
    en: "We'll schedule the walk-through and move this toward payment. Anything we should know before we come out?",
    es: 'Programaremos la revisión y avanzamos hacia su pago. ¿Algo que debamos saber antes de ir?',
  },
  workDonePlaceholder: {
    en: 'e.g. Cleanout is behind the water heater — gate code 4471',
    es: 'p. ej. La limpieza está detrás del calentador — código del portón 4471',
  },
  workDoneConfirm: { en: '✓ Yes, ready for the walk-through', es: '✓ Sí, listo para la revisión' },
  workDoneNotYet: { en: 'Not yet', es: 'Todavía no' },
  workDoneFootnote: {
    en: "This tells our office today's date and your name — it doesn't change what you're owed.",
    es: 'Esto le avisa a la oficina la fecha de hoy y su nombre — no cambia lo que se le debe.',
  },
  workDoneThanks: {
    en: "Thanks — we'll schedule the walk-through and let you know.",
    es: 'Gracias — programaremos la revisión y le avisamos.',
  },
} as const

export type SubPortalStringKey = keyof typeof STRINGS

/** Look up a string; `{tokens}` interpolate from vars. */
export function subPortalT(
  lang: SubPortalLang,
  key: SubPortalStringKey,
  vars?: Record<string, string>,
): string {
  let out: string = STRINGS[key][lang]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(v)
    }
  }
  return out
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-05" → "Sep 5, 2026" / "5 sep 2026". Bad input echoes back. */
export function formatSubPortalDate(ymd: string | null, lang: SubPortalLang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd ?? '').trim())
  if (!m) return ymd ?? ''
  const year = Number(m[1])
  const monthIdx = Number(m[2]) - 1
  const day = Number(m[3])
  const month = (lang === 'es' ? MONTHS_ES : MONTHS_EN)[monthIdx]
  if (!month) return ymd ?? ''
  return lang === 'es' ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`
}

const DAY_EN: Record<string, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
}
const DAY_ES: Record<string, string> = {
  sunday: 'domingo', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
  thursday: 'jueves', friday: 'viernes', saturday: 'sábado',
}

/** Pay-run day name for copy ("Friday" / "viernes"); null when unset. */
export function formatPayRunDay(day: string | null, lang: SubPortalLang): string | null {
  const key = (day ?? '').trim().toLowerCase()
  return (lang === 'es' ? DAY_ES : DAY_EN)[key] ?? null
}
