/**
 * "How do I get paid?" — the sub portal's help guide (v2.2922). Bottom line
 * first, then the four steps of the sub's money with the same dots the job
 * cards use, the one button, new work offers, documents, deductions and what
 * is coming. Every line has an en/es pair; the page's own language toggle
 * picks. Pure content: no React.
 */
import type { SubPortalLang } from './subPortalI18n'

export type GuideStep = {
  title: string
  /** The sentence the job card shows at this step. */
  quote: string
  /** Label → text pairs: You / Us / Sometimes … */
  facts: Array<{ who: string; text: string }>
  /** Short line for the walking-dot caption. */
  caption: string
  /** Optional green time chip. */
  time?: string
}

export type GuideContent = {
  button: { title: string; sub: string }
  header: string
  bluf: string
  answer: string
  answerNote: string
  steps: [GuideStep, GuideStep, GuideStep, GuideStep]
  oneButton: { title: string; sub: string; body: string; demoTitle: string; demoConfirm: string; note: string }
  offers: { title: string; sub: string; body: string }
  documents: { title: string; sub: string; body: string; currentTitle: string; currentBody: string; lapsedTitle: string; lapsedBody: string; lapsedButton: string }
  deductions: { title: string; sub: string; body: string }
  comingSoon: { title: string; sub: string; tag: string; items: Array<{ title: string; body: string }> }
  plansPill: string
  plansCaption: string
  footerCall: string
  close: string
}

const EN: GuideContent = {
  button: { title: 'How do I get paid?', sub: 'How this page works · 2 min' },
  header: 'How this page works',
  bluf: 'How do I get paid?',
  answer:
    "Do the work and tap ✓ My work here is done. We call it in for inspection. Once it passes, we can trigger a draw from the customer. When their money hits us, if your documents are current with us, it hits you the same day. Every job card shows which step it's on.",
  answerNote: "A document missing or expired is the one thing that slows this down. The bottom of the page shows what's current and what isn't.",
  steps: [
    {
      title: 'Work',
      quote: 'Finish the work, so we can call it in for inspection.',
      facts: [
        { who: 'You', text: 'Do the work, then report when it is done. You can call the office for a physical set of plans, or look for the Plans icon on the job card to open the plans online.' },
        { who: 'Us', text: 'Waiting on you.' },
      ],
      caption: "You do the work and report when it's done. We're waiting on you.",
    },
    {
      title: 'Pre-inspection',
      quote: "You told us the work's done. We've called it in for inspection.",
      facts: [
        { who: 'Us', text: 'We call it in for inspection.' },
        { who: 'You', text: "Sometimes we'll ask you to punch out a few things before it can pass. If your schedule is too busy for the punch work, no problem — tell us, we'll pay someone else to finish it, and that cost comes off this job." },
        { who: 'Then', text: 'It passes, and you move on.' },
      ],
      caption: 'We call it in for inspection. A short punch list may come first — yours, or ours at your cost.',
    },
    {
      title: 'Post-inspection: Trigger draw',
      quote: 'Passed inspection. Draw requested from the customer — their payment is the last thing between you and this money.',
      facts: [
        { who: 'Us', text: 'Once it passes, we can trigger a draw from the customer under our contract with them, and collect.' },
        { who: 'You', text: 'Nothing to do.' },
        { who: 'Sometimes', text: "Depending on the customer, we can give you a partial payment in advance. Often we can't — the card says so when we can." },
      ],
      caption: "It passed — we can trigger a draw from the customer. Sometimes part can come to you early.",
    },
    {
      title: "You're paid",
      quote: 'Cleared our account — sent to you today.',
      facts: [
        { who: 'Documents current with us', text: 'The same day it hits us, it hits you. Every payment then shows in your Payments list with the day and a memo.' },
        { who: 'Something missing or expired', text: "We hold your money until it's current. The bottom of the page shows exactly what — a COI, a W-9, a signature, or where to send your money." },
      ],
      caption: 'Documents current with us? The same day it hits us, it hits you.',
      time: 'Same day it hits us',
    },
  ],
  oneButton: {
    title: 'Your one button',
    sub: 'The only thing you do here',
    body: "When the work is finished, tap ✓ My work here is done on that job's card. Add a note if we should know something before we come out — a gate code, where the cleanout is. Then confirm.",
    demoTitle: 'Done with the work at 2210 Goforth Rd?',
    demoConfirm: '✓ Yes, ready for inspection',
    note: "This tells our office today's date and your name. It doesn't change what you're owed, and you can't undo it from here — call us if you tapped too soon.",
  },
  offers: {
    title: 'New work offers',
    sub: 'Take it or pass — no pressure',
    body: "When we have work for you, it shows under New work with the scope, the price, what's not included, and the date the offer expires. Read it, tick the confirmations, type your name and Sign to accept. Once signed it becomes a job card above and follows the same four steps. Passing asks for a short reason so we can plan.",
  },
  documents: {
    title: 'Your documents with us',
    sub: 'Current = paid the same day',
    body: 'Four things keep you payable: your insurance certificate (COI), your W-9, your signed agreements, and where to send your money. They sit at the bottom of the page with their dates. When one is expiring, missing or needs a signature, a Sign now or a date in red shows — and until it\'s current we hold your money. Worth a glance each month.',
    currentTitle: 'All current',
    currentBody: 'COI through Dec 31 · W-9 on file · Master agreement signed · pay to Zelle (512) ···-4471',
    lapsedTitle: 'COI expired Aug 31',
    lapsedBody: "We're holding $1,500.00 for you until a current certificate is on file.",
    lapsedButton: 'Send a new COI',
  },
  deductions: {
    title: 'Payments & deductions',
    sub: 'Reading the ledger',
    body: 'The Payments list shows every payment with the day it went out and a memo. A minus amount is a deduction we went over with you first — punch work we paid someone else to finish, a restock, a redo — and its memo says why. The balance at the bottom is what is still owed to you across every job, the same figure at the top of the page.',
  },
  comingSoon: {
    title: 'Coming soon',
    sub: "What we're building",
    tag: 'Coming soon',
    items: [
      { title: 'Pick your days', body: "Tell us which days you're free and we'll schedule you straight from here." },
      { title: 'Ask us from here', body: 'A question about a job or a payment, answered on this page instead of a phone call.' },
    ],
  },
  plansPill: 'Plans',
  plansCaption: 'Opens the plans for this job.',
  footerCall: 'Questions? Call us',
  close: 'Close',
}

const ES: GuideContent = {
  button: { title: '¿Cómo me pagan?', sub: 'Cómo funciona esta página · 2 min' },
  header: 'Cómo funciona esta página',
  bluf: '¿Cómo me pagan?',
  answer:
    'Haga el trabajo y toque ✓ Ya terminé este trabajo. Pedimos la inspección. Cuando pasa, podemos solicitar el pago al cliente. Cuando su dinero nos llega, si sus documentos están al día con nosotros, le llega a usted el mismo día. Cada tarjeta de trabajo muestra en qué paso va.',
  answerNote: 'Un documento faltante o vencido es lo único que retrasa esto. Al final de la página se ve qué está al día y qué no.',
  steps: [
    {
      title: 'Trabajo',
      quote: 'Termine el trabajo para que podamos pedir la inspección.',
      facts: [
        { who: 'Usted', text: 'Haga el trabajo y avísenos cuando quede listo. Puede llamar a la oficina por un juego de planos en papel, o buscar el ícono Planos en la tarjeta del trabajo para abrirlos en línea.' },
        { who: 'Nosotros', text: 'Esperamos su aviso.' },
      ],
      caption: 'Usted hace el trabajo y avisa cuando está listo. Esperamos su aviso.',
    },
    {
      title: 'Pre-inspección',
      quote: 'Nos avisó que el trabajo quedó listo. Pedimos la inspección.',
      facts: [
        { who: 'Nosotros', text: 'Pedimos la inspección.' },
        { who: 'Usted', text: 'A veces le pediremos rematar algunos detalles antes de que pase. Si su agenda no le da para ese remate, no hay problema: avísenos, le pagamos a alguien más para terminarlo y ese costo se descuenta de este trabajo.' },
        { who: 'Después', text: 'Pasa la inspección y sigue adelante.' },
      ],
      caption: 'Pedimos la inspección. Puede haber una lista corta de detalles antes — la hace usted, o nosotros con cargo a usted.',
    },
    {
      title: 'Post-inspección: solicitar pago',
      quote: 'Pasó la inspección. Pedimos el pago al cliente — es lo único que falta para este dinero.',
      facts: [
        { who: 'Nosotros', text: 'Cuando pasa, podemos solicitar el pago al cliente según nuestro contrato con él, y cobrarlo.' },
        { who: 'Usted', text: 'Nada que hacer.' },
        { who: 'A veces', text: 'Según el cliente, podemos darle un pago parcial por adelantado. Muchas veces no — la tarjeta lo dice cuando sí.' },
      ],
      caption: 'Pasó — podemos solicitar el pago al cliente. A veces una parte le llega antes.',
    },
    {
      title: 'Le pagamos',
      quote: 'Entró a nuestra cuenta — se lo enviamos hoy.',
      facts: [
        { who: 'Documentos al día', text: 'El mismo día que nos llega, le llega a usted. Cada pago aparece después en su lista de Pagos con la fecha y una nota.' },
        { who: 'Algo falta o venció', text: 'Retenemos su dinero hasta que esté al día. Al final de la página se ve exactamente qué: el COI, el W-9, una firma, o a dónde enviarle el dinero.' },
      ],
      caption: '¿Documentos al día? El mismo día que nos llega, le llega a usted.',
      time: 'El mismo día que nos llega',
    },
  ],
  oneButton: {
    title: 'Su único botón',
    sub: 'Lo único que usted hace aquí',
    body: 'Cuando el trabajo esté terminado, toque ✓ Ya terminé este trabajo en la tarjeta de ese trabajo. Agregue una nota si debemos saber algo antes de ir — el código del portón, dónde está la limpieza. Luego confirme.',
    demoTitle: '¿Terminó el trabajo en 2210 Goforth Rd?',
    demoConfirm: '✓ Sí, listo para la inspección',
    note: 'Esto le avisa a la oficina la fecha de hoy y su nombre. No cambia lo que se le debe, y no se puede deshacer desde aquí — llámenos si lo tocó antes de tiempo.',
  },
  offers: {
    title: 'Ofertas de trabajo nuevo',
    sub: 'Acéptelo o páselo — sin compromiso',
    body: 'Cuando tengamos trabajo para usted, aparece bajo Trabajo nuevo con el alcance, el precio, lo que no incluye y la fecha en que vence la oferta. Léala, marque las confirmaciones, escriba su nombre y firme para aceptar. Una vez firmada se vuelve una tarjeta de trabajo arriba y sigue los mismos cuatro pasos. Si la pasa, le pedimos un motivo corto para poder planear.',
  },
  documents: {
    title: 'Sus documentos con nosotros',
    sub: 'Al día = pago el mismo día',
    body: 'Cuatro cosas lo mantienen pagable: su certificado de seguro (COI), su W-9, sus acuerdos firmados y a dónde enviarle el dinero. Están al final de la página con sus fechas. Cuando uno está por vencer, falta o necesita firma, aparece un Firmar ahora o una fecha en rojo — y hasta que esté al día retenemos su dinero. Vale la pena revisarlo cada mes.',
    currentTitle: 'Todo al día',
    currentBody: 'COI hasta el 31 dic · W-9 en archivo · Acuerdo maestro firmado · pago por Zelle (512) ···-4471',
    lapsedTitle: 'COI venció el 31 ago',
    lapsedBody: 'Retenemos $1,500.00 para usted hasta tener un certificado vigente.',
    lapsedButton: 'Enviar COI nuevo',
  },
  deductions: {
    title: 'Pagos y descuentos',
    sub: 'Cómo leer el registro',
    body: 'La lista de Pagos muestra cada pago con la fecha en que salió y una nota. Un monto negativo es un descuento que revisamos con usted primero — remate que le pagamos a alguien más, una reposición, un retrabajo — y su nota dice por qué. El saldo al final es lo que todavía se le debe en todos los trabajos, la misma cifra de arriba.',
  },
  comingSoon: {
    title: 'Próximamente',
    sub: 'Lo que estamos construyendo',
    tag: 'Próximamente',
    items: [
      { title: 'Elija sus días', body: 'Díganos qué días está libre y lo programamos desde aquí.' },
      { title: 'Pregúntenos desde aquí', body: 'Una pregunta sobre un trabajo o un pago, respondida en esta página en vez de una llamada.' },
    ],
  },
  plansPill: 'Planos',
  plansCaption: 'Abre los planos de este trabajo.',
  footerCall: '¿Preguntas? Llámenos',
  close: 'Cerrar',
}

export function subPortalGuide(lang: SubPortalLang): GuideContent {
  return lang === 'es' ? ES : EN
}
