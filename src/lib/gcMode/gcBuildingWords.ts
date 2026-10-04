/**
 * GC mode — design spike: the pay application door and window in the trade's portal, in English
 * and Spanish (Building lane, 2026-10-03). The Spanish is the Portal lane's
 * (to-dos/gc-mode/PORTAL_SPANISH.md): formal usted, the portal's own words for the same things
 * (solicitud de pago, pago, retención, orden de cambio). The G702 and G703 follow the portal too
 * (owner, 2026-10-03: translate the forms as well); the office's copy is always English.
 *
 * English is the words the door had before Spanish, kept exactly. Import from `./gcModel`.
 */
import type { PortalLang } from './gcPortalI18n'

const W = {
  // The door: a change order to sign
  changeTo: { en: 'Change order {n} to your statement of work.', es: 'Orden de cambio {n} a su orden de trabajo.' },
  changeAdds: { en: 'It adds {amount}.', es: 'Suma {amount}.' },
  changeTakes: { en: 'It takes {amount} off.', es: 'Resta {amount}.' },
  changeTime: { en: 'Time: {schedule}.', es: 'Tiempo: {schedule}.' },
  signChange: { en: 'Sign the change', es: 'Firmar el cambio' },
  signMsaFirst: { en: 'Sign the master agreement first.', es: 'Primero firme el contrato maestro.' },

  // The door: asking for a draw
  withGc: { en: 'Pay application {n} is with {gc}. They are checking it.', es: 'La solicitud de pago {n} está con {gc}. La están revisando.' },
  seePayApp: { en: 'See pay application {n}', es: 'Ver la solicitud de pago {n}' },
  sentBackHead: { en: '{gc} sent pay application {n} back {date}.', es: '{gc} le devolvió la solicitud de pago {n} el {date}.' },
  fixIt: { en: 'Fix it and send it again.', es: 'Corríjala y envíela de nuevo.' },
  seesLine: { en: '{line}: {gc} sees {n}%. You asked for {m}%.', es: '{line}: {gc} ve {n}%. Usted pidió {m}%.' },
  goOn: { en: 'Go on with pay application {n}', es: 'Seguir con la solicitud de pago {n}' },
  // Short in Spanish: the long form is too wide for a button on a phone (Portal lane, 2026-10-03).
  fixResend: { en: 'Fix and resend pay application {n}', es: 'Corregir y reenviar la solicitud {n}' },
  fillOut: { en: 'Fill out pay application {n}', es: 'Llenar la solicitud de pago {n}' },
  lessNote: {
    en: '{gc} approved {x} of the {y} you asked for on pay application {n}. {note} The rest is still yours to ask for.',
    es: '{gc} aprobó {x} de los {y} que pidió en la solicitud de pago {n}. {note} El resto lo puede seguir pidiendo.',
  },
  canAsk: {
    en: 'You can ask for {amount} now. Most of the pay application is filled in for you.',
    es: 'Puede pedir {amount} ahora. La mayor parte de la solicitud de pago ya está llena.',
  },
  reportFirst: {
    en: 'Report your work above. Then fill out the pay application to ask for a draw.',
    es: 'Reporte su avance arriba. Luego llene la solicitud de pago para pedir un pago.',
  },

  // The door once every line is billed: the trade's closeout
  closedOut: { en: 'You are closed out on this job.', es: 'Su cierre en este trabajo está completo.' },
  paidBackThanks: { en: '{gc} paid back the {amount} it held. Thank you.', es: '{gc} le devolvió los {amount} que retuvo. Gracias.' },
  closeoutHead: { en: 'Closeout.', es: 'Cierre.' },
  allBilled: {
    en: 'All your work is billed. {gc} holds {amount} until the end. That is your retainage.',
    es: 'Todo su trabajo está facturado. {gc} retiene {amount} hasta el final. Esa es su retención.',
  },
  finalSentBack: { en: '{gc} sent your final pay application back {date}.', es: '{gc} le devolvió su solicitud de pago final el {date}.' },
  accepted: { en: '{gc} accepted your work {date}.', es: '{gc} aceptó su trabajo el {date}.' },
  walks: { en: '{gc} walks the work with you and checks the punch list.', es: '{gc} revisa el trabajo con usted y la lista de pendientes.' },
  finalWith: { en: 'Your final pay application is with {gc}.', es: 'Su solicitud de pago final está con {gc}.' },
  askFinal: { en: 'Ask for the {amount} with a final pay application.', es: 'Pida los {amount} con una solicitud de pago final.' },
  seeIt: { en: 'See it', es: 'Verla' },
  fillFinal: { en: 'Fill out the final pay application', es: 'Llenar la solicitud de pago final' },
  opensWhen: { en: 'It opens once {gc} accepts your work.', es: 'Se abre cuando {gc} acepte su trabajo.' },
  retPaid: { en: '{gc} paid your retainage.', es: '{gc} le pagó su retención.' },
  retApproved: { en: '{gc} approved it. Payment is coming.', es: '{gc} la aprobó. El pago viene en camino.' },
  retOn: {
    en: '{gc} pays your retainage {date}, {days} days after the customer paid {gc}.',
    es: '{gc} le paga su retención el {date}, {days} días después de que el cliente le pagó a {gc}.',
  },
  retAfter: {
    en: '{gc} pays your retainage {days} days after the customer pays {gc} its own.',
    es: '{gc} le paga su retención {days} días después de que el cliente le pague a {gc} la suya.',
  },
  signFinalBelow: { en: 'Sign the unconditional final release of lien below.', es: 'Firme abajo su liberación final de gravamen incondicional.' },
  signFinalLast: { en: 'Last, you sign the unconditional final release of lien.', es: 'Al final, firme su liberación final de gravamen incondicional.' },

  // The window's head and a sent application
  title: { en: 'Pay application {n}', es: 'Solicitud de pago {n}' },
  titleFinal: { en: 'Final pay application {n}', es: 'Solicitud de pago final {n}' },
  stampBack: { en: ' · sent back', es: ' · devuelta' },
  stampRevised: { en: ' · revised', es: ' · corregida' },
  subtitle: { en: '{trade} · {company} · {project} · the 702 and 703 forms', es: '{trade} · {company} · {project} · los formularios 702 y 703' },
  close: { en: 'Close', es: 'Cerrar' },
  youSent: { en: 'You sent this {date}.', es: 'Usted la envió el {date}.' },
  signedIt: { en: '{name} signed it with a {waiver} for {amount}.', es: '{name} la firmó con una {waiver} por {amount}.' },
  waiverProgress: { en: 'conditional lien waiver', es: 'renuncia condicional' },
  waiverFinal: { en: 'conditional final release of lien', es: 'liberación final de gravamen condicional' },
  beforePayApps: {
    en: 'This draw was asked for before pay applications. The form is rebuilt from the draw.',
    es: 'Este pago se pidió antes de las solicitudes de pago. El formulario se rehízo a partir del pago.',
  },
  approvedLess: { en: '{gc} approved {x} of the {y} asked.', es: '{gc} aprobó {x} de los {y} que se pidieron.' },
  sentItBack: { en: '{gc} sent it back {date}.', es: '{gc} la devolvió el {date}.' },

  // The four steps
  stepWork: { en: 'Check your work', es: 'Revise su avance' },
  stepWorkFinal: { en: 'Check it is all done', es: 'Revise que todo esté terminado' },
  stepDetails: { en: 'Fill in a few details', es: 'Llene unos datos' },
  stepSign: { en: 'Sign it', es: 'Fírmela' },
  stepSend: { en: 'Send it to {gc}', es: 'Envíela a {gc}' },
  stepDone: { en: 'Done', es: 'Listo' },
  stepNow: { en: 'You are here', es: 'Está aquí' },
  stepWaiting: { en: 'Waiting', es: 'En espera' },
  sayFinal: {
    en: 'Every line is billed at 100%. This application asks for the retainage.',
    es: 'Todas las partidas están facturadas al 100%. Esta solicitud pide la retención.',
  },
  saySentBack: {
    en: '{gc} sent this back. Its numbers are in where it sees less. Change a line if you see it differently.',
    es: '{gc} la devolvió. Sus números están donde ve menos avance. Cambie una partida si usted lo ve distinto.',
  },
  sayStarts: { en: 'Each line starts at what you reported. Change a line if it moved.', es: 'Cada partida empieza con lo que usted reportó. Cámbiela si avanzó.' },
  sayNothing: { en: 'Nothing new to bill yet. Raise a line that moved.', es: 'Todavía no hay nada nuevo que facturar. Suba una partida que haya avanzado.' },
  billed100: { en: '100% billed', es: '100% facturado' },
  retHeld: { en: 'Retainage held:', es: 'Retención:' },
  paidThrough: { en: ' · paid through {n}%', es: ' · pagado hasta {n}%' },
  gcSees: { en: ' · {gc} sees {n}%', es: ' · {gc} ve {n}%' },
  pctDone: { en: '{n}% done', es: '{n}% terminado' },
  pctAria: { en: 'Percent done, {line}', es: 'Porcentaje terminado, {line}' },
  workPeriod: { en: 'Work this period:', es: 'Trabajo de este periodo:' },
  sayDetails: {
    en: 'Pick the last day this draw covers. Your address goes on the form.',
    es: 'Elija el último día que cubre este pago. Su dirección va en el formulario.',
  },
  periodEnds: { en: 'Period ends', es: 'Fin del periodo' },
  address: { en: 'Your mailing address', es: 'Su dirección postal' },
  onFile: { en: 'On file from your last one.', es: 'En archivo de la anterior.' },
  keepIt: { en: 'We keep it for next time.', es: 'Lo guardamos para la próxima vez.' },
  addressHint: { en: 'Street, city, state, zip', es: 'Calle, ciudad, estado, código postal' },
  license: { en: 'License line', es: 'Licencia' },
  licenseNote: { en: 'If your trade needs one.', es: 'Si su especialidad la necesita.' },
  saySign: { en: 'Type your name and title. Then tick the waiver box.', es: 'Escriba su nombre y su puesto. Luego marque la casilla de la renuncia.' },
  yourName: { en: 'Your name', es: 'Su nombre' },
  yourTitle: { en: 'Your title', es: 'Su puesto' },
  titleHint: { en: 'Owner, office manager', es: 'Dueño, gerente de oficina' },
  iSign: { en: 'I sign the {waiver} for {amount}.', es: 'Firmo la {waiver} por {amount}.' },
  opensAfter: { en: 'Opens when 1 to 3 are done', es: 'Se abre cuando los pasos 1 a 3 estén listos' },
  saySendFinal: { en: '{gc} checks it and pays back the retainage.', es: '{gc} la revisa y le devuelve la retención.' },
  saySend: { en: '{gc} checks it and pays the draw.', es: '{gc} la revisa y le paga.' },
  askAllHeld: { en: 'You ask for {amount}. That is everything {gc} held back.', es: 'Usted pide {amount}. Es todo lo que {gc} retuvo.' },
  askHolds: { en: 'You ask for {amount}. {gc} holds {pct}% of the work until the end.', es: 'Usted pide {amount}. {gc} retiene el {pct}% del trabajo hasta el final.' },
  sendTo: { en: 'Send to {gc}', es: 'Enviar a {gc}' },
  theForm: { en: 'The form', es: 'El formulario' },
  fillsIn: { en: 'it fills in as you work', es: 'se llena mientras usted trabaja' },
  onStep: { en: 'You are on step {n} of 4 · {step}', es: 'Está en el paso {n} de 4 · {step}' },
  allDone: { en: 'All four steps done', es: 'Los cuatro pasos están listos' },

  // The tags on the form: which step fills which part
  markWork: { en: '1 · Your work', es: '1 · Su avance' },
  markDetails: { en: '2 · Your details', es: '2 · Sus datos' },
  markSign: { en: '3 · You sign here', es: '3 · Firme aquí' },
  markSend: { en: '4 · What you ask for', es: '4 · Lo que pide' },

  // The paper: the G702
  page702: { en: 'Page 1 · 702', es: 'Página 1 · 702' },
  page703: { en: 'Page 2 · 703', es: 'Página 2 · 703' },
  g702Title: { en: 'Application and certificate for payment', es: 'Solicitud y certificado de pago' },
  g702Sub: { en: 'AIA G702 · page 1 of 2', es: 'AIA G702 · página 1 de 2' },
  g702Final: { en: ' · final, retainage release', es: ' · final, liberación de la retención' },
  boxTo: { en: 'To', es: 'Para' },
  boxFrom: { en: 'From', es: 'De' },
  boxContractFor: { en: 'Contract for', es: 'Contrato de' },
  boxProject: { en: 'Project', es: 'Proyecto' },
  boxArchitect: { en: 'Via architect', es: 'Por medio del arquitecto' },
  boxAppNo: { en: 'Application no.', es: 'Solicitud n.º' },
  boxPeriodTo: { en: 'Period to', es: 'Periodo hasta' },
  boxContractDate: { en: 'Contract date', es: 'Fecha del contrato' },
  appForPayment: { en: 'Application for payment', es: 'Solicitud de pago' },
  line1: { en: 'Original contract sum', es: 'Suma original del contrato' },
  line2: { en: 'Net change by change orders', es: 'Cambio neto por órdenes de cambio' },
  line3: { en: 'Contract sum to date', es: 'Suma del contrato a la fecha' },
  line4: { en: 'Total completed and stored to date, from the 703', es: 'Total terminado y almacenado a la fecha, del 703' },
  line5: { en: 'Retainage, {pct}% of completed work', es: 'Retención, {pct}% del trabajo terminado' },
  line5Final: { en: 'Retainage, released on this final application', es: 'Retención, liberada en esta solicitud final' },
  line6: { en: 'Total earned less retainage', es: 'Total ganado menos la retención' },
  line7: { en: 'Less previous certificates for payment', es: 'Menos los certificados de pago anteriores' },
  line8: { en: 'Current payment due', es: 'Pago actual adeudado' },
  line9: { en: 'Balance to finish, including retainage', es: 'Saldo por terminar, incluida la retención' },
  coNone: { en: 'Change orders: none on this contract', es: 'Órdenes de cambio: ninguna en este contrato' },
  coSome: { en: 'Change orders: {n} signed, {amount} in all', es: 'Órdenes de cambio: {n} firmadas, {amount} en total' },
  certifies: {
    en: 'The undersigned certifies that the work covered by this application is done as shown. Everyone owed for earlier payments has been paid. The current payment shown is now due. A {waiver} for {amount} is signed with it.',
    es: 'El abajo firmante certifica que el trabajo de esta solicitud está hecho como se muestra. A todos los que se les debía por pagos anteriores ya se les pagó. El pago actual que se muestra ya vence. Con ella se firma una {waiver} por {amount}.',
  },
  boxTitle: { en: 'Title', es: 'Puesto' },
  boxDate: { en: 'Date', es: 'Fecha' },
  today: { en: 'today', es: 'hoy' },
  byFor: { en: 'By {name} for {company}', es: 'Por {name} para {company}' },
  certificate: { en: 'Certificate for payment · {gc} fills this in', es: 'Certificado de pago · {gc} lo llena' },
  boxCertified: { en: 'Amount certified', es: 'Monto certificado' },
  boxBy: { en: 'By', es: 'Por' },

  // The paper: the G703
  g703Title: { en: 'Continuation sheet', es: 'Hoja de continuación' },
  g703Sub: { en: 'AIA G703 · page 2 of 2', es: 'AIA G703 · página 2 de 2' },
  colItem: { en: 'Item', es: 'Partida' },
  colWork: { en: 'Work', es: 'Trabajo' },
  colScheduled: { en: 'Scheduled value', es: 'Valor programado' },
  colPrevious: { en: 'Previous', es: 'Anterior' },
  colThisPeriod: { en: 'This period', es: 'Este periodo' },
  colStored: { en: 'Stored', es: 'Almacenado' },
  colToDate: { en: 'Done to date', es: 'Terminado a la fecha' },
  colBalance: { en: 'Balance', es: 'Saldo' },
  colRetainage: { en: 'Retainage', es: 'Retención' },
  grandTotal: { en: 'Grand total', es: 'Total general' },

  // The punch list in the trade's portal (2026-10-03)
  punchHead: { en: 'Punch list from {gc}', es: 'Lista de pendientes de {gc}' },
  punchToFix: { en: '{n} to fix', es: '{n} por arreglar' },
  punchFixedBtn: { en: 'It is fixed', es: 'Ya está arreglado' },
  punchWaiting: { en: 'Waiting on {gc} to check it.', es: 'Esperando que {gc} lo revise.' },
  punchBack: { en: '{gc} checked it {date}. It is not fixed yet.', es: '{gc} lo revisó el {date}. Todavía no está arreglado.' },
  punchChecked: { en: 'Checked by {gc}: {n}.', es: 'Revisados por {gc}: {n}.' },
  // Materials stored on site, on the pay application (2026-10-04, question 12)
  storedToggle: { en: 'Materials stored on site, not yet in place', es: 'Materiales guardados en la obra, aún sin instalar' },
  storedNote: {
    en: 'In dollars, what is on site now. Once it is in place, raise the line and take it off here.',
    es: 'En dólares, lo que hay en la obra hoy. Cuando quede instalado, suba la partida y quítelo de aquí.',
  },
  storedAria: { en: 'Stored on site, {line}', es: 'Guardado en la obra, {line}' },
  storedTotal: { en: 'Stored on site:', es: 'Guardado en la obra:' },
  // Submittals in the trade's portal (2026-10-04)
  subHead: { en: 'Submittals {gc} needs from you', es: 'Documentos para aprobación que {gc} necesita de usted' },
  subNeeded: { en: 'Needed by {date}.', es: 'Se necesita para el {date}.' },
  subLate: { en: '{n} days late.', es: '{n} días de retraso.' },
  subBack: { en: 'The architect sent it back {date}.', es: 'El arquitecto lo devolvió el {date}.' },
  subFile: { en: 'The file you send', es: 'El archivo que envía' },
  subNote: { en: 'A note for {gc}', es: 'Una nota para {gc}' },
  subSend: { en: 'Send it', es: 'Enviarlo' },
  subWithUs: { en: 'With {gc}, sent {date}.', es: 'Con {gc}, enviado el {date}.' },
  subWithArchitect: { en: 'With the architect since {date}.', es: 'Con el arquitecto desde el {date}.' },
  subApproved: { en: 'Approved: {n}.', es: 'Aprobados: {n}.' },
  subKindProduct: { en: 'product data', es: 'datos del producto' },
  subKindShop: { en: 'shop drawings', es: 'planos de taller' },
  subKindSamples: { en: 'samples', es: 'muestras' },
  inspFailed: { en: '{label} failed on your work {date}.', es: '{label} no pasó en su trabajo el {date}.' },
  inspAgain: { en: 'The re-inspection is {date}. Fix it before then.', es: 'La reinspección es el {date}. Arréglelo antes de esa fecha.' },
  punchWhy: {
    en: 'Fix each one, then tell {gc} here. {gc} checks it on the job. Your work is accepted once every item is checked.',
    es: 'Arregle cada uno y avísele a {gc} aquí. {gc} lo revisa en la obra. Su trabajo se acepta cuando todos estén revisados.',
  },
  // The pay application as a file (2026-10-04, question 12): the AIA form, in English
  fileExcel: { en: '⤓ Excel', es: '⤓ Excel' },
  filePdf: { en: '⤓ PDF', es: '⤓ PDF' },
  fileExcelTitle: { en: 'The AIA form in Excel, with every line', es: 'El formulario AIA en Excel, con cada partida' },
  filePdfTitle: { en: 'The 702 and 703 as a PDF, with the notary block', es: 'El 702 y el 703 en PDF, con el bloque del notario' },
  fileMaking: { en: 'Making it…', es: 'Preparándolo…' },
  fileFailed: { en: 'The file could not be made.', es: 'No se pudo preparar el archivo.' },
  fileEnglish: { en: 'The file is the AIA form, in English.', es: 'El archivo es el formulario AIA, en inglés.' },
} satisfies Record<string, Record<PortalLang, string>>

export type BuildingWordKey = keyof typeof W

/** Every key, for the test that checks both languages carry the same blanks. */
export const BUILDING_WORD_KEYS = Object.keys(W) as BuildingWordKey[]

/** One pay application string in a language, its {blanks} filled. A blank not given stays, to be drawn in its place. */
export function bw(lang: PortalLang, key: BuildingWordKey, vars?: Record<string, string | number>): string {
  let out: string = W[key][lang]
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

/** The raw text of a key in both languages, for the test. */
export function buildingWord(key: BuildingWordKey): Record<PortalLang, string> {
  return W[key]
}
