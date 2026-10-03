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
import { shortDate, weekdayDate } from './gcWords'

export type PortalLang = 'en' | 'es'

const S = {
  // The letterhead and the project page
  switchLang: { en: 'Español', es: 'English' },
  letterhead: { en: 'Trade partner portal', es: 'Portal de subcontratistas' },
  backHome: { en: '← Everything with {gc}', es: '← Todo con {gc}' },
  gcLine: { en: 'General contractor: {name} · Hello, {contact}.', es: 'Contratista general: {name} · Hola, {contact}.' },
  noInvite: { en: 'You have no open invitation on this project.', es: 'No tiene una invitación abierta en este proyecto.' },
  close: { en: 'Close', es: 'Cerrar' },
  and: { en: ' and ', es: ' y ' },
  or: { en: ' or ', es: ' o ' },

  // A trade's plans, bid tab and result
  plansTitle: { en: '{trade} · plans', es: '{trade} · planos' },
  issued: { en: 'issued {date}', es: 'emitido el {date}' },
  openPlans: { en: 'Open the plans', es: 'Abrir los planos' },
  latestSet: { en: 'you have the latest set', es: 'tiene el juego más reciente' },
  lookPlans: { en: 'Look at the plans', es: 'Ver los planos' },
  newForTrade: { en: 'New for {trade} since you last looked', es: 'Nuevo para {trade} desde la última vez que entró' },
  sheetsList: { en: 'Sheets {list}.', es: 'Hojas {list}.' },
  setNoChange: {
    en: '{label} does not change {trade}. Open it so you price on the newest set.',
    es: '{label} no cambia {trade}. Ábralo para cotizar con el juego más reciente.',
  },
  bidTabTitle: { en: '{trade} · bid tab', es: '{trade} · tabla de precios' },
  bidTabThanks: { en: 'Thank you for your number. This is how the quotes came in.', es: 'Gracias por su precio. Así llegaron las cotizaciones.' },
  bidTabShared: { en: '{gc} shared how the quotes came in on {date}.', es: '{gc} compartió cómo llegaron las cotizaciones el {date}.' },
  seeBidTab: { en: 'See the bid tab', es: 'Ver la tabla de precios' },
  resultTitle: { en: '{trade} · result', es: '{trade} · resultado' },
  wentElsewhere: { en: 'This one went to another company. Thank you for your number.', es: 'Este trabajo fue para otra empresa. Gracias por su precio.' },
  inviteTitle: { en: '{trade} · invitation', es: '{trade} · invitación' },
  youPassed: { en: 'You passed on this one.', es: 'Usted no cotizó este.' },

  // The bid form
  bidTitle: { en: '{trade} · invitation to bid', es: '{trade} · invitación a cotizar' },
  dueIs: { en: 'Your number is due', es: 'Su precio vence el' },
  daysN: { en: '{n} days', es: '{n} días' },
  pastDue: { en: 'past due', es: 'vencido' },
  yourBidLabel: { en: 'Your bid:', es: 'Su precio:' },
  yourBidRest: { en: 'on {plans}, sent {date}.', es: 'con {plans}, enviado el {date}.' },
  goodUntil: { en: 'Good until {date}.', es: 'Válido hasta el {date}.' },
  alternatesLabel: { en: 'Alternates:', es: 'Alternativas:' },
  ownQuoteLabel: { en: 'Your own quote:', es: 'Su propia cotización:' },
  ranOut: { en: 'Your number ran out {date}. Send it again to keep it good.', es: 'Su precio venció el {date}. Envíelo de nuevo para que siga válido.' },
  sendAgain: { en: 'Send it again', es: 'Enviarlo de nuevo' },
  staleNote: { en: 'The plans changed for your trade after you bid.', es: 'Los planos de su especialidad cambiaron después de que cotizó.' },
  staleOpened: { en: 'Confirm your number or change it.', es: 'Confirme su precio o cámbielo.' },
  staleNotOpened: { en: 'Open the plans above, then confirm your number or change it.', es: 'Abra los planos de arriba y luego confirme su precio o cámbielo.' },
  unclearAsk: {
    en: '{gc} cannot tell if your number covers {items}. Answer it so your number compares fairly.',
    es: '{gc} no sabe si su precio incluye {items}. Contéstelo para que su precio se compare de forma justa.',
  },
  answerIt: { en: 'Answer it', es: 'Contestar' },
  confirmStands: { en: 'My number stands on the new plans', es: 'Mi precio se mantiene con los planos nuevos' },
  openFirst: { en: 'Open the plans first.', es: 'Primero abra los planos.' },
  changeBid: { en: 'Change my bid', es: 'Cambiar mi precio' },
  tickHelp: {
    en: 'Tick what your number covers. Untick what it leaves out. Tap a sheet number to open it.',
    es: 'Marque lo que incluye su precio. Desmarque lo que no incluye. Toque un número de hoja para abrirla.',
  },
  unclearLine: { en: '{gc} cannot tell if your number covers it.', es: '{gc} no sabe si su precio lo incluye.' },
  inMyNumber: { en: 'It is in my number', es: 'Está incluido en mi precio' },
  leftOut: { en: 'It is left out', es: 'No está incluido' },
  alsoChangedIn: { en: 'Also changed in {sets}', es: 'También cambió en {sets}' },
  yourNumber: { en: 'Your number', es: 'Su precio' },
  anythingKnow: { en: 'Anything we should know', es: 'Algo que debamos saber' },
  sendNew: { en: 'Send my new number', es: 'Enviar mi nuevo precio' },
  sendBid: { en: 'Send my bid', es: 'Enviar mi precio' },
  passOn: { en: 'Pass on this one', es: 'No cotizar este' },
  keepBid: { en: 'Keep my bid as it is', es: 'Dejar mi precio como está' },
  answerEach: { en: 'Answer each line first.', es: 'Primero conteste cada partida.' },
  notReady: { en: 'Not ready yet? Tell {gc} when your number will come.', es: '¿Todavía no está listo? Dígale a {gc} cuándo llegará su precio.' },
  dayAria: { en: 'The day your number will come', es: 'El día que llegará su precio' },
  giveNewDay: { en: 'Give a new day', es: 'Dar un nuevo día' },
  changeDay: { en: 'Change the day', es: 'Cambiar el día' },
  tellGc: { en: 'Tell {gc}', es: 'Avisar a {gc}' },

  // The bid form past the number
  goodFor: { en: 'Your number is good for', es: 'Su precio es válido por' },
  alternatesTitle: { en: 'Alternates', es: 'Alternativas' },
  alternatesHelp: {
    en: '· another way to do the work, at a different price. You do not have to give one.',
    es: '· otra forma de hacer el trabajo, a otro precio. No es obligatorio.',
  },
  remove: { en: 'Remove', es: 'Quitar' },
  altPlaceholder: { en: 'What is different, like LED high bays', es: 'Qué cambia, por ejemplo lámparas LED' },
  altWhat: { en: 'What is different', es: 'Qué cambia' },
  adds: { en: 'adds', es: 'suma' },
  takesOff: { en: 'takes off', es: 'resta' },
  addsOrTakes: { en: 'Adds or takes off', es: 'Suma o resta' },
  howMuch: { en: 'How much', es: 'Cuánto' },
  addIt: { en: 'Add it', es: 'Agregar' },
  ownQuoteTitle: { en: 'Your own quote', es: 'Su propia cotización' },
  ownQuoteHelp: { en: '· attach it if you have one. Your number above is the one that counts.', es: '· adjúntela si tiene una. El precio de arriba es el que cuenta.' },
  answerIntro: { en: '{gc} cannot tell if your number covers these. Your number stays as you sent it.', es: '{gc} no sabe si su precio incluye esto. Su precio se queda como lo envió.' },
  sendAnswer: { en: 'Send my answer', es: 'Enviar mi respuesta' },
  altAdds: { en: '{label} adds {amount}', es: '{label} suma {amount}' },
  altTakesOff: { en: '{label} takes off {amount}', es: '{label} resta {amount}' },

  // The statement of work and getting paid
  gotJobTitle: { en: '{trade} · you got the job', es: '{trade} · el trabajo es suyo' },
  sowDraft: { en: '{gc} picked your number. Your statement of work is being written.', es: '{gc} eligió su precio. Estamos preparando su orden de trabajo.' },
  sowTitle: { en: '{trade} · statement of work', es: '{trade} · orden de trabajo' },
  sowLine: { en: '{pct}% held until the end · based on {plans}', es: '{pct}% retenido hasta el final · con base en {plans}' },
  signSow: { en: 'Sign the statement of work', es: 'Firmar la orden de trabajo' },
  signMsaFirst: { en: 'Sign the master agreement first.', es: 'Primero firme el contrato maestro.' },
  signedOn: { en: 'signed {date}', es: 'firmado el {date}' },
  reportTitle: { en: '{trade} · report your work and get paid', es: '{trade} · reporte su avance y cobre' },
  paidThrough: { en: 'paid through {pct}%', es: 'pagado hasta {pct}%' },
  percentAria: { en: 'Percent done, {line}', es: 'Porcentaje de avance, {line}' },
  pctDone: { en: '{pct}% done', es: '{pct}% terminado' },
  drawN: { en: 'Draw {n}', es: 'Pago {n}' },
  drawReviewing: { en: '{gc} is reviewing it', es: '{gc} lo está revisando' },
  drawApproved: { en: 'approved, payment coming', es: 'aprobado, el pago viene en camino' },
  drawPaid: { en: 'paid', es: 'pagado' },
  drawOfAsked: { en: 'of {asked} asked', es: 'de {asked} pedidos' },
  signUncond: { en: 'Sign the unconditional waiver', es: 'Firmar la renuncia incondicional' },
  sowTotals: { en: 'Paid so far {paid} · held {held} · left to bill {left}', es: 'Pagado hasta hoy {paid} · retenido {held} · por facturar {left}' },

  // The company's home
  hello: { en: 'Hello, {name}.', es: 'Hola, {name}.' },
  homeIntro: { en: 'This is everything {company} has with {gc}. The link is yours. Keep it.', es: 'Aquí está todo lo que {company} tiene con {gc}. El enlace es suyo. Guárdelo.' },
  needsYou: { en: 'Needs you', es: 'Pendiente para usted' },
  nothingNeeds: { en: 'Nothing needs you right now.', es: 'Por ahora no hay nada pendiente.' },
  yourMoney: { en: 'Your money', es: 'Su dinero' },
  paidToYou: { en: 'Paid to you', es: 'Pagado a usted' },
  heldEnd: { en: 'Held until the end', es: 'Retenido hasta el final' },
  approvedWay: { en: 'Approved, on the way', es: 'Aprobado, en camino' },
  gcLooking: { en: '{gc} is looking at', es: '{gc} está revisando' },
  yourJobs: { en: 'Your jobs', es: 'Sus trabajos' },
  askedToBid: { en: 'Asked to bid', es: 'Invitado a cotizar' },
  before: { en: 'Before', es: 'Anteriores' },
  wentOther: { en: 'went to another company', es: 'fue para otra empresa' },
  youPassedShort: { en: 'you passed', es: 'no cotizó' },
  whenWon: { en: '{gc} won the job. {trade} is not picked yet.', es: '{gc} ganó el proyecto. Todavía no se elige a nadie para {trade}.' },
  whenSent: { en: '{gc} sent its bid {date}. The owner picks next.', es: '{gc} envió su propuesta el {date}. Ahora decide el dueño.' },
  noDueDay: { en: 'No due day yet.', es: 'Todavía no hay fecha límite.' },
  wasDue: { en: 'Was due {date}.', es: 'Venció el {date}.' },
  dueToday: { en: 'Due today, {date}.', es: 'Vence hoy, {date}.' },
  dueIn1: { en: 'Due {date}, 1 day left.', es: 'Vence el {date}, falta 1 día.' },
  dueInN: { en: 'Due {date}, {n} days left.', es: 'Vence el {date}, faltan {n} días.' },
  chipNumber: { en: 'your number {amount}', es: 'su precio {amount}' },
  chipDayPassed: { en: 'your day passed', es: 'ya pasó su fecha' },
  chipNoNumber: { en: 'no number yet', es: 'sin precio todavía' },
  chipRanOut: { en: 'your number ran out', es: 'su precio venció' },
  chipPlansChanged: { en: 'plans changed', es: 'cambiaron los planos' },
  chipLineToAnswer: { en: 'a line to answer', es: 'una partida por contestar' },
  chipSowWritten: { en: 'statement of work being written', es: 'preparando la orden de trabajo' },
  chipSignSow: { en: 'sign the statement of work', es: 'firme la orden de trabajo' },
  chipClosedOut: { en: 'closed out', es: 'cerrado' },
  chipClosingOut: { en: 'closing out', es: 'en cierre' },
  chipSentBack: { en: 'pay application {n} sent back', es: 'solicitud de pago {n} devuelta' },
  jobLine: { en: 'Work {pct}% done · paid {paid} · held {held}', es: 'Avance {pct}% · pagado {paid} · retenido {held}' },
  welcomeTitle: { en: 'Welcome', es: 'Bienvenida' },
  welcomeName: { en: 'Welcome, {name}.', es: 'Le damos la bienvenida, {name}.' },
  welcomeAsked: { en: '{gc} asked {company} to bid {trade} on {project}.', es: '{gc} invitó a {company} a cotizar {trade} en {project}.' },
  welcomeAdded: { en: '{gc} added {company} to its trade partners.', es: '{gc} agregó a {company} a sus subcontratistas.' },
  welcomeWhere: { en: 'This portal is where you work with us.', es: 'En este portal trabaja con nosotros.' },
  welcomeHolds: {
    en: 'It holds every job, the plans, your paperwork and your pay. There is no password. The link is yours, so keep it.',
    es: 'Aquí están todos sus trabajos, los planos, sus documentos y sus pagos. No hay contraseña. El enlace es suyo, así que guárdelo.',
  },
  welcome1: { en: 'Open the plans before you price.', es: 'Abra los planos antes de cotizar.' },
  welcome2: { en: 'Send your number by the day it is due. Not for you? Press Pass on this one.', es: 'Envíe su precio antes de la fecha límite. ¿No le interesa? Toque No cotizar este.' },
  welcome3: { en: 'Send your insurance and W-9 when you can. We need them before any work starts.', es: 'Envíe su seguro y su W-9 cuando pueda. Los necesitamos antes de empezar cualquier trabajo.' },
  gotIt: { en: 'Got it', es: 'Entendido' },

  // Paperwork
  paperTitle: { en: 'Your paperwork with {gc}', es: 'Sus documentos con {gc}' },
  masterAgreement: { en: 'Master agreement', es: 'Contrato maestro' },
  readSign: { en: 'Read and sign', es: 'Leer y firmar' },
  msaWhenPicked: { en: '{gc} sends it when they pick your number', es: '{gc} lo envía cuando elige su precio' },
  insuranceCert: { en: 'Insurance certificate', es: 'Certificado de seguro' },
  sendNewer: { en: 'Send a newer one', es: 'Enviar uno más reciente' },
  sendCert: { en: 'Send your certificate', es: 'Enviar su certificado' },
  w9: { en: 'W-9', es: 'W-9' },
  onFile: { en: 'on file', es: 'en archivo' },
  noneOnFile: { en: 'none on file', es: 'no tenemos' },
  coiRanOut: { en: 'ran out {date}', es: 'venció el {date}' },
  coiGoodTo: { en: 'good to {date}', es: 'vigente hasta el {date}' },
  fillW9: { en: 'Fill in your W-9', es: 'Llenar su W-9' },
  msaOnce: { en: 'You sign the master agreement once. Each job after that is a short statement of work.', es: 'El contrato maestro se firma una sola vez. Después, cada trabajo es una orden de trabajo corta.' },
  certFile: { en: 'A photo or PDF of the certificate', es: 'Una foto o PDF del certificado' },
  certExpires: { en: 'The day the policy runs out', es: 'El día que vence la póliza' },
  sendTo: { en: 'Send it to {gc}', es: 'Enviarlo a {gc}' },
  notNow: { en: 'Not now', es: 'Ahora no' },
  protoNoFile: { en: 'Prototype: sending works without a file.', es: 'Prototipo: se puede enviar sin archivo.' },
  w9Name: { en: 'Business name, as on your taxes', es: 'Nombre del negocio, como aparece en sus impuestos' },
  w9Kind: { en: 'What kind of business', es: 'Tipo de negocio' },
  w9Tax: { en: 'Tax ID number, nine digits', es: 'Número de identificación fiscal, nueve dígitos' },
  w9Certify: { en: 'I certify this W-9 is true.', es: 'Certifico que este W-9 es verdadero.' },
  signW9: { en: 'Sign the W-9', es: 'Firmar el W-9' },
  taxLlc: { en: 'LLC', es: 'LLC' },
  taxCorp: { en: 'Corporation', es: 'Corporación' },
  taxSole: { en: 'Sole owner', es: 'Dueño único' },
  taxPartner: { en: 'Partnership', es: 'Sociedad' },

  // The master agreement
  agreementTitle: { en: 'Master agreement', es: 'Contrato maestro' },
  between: { en: 'Between {company} and {gc}', es: 'Entre {company} y {gc}' },
  typeName: { en: 'Type your full name to sign', es: 'Escriba su nombre completo para firmar' },
  iAgree: { en: 'I read the master agreement and I agree to it.', es: 'Leí el contrato maestro y estoy de acuerdo.' },
  signMsa: { en: 'Sign the master agreement', es: 'Firmar el contrato maestro' },
  msaIntro: {
    en: 'You sign this once. It covers every job you do for {gc}. Each job then gets a short statement of work.',
    es: 'Esto se firma una sola vez. Cubre todos los trabajos que haga para {gc}. Después, cada trabajo lleva una orden de trabajo corta.',
  },
  term1Title: { en: 'Each job', es: 'Cada trabajo' },
  term1: {
    en: 'A job starts with a statement of work. You sign it in this portal. It says the work, the price and the plans it is based on. Nothing is owed on a job without one.',
    es: 'Cada trabajo empieza con una orden de trabajo. Usted la firma en este portal. Dice el trabajo, el precio y los planos en que se basa. Sin orden de trabajo no se debe nada.',
  },
  term2Title: { en: 'The plans', es: 'Los planos' },
  term2: {
    en: 'Your price is based on one set of plans. When a new set changes your trade, {gc} tells you. You confirm your number or send a new one.',
    es: 'Su precio se basa en un juego de planos. Cuando un juego nuevo cambia su especialidad, {gc} le avisa. Usted confirma su precio o manda uno nuevo.',
  },
  term3Title: { en: 'Changes', es: 'Cambios' },
  term3: {
    en: 'Work outside the statement of work needs a change in writing first. {gc} adds it to the statement of work before you start it.',
    es: 'El trabajo fuera de la orden de trabajo necesita primero un cambio por escrito. {gc} lo agrega a la orden de trabajo antes de que usted empiece.',
  },
  term4Title: { en: 'Your paperwork', es: 'Sus documentos' },
  term4: {
    en: 'Keep your insurance current and a W-9 on file. {gc} cannot send a statement of work or pay a draw without them.',
    es: 'Mantenga su seguro vigente y su W-9 en archivo. Sin ellos, {gc} no puede enviar una orden de trabajo ni pagar.',
  },
  term5Title: { en: 'Getting paid', es: 'Cómo se le paga' },
  term5: {
    en: 'Report how far along each line of the work is. Then ask for a draw in this portal. {gc} holds back part of each draw until the job is done. Each statement of work says how much.',
    es: 'Reporte el avance de cada partida del trabajo. Luego pida su pago en este portal. {gc} retiene una parte de cada pago hasta que termine el trabajo. Cada orden de trabajo dice cuánto.',
  },
  term6Title: { en: 'Lien waivers', es: 'Renuncias de gravamen' },
  term6: {
    en: 'Sign a conditional waiver when you ask for a draw. Sign the unconditional waiver once that draw is paid.',
    es: 'Firme una renuncia condicional cuando pida un pago. Firme la renuncia incondicional cuando se le pague.',
  },
  protoAgreement: {
    en: 'Prototype. The real portal shows the Master Subcontract Agreement from the contract library here.',
    es: 'Prototipo. El portal real muestra aquí el Contrato Maestro de Subcontratación de la biblioteca de contratos.',
  },

  // The plans window and the sheet numbers
  plansWindowTitle: { en: '{project} · plans', es: '{project} · planos' },
  drawnBy: { en: '{address} · drawn by {architect}', es: '{address} · dibujado por {architect}' },
  newest: { en: 'newest', es: 'más reciente' },
  olderSet: { en: 'An older set. {label} replaced it.', es: 'Un juego anterior. {label} lo reemplazó.' },
  setChanges: { en: 'This set changes {trade}.', es: 'Este juego cambia {trade}.' },
  setNotChange: { en: 'This set does not change {trade}.', es: 'Este juego no cambia {trade}.' },
  chipNew: { en: 'new', es: 'nueva' },
  chipChanged: { en: 'changed', es: 'cambió' },
  addedIn: { en: 'added in {set}', es: 'agregada en {set}' },
  changedIn: { en: 'changed in {set}', es: 'cambió en {set}' },
  back: { en: '← Back', es: '← Atrás' },
  next: { en: 'Next →', es: 'Siguiente →' },
  sheetOf: { en: 'Sheet {i} of {n}', es: 'Hoja {i} de {n}' },
  planSetGroup: { en: 'Plan set', es: 'Juego de planos' },
  openSheet: { en: 'Open {id}', es: 'Abrir {id}' },
  touchesLines: { en: '{sets} touches these lines of your number.', es: '{sets} toca estas partidas de su precio.' },
  readsEvery: { en: 'reads every {trade} sheet', es: 'usa todas las hojas de {trade}' },
  readEveryMany: { en: 'read every {trade} sheet', es: 'usan todas las hojas de {trade}' },
  alsoChanged: { en: 'Also changed', es: 'También cambió' },
  changedInSets: { en: 'Changed in {sets}', es: 'Cambió en {sets}' },

  // Who to call
  whoToCall: { en: 'Who to call', es: 'A quién llamar' },
  roleSuper: { en: 'superintendent, on site', es: 'superintendente en obra' },
  rolePm: { en: 'project manager', es: 'gerente de proyecto' },
  rolePmBid: { en: 'project manager, for this bid', es: 'gerente de proyecto, para esta cotización' },
  rolePay: { en: 'pay and paperwork', es: 'pagos y documentos' },
  callLink: { en: 'Call', es: 'Llamar' },
  textLink: { en: 'Text', es: 'Mensaje' },
  emailLink: { en: 'Email', es: 'Correo' },
  payQuestions: { en: 'Questions about pay: {name}, {phone}.', es: 'Preguntas sobre pagos: {name}, {phone}.' },

  // Your pay
  payTitle: { en: 'Your pay', es: 'Sus pagos' },
  payIntro: {
    en: 'Every pay application on your jobs with {gc}, newest first. {gc} pays an approved one within {days} days.',
    es: 'Cada solicitud de pago de sus trabajos con {gc}, la más reciente primero. {gc} paga una aprobada en {days} días o menos.',
  },
  seeEveryPayment: { en: 'See every payment', es: 'Ver todos los pagos' },
  payOnTheWay: { en: 'On the way', es: 'En camino' },
  payChecking: { en: '{gc} is checking', es: '{gc} está revisando' },
  payLate1: { en: 'One payment is late. Call {gc}.', es: 'Un pago está atrasado. Llame a {gc}.' },
  payLateN: { en: '{n} payments are late. Call {gc}.', es: '{n} pagos están atrasados. Llame a {gc}.' },
  payAppN: { en: 'pay application {n}', es: 'solicitud de pago {n}' },
  payAppFinal: { en: 'final pay application', es: 'solicitud de pago final' },
  payHeld: { en: 'held {held}', es: 'retenido {held}' },
  payAsked: { en: 'asked {date}', es: 'pedido el {date}' },
  payApprovedOn: { en: 'approved {date}', es: 'aprobado el {date}' },
  payPaidOn: { en: 'paid {date}', es: 'pagado el {date}' },
  payBy: { en: 'payment by {date}', es: 'pago a más tardar el {date}' },
  payWasDue: { en: 'payment was due {date}', es: 'el pago vencía el {date}' },
  heldReturned: { en: 'paid back {date}', es: 'devuelto el {date}' },
  heldOn: { en: 'comes back {date}', es: 'se devuelve el {date}' },
  heldAfter: {
    en: 'comes back after {gc} accepts your work and the owner pays {gc}',
    es: 'se devuelve después de que {gc} acepte su trabajo y el dueño le pague a {gc}',
  },
  jobPayLine: { en: 'contract {contract} · paid {paid} · left to bill {left}', es: 'contrato {contract} · pagado {paid} · por facturar {left}' },
  noPayYet: { en: 'No pay applications yet.', es: 'Todavía no hay solicitudes de pago.' },

  // The weekly look-ahead
  lookTitle: { en: 'Your next three weeks', es: 'Sus próximas tres semanas' },
  lookIntro: {
    en: '{gc} plans these from the schedule. At the end of each week, mark each one done or not done.',
    es: '{gc} las planea con el calendario de obra. Al final de cada semana, marque cada una como hecha o no hecha.',
  },
  weekLast: { en: 'Last week · {date}', es: 'Semana pasada · {date}' },
  weekThis: { en: 'This week · {date}', es: 'Esta semana · {date}' },
  weekNext: { en: 'Next week · {date}', es: 'La próxima semana · {date}' },
  weekLater: { en: 'Week of {date}', es: 'Semana del {date}' },
  planned: { en: 'planned {start} to {finish}', es: 'planeado del {start} al {finish}' },
  markDone: { en: 'Done', es: 'Hecho' },
  markNotDone: { en: 'Not done', es: 'No hecho' },
  whyNot: { en: 'Why not?', es: '¿Por qué no?' },
  sendMark: { en: 'Send', es: 'Enviar' },
  changeMark: { en: 'Change', es: 'Cambiar' },
  youMarkedDone: { en: 'you marked it done · {gc} will check', es: 'lo marcó como hecho · {gc} lo revisará' },
  youMarkedNot: { en: 'you marked it not done: {reason} · {gc} will check', es: 'lo marcó como no hecho: {reason} · {gc} lo revisará' },
  checkedDone: { en: '{gc} checked: done', es: '{gc} revisó: hecho' },
  checkedNot: { en: '{gc} checked: not done', es: '{gc} revisó: no hecho' },
  checkedNotWhy: { en: '{gc} checked: not done, {reason}', es: '{gc} revisó: no hecho, {reason}' },
  checkedDiffers: { en: 'You had marked it {mark}.', es: 'Usted lo había marcado como {mark}.' },
  markWordDone: { en: 'done', es: 'hecho' },
  markWordNot: { en: 'not done', es: 'no hecho' },
  nothingThisWeek: { en: 'Nothing planned for you this week.', es: 'No hay nada planeado para usted esta semana.' },
  reasonWeather: { en: 'weather', es: 'clima' },
  reasonTradeBefore: { en: 'the trade before', es: 'el oficio anterior' },
  reasonMaterials: { en: 'materials', es: 'materiales' },
  reasonCrew: { en: 'crew', es: 'personal' },
  reasonOther: { en: 'other', es: 'otro' },

  // Their messages
  messagesIntro: { en: 'What {gc} sent {company}, newest first. Every message carries the same link.', es: 'Lo que {gc} envió a {company}, lo más reciente primero. Cada mensaje lleva el mismo enlace.' },
  nothingSent: { en: 'Nothing sent yet.', es: 'Todavía no se ha enviado nada.' },
  toLine: { en: 'To {contact}, {company}', es: 'Para {contact}, {company}' },
  openPortal: { en: 'Open your portal', es: 'Abrir su portal' },
  linkYours: { en: 'This link is yours. It holds every job you have with us. There is no password.', es: 'Este enlace es suyo. Aquí están todos sus trabajos con nosotros. No hay contraseña.' },
  thanks: { en: 'Thank you,', es: 'Gracias,' },
  byText: { en: 'The same, by text', es: 'Lo mismo, por mensaje de texto' },
  mHello: { en: 'Hello {first},', es: 'Hola {first}:' },
  mInviteSubject: { en: '{gc} asks you to bid {trade} on {project}', es: '{gc} lo invita a cotizar {trade} en {project}' },
  mInviteWant: { en: 'We would like your number for {trade} on {project}.', es: 'Nos gustaría recibir su precio de {trade} para {project}.' },
  mInviteDue: { en: 'Your number is due {date}.', es: 'Su precio vence el {date}.' },
  mInvitePlans: { en: 'Plans to price: {label}, issued {date}.', es: 'Planos para cotizar: {label}, emitidos el {date}.' },
  mInviteCover: { en: 'Your number should cover these lines.', es: 'Su precio debe incluir estas partidas.' },
  mInviteText: { en: '{gc}: we would like your {trade} number for {project}{by}. Plans and details: {link}', es: '{gc}: nos gustaría su precio de {trade} para {project}{by}. Planos y detalles: {link}' },
  mBy: { en: ' by {date}', es: ' a más tardar el {date}' },
  mNudgeSubject: { en: 'A reminder: {about}', es: 'Recordatorio: {about}' },
  mNudgeAbout: { en: 'A reminder about your {trade} number for {project}.', es: 'Le recordamos su precio de {trade} para {project}.' },
  mNudgeDue: { en: 'It is due {date}.', es: 'Vence el {date}.' },
  mNudgeOpen: { en: 'Open your portal to send it. Not ready? Tell us the day it will come.', es: 'Abra su portal para enviarlo. ¿No está listo? Díganos qué día llegará.' },
  mTabSubject: { en: 'How the {trade} quotes came in on {project}', es: 'Cómo llegaron las cotizaciones de {trade} en {project}' },
  mTabThanks: { en: 'Thank you for your number. We share every bid tab with the companies that quoted.', es: 'Gracias por su precio. Compartimos cada tabla de precios con las empresas que cotizaron.' },
  mTabOpen: { en: 'Open your portal to see where you stood.', es: 'Abra su portal para ver en qué lugar quedó.' },
  mPlansSubject: { en: '{label} for {project}', es: '{label} de {project}' },
  mPlansOut: { en: '{label} for {project} is out. {note}', es: 'Ya salió {label} de {project}. {note}' },
  mPlansChanges: { en: 'It changes {trades}. Open it, then confirm your number or change it.', es: 'Cambia {trades}. Ábralo y luego confirme su precio o cámbielo.' },
  mPlansNoChange: { en: 'It does not change {trades}. Open it so you price on the newest set.', es: 'No cambia {trades}. Ábralo para cotizar con el juego más reciente.' },
  mMsaSubject: { en: 'Your master agreement with {gc}', es: 'Su contrato maestro con {gc}' },
  mMsaHere: { en: 'Here is our master agreement. You sign it once, and it covers every job you do for us.', es: 'Aquí está nuestro contrato maestro. Se firma una sola vez y cubre todos los trabajos que haga para nosotros.' },
  mMsaAfter: { en: 'After that, each job is a short statement of work.', es: 'Después, cada trabajo es una orden de trabajo corta.' },
  mMsaOpen: { en: 'Open your portal to read it and sign it.', es: 'Abra su portal para leerlo y firmarlo.' },
  mSowSubject: { en: 'Your statement of work for {trade} on {project}', es: 'Su orden de trabajo de {trade} para {project}' },
  mSowPicked: { en: 'We picked your number for {trade} on {project}. Thank you.', es: 'Elegimos su precio de {trade} para {project}. Gracias.' },
  mSowReady: { en: 'Your statement of work is ready: {price}, based on the {plans}.', es: 'Su orden de trabajo está lista: {price}, con base en {plans}.' },
  mSowHold: { en: 'We hold back {pct}% of each draw until the job is done.', es: 'Retenemos el {pct}% de cada pago hasta que termine el trabajo.' },
  mSowOpen: { en: 'Open your portal to read it and sign it.', es: 'Abra su portal para leerla y firmarla.' },
  mStartSubject: { en: 'Work starts on {project} {date}', es: 'El trabajo en {project} empieza el {date}' },
  mStartSubjectNoDate: { en: '{project} is started', es: '{project} ya empezó' },
  mStartBegins: { en: '{project} is started. Work begins {date}.', es: '{project} ya empezó. El trabajo comienza el {date}.' },
  mStartNoDate: { en: '{project} is started.', es: '{project} ya empezó.' },
  mStartPart: { en: 'Your part is {trades}.', es: 'Su parte es {trades}.' },
  mStartReport: { en: 'Report your work in your portal as it goes. That is how you ask for each draw.', es: 'Reporte su avance en su portal conforme avance. Así pide cada pago.' },
  mStartText: { en: '{gc}: work on {project} begins{when}. Your part is {trades}. Details: {link}', es: '{gc}: el trabajo en {project} comienza{when}. Su parte es {trades}. Detalles: {link}' },
  mWhen: { en: ' {date}', es: ' el {date}' },
  mChangeSubject: { en: 'Change order {n} on {project}', es: 'Orden de cambio {n} de {project}' },
  mChangeWhat: { en: 'We have a change to your {trade} work on {project}: {description}.', es: 'Tenemos un cambio en su trabajo de {trade} en {project}: {description}.' },
  mChangeAdds: { en: 'It adds {amount} to your statement of work.', es: 'Suma {amount} a su orden de trabajo.' },
  mChangeTakes: { en: 'It takes off {amount} from your statement of work.', es: 'Resta {amount} de su orden de trabajo.' },
  mChangeOpen: { en: 'Open your portal to read it and sign it.', es: 'Abra su portal para leerla y firmarla.' },
  mPaidSubject: { en: 'Pay application {n} on {project} is paid', es: 'La solicitud de pago {n} de {project} está pagada' },
  mPaidFinalSubject: { en: 'Your retainage on {project} is paid', es: 'Su retención de {project} está pagada' },
  mPaidWhat: { en: 'We paid {amount} for pay application {n} on {trade} for {project}.', es: 'Pagamos {amount} por la solicitud de pago {n} de {trade} para {project}.' },
  mPaidFinalWhat: { en: 'We paid back the {amount} we held on {trade} for {project}.', es: 'Le devolvimos los {amount} que retuvimos de {trade} en {project}.' },
  mPaidHeld: { en: 'We hold {amount} of it until the job is done.', es: 'Retenemos {amount} hasta que termine el trabajo.' },
  mPaidWaiver: { en: 'Sign the unconditional waiver for it in your portal.', es: 'Firme la renuncia incondicional en su portal.' },
  mPaidFinalWaiver: { en: 'Sign your unconditional final release of lien in your portal.', es: 'Firme su liberación final de gravamen incondicional en su portal.' },
  mLessSubject: { en: 'Pay application {n} on {project}: approved for less', es: 'Solicitud de pago {n} de {project}: aprobada por menos' },
  mLessApproved: {
    en: 'We approved {approved} of the {asked} you asked for on pay application {n} for {trade} on {project}.',
    es: 'Aprobamos {approved} de los {asked} que pidió en la solicitud de pago {n} de {trade} para {project}.',
  },
  mLessRest: { en: 'The rest is still yours to ask for once the work is there.', es: 'El resto lo puede pedir cuando el trabajo esté hecho.' },
  mSoon: { en: ' soon', es: ' pronto' },

  // Needs you
  todoMsaWaits: { en: 'Read and sign the master agreement. Your statement of work waits on it.', es: 'Lea y firme el contrato maestro. Su orden de trabajo depende de eso.' },
  todoMsa: { en: 'Read and sign the master agreement.', es: 'Lea y firme el contrato maestro.' },
  todoCoiRanOut: { en: 'Your insurance ran out {date}. Send a new certificate.', es: 'Su seguro venció el {date}. Envíe un certificado nuevo.' },
  todoCoi: { en: 'Send your insurance certificate.', es: 'Envíe su certificado de seguro.' },
  todoW9: { en: 'Fill in your W-9.', es: 'Llene su W-9.' },
  todoStale: { en: 'The plans changed for {trade} on {project}. Confirm your number or change it.', es: 'Cambiaron los planos de {trade} en {project}. Confirme su precio o cámbielo.' },
  todoUnclear1: { en: 'Answer one line of your {trade} number for {project}.', es: 'Conteste una partida de su precio de {trade} para {project}.' },
  todoUnclearN: { en: 'Answer {n} lines of your {trade} number for {project}.', es: 'Conteste {n} partidas de su precio de {trade} para {project}.' },
  todoRanOut: { en: 'Your {trade} number for {project} ran out {date}. Send it again to keep it good.', es: 'Su precio de {trade} para {project} venció el {date}. Envíelo de nuevo para que siga válido.' },
  todoLate: { en: 'You said your {trade} number for {project} would come {date}. Send it or give a new day.', es: 'Usted dijo que su precio de {trade} para {project} llegaría el {date}. Envíelo o dé un nuevo día.' },
  todoWasDue: { en: 'Your {trade} number for {project} was due {date}.', es: 'Su precio de {trade} para {project} venció el {date}.' },
  todoSend: { en: 'Send your {trade} number for {project} by {date}.', es: 'Envíe su precio de {trade} para {project} a más tardar el {date}.' },
  todoOpenSend: { en: 'Open the plans and send your {trade} number for {project} by {date}.', es: 'Abra los planos y envíe su precio de {trade} para {project} a más tardar el {date}.' },
  todoOpenSet: { en: 'Open {label} on {project}. It does not change {trade}.', es: 'Abra {label} de {project}. No cambia {trade}.' },
  todoTab: { en: 'See how the {trade} quotes came in on {project}.', es: 'Vea cómo llegaron las cotizaciones de {trade} en {project}.' },
  todoSow: { en: 'Sign your {trade} statement of work for {project}.', es: 'Firme su orden de trabajo de {trade} para {project}.' },
  todoWaiver: { en: 'Draw {n} on {project} is paid. Sign the unconditional waiver.', es: 'El pago {n} de {project} ya se pagó. Firme la renuncia incondicional.' },
  todoBack: { en: '{gc} sent pay application {n} on {project} back. Fix it and send it again.', es: '{gc} le devolvió la solicitud de pago {n} de {project}. Corríjala y envíela de nuevo.' },
  todoFinal: {
    en: 'Send your final pay application for {project}. It asks for the {amount} {gc} holds, with your conditional final release of lien.',
    es: 'Envíe su solicitud de pago final de {project}. Pide los {amount} que {gc} retiene, con su liberación final de gravamen condicional.',
  },
  todoFinalWaiver: { en: 'Your retainage on {project} is paid. Sign your unconditional final release of lien.', es: 'Su retención de {project} ya se pagó. Firme su liberación final de gravamen incondicional.' },
  todoDraw: { en: 'You can ask {gc} for {amount} on {project}.', es: 'Puede pedirle a {gc} {amount} de {project}.' },
  todoChangeAdds: { en: 'Sign change order {n} on {project}. It adds {amount}.', es: 'Firme la orden de cambio {n} de {project}. Suma {amount}.' },
  todoChangeTakes: { en: 'Sign change order {n} on {project}. It takes off {amount}.', es: 'Firme la orden de cambio {n} de {project}. Resta {amount}.' },
  todoLookWeek: { en: "Mark this week's work on {project}: {n} to mark.", es: 'Marque el trabajo de esta semana en {project}: {n} por marcar.' },
  todoLookLate: { en: "Mark last week's work on {project}: {n} still to mark.", es: 'Marque el trabajo de la semana pasada en {project}: faltan {n}.' },
  todoLess: {
    en: '{gc} approved {approved} of the {asked} you asked for on {project}. The rest is still yours to ask for.',
    es: '{gc} aprobó {approved} de los {asked} que pidió en {project}. El resto lo puede seguir pidiendo.',
  },

  // The day a company promised
  promisePending: { en: 'You told {gc} your number will come by {date}.', es: 'Le dijo a {gc} que su precio llegaría a más tardar el {date}.' },
  promiseToday: { en: 'You told {gc} your number will come today.', es: 'Le dijo a {gc} que su precio llegaría hoy.' },
  promiseLate: {
    en: 'You told {gc} your number would come by {date}. That day passed {ago}. Send your number or give a new day.',
    es: 'Le dijo a {gc} que su precio llegaría a más tardar el {date}. Esa fecha pasó {ago}. Envíe su precio o dé un nuevo día.',
  },
  agoYesterday: { en: 'yesterday', es: 'ayer' },
  agoN: { en: '{n} days ago', es: 'hace {n} días' },
} satisfies Record<string, Record<PortalLang, string>>

export type PortalKey = keyof typeof S

/** Every key, for the test that checks both languages carry the same blanks. */
export const PORTAL_KEYS = Object.keys(S) as PortalKey[]

/** One portal string in a language, its {blanks} filled. */
export function pt(lang: PortalLang, key: PortalKey, vars?: Record<string, string | number>): string {
  let out: string = S[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/** The raw text of a key in both languages, for the test. */
export function portalString(key: PortalKey): Record<PortalLang, string> {
  return S[key]
}

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

const DISCIPLINES_ES: Record<string, string> = {
  General: 'General',
  Civil: 'Civil',
  Architectural: 'Arquitectónico',
  Interiors: 'Interiores',
  Structural: 'Estructural',
  Mechanical: 'Mecánico',
  Electrical: 'Eléctrico',
  Plumbing: 'Plomería',
  'Fire protection': 'Protección contra incendios',
  Landscape: 'Paisaje',
  Technology: 'Tecnología',
  Other: 'Otras',
}

/** A drawing discipline's name ("Mechanical" / "Mecánico"). */
export function pDiscipline(lang: PortalLang, discipline: string): string {
  return lang === 'es' ? (DISCIPLINES_ES[discipline] ?? discipline) : discipline
}
