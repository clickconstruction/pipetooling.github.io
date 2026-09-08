/**
 * Electronic-signature consent (ESIGN / Texas UETA) — the one versioned source
 * for every signing surface. A signer sees one muted sentence with a
 * "How electronic signing works" link at its end; the link opens two paragraphs
 * beneath it; a separate five-word checkbox is the affirmative consent. The
 * exact words shown are stored with the signature (`esign_consents`), keyed by
 * `ESIGN_CONSENT_VERSION` + language, so what a person agreed to can be
 * reproduced later even after the copy changes.
 *
 * Bump `ESIGN_CONSENT_VERSION` whenever any signer-facing string here changes
 * (ESIGN § 7001(c)(1)(D): a material change re-presents the statement).
 *
 * Statutes: 15 U.S.C. § 7001 et seq. (ESIGN); Tex. Bus. & Com. Code ch. 322 (UETA).
 */

export const ESIGN_CONSENT_VERSION = 2

export type EsignLang = 'en' | 'es'
/** customer = homeowner / GC on an estimate or job contract (ESIGN consumer wording); sub = a subcontractor or staff signer; gc = the Bid Room (typed or drawn signature, approval wording). */
export type EsignAudience = 'customer' | 'sub' | 'gc'

export type EsignConsentText = {
  version: number
  lang: EsignLang
  audience: EsignAudience
  /** "this estimate" / "esta orden de trabajo" — carries its own determiner. */
  documentNoun: string
  /** The always-visible sentence. */
  line: string
  /** Link text at the end of the line. */
  howLabel: string
  /** The two paragraphs the link opens. */
  paragraphs: [string, string]
  /** "Full disclosure" link text (goes to ESIGN_DISCLOSURE_PATH). */
  disclosureLabel: string
  /** The five-word affirmative consent checkbox. */
  checkbox: string
  /** Everything the signer could read, joined — what gets stored on the ledger row. */
  clauseText: string
}

/** What the client sends with a signature and the function stores verbatim. */
export type EsignConsentPayload = {
  version: number
  lang: EsignLang
  audience: EsignAudience
  documentNoun: string
  clauseText: string
}

/** Public, login-free home of the full disclosure (ESIGN § 7001(c)(1)(B)–(C) in full). */
export const ESIGN_DISCLOSURE_PATH = '/estimate/terms#electronic-signatures'

/** Citations for the record: the signed block, PDF audit lines, print. */
export const ESIGN_STATUTE_LINE = '15 U.S.C. § 7001 · Tex. Bus. & Com. Code ch. 322'
export const ESIGN_STATUTE_SHORT = 'ESIGN Act · Tex. UETA ch. 322'

const EN = {
  line: 'Your typed or drawn signature has the same legal effect as one in ink, and you can ask the office for paper instead at no charge.',
  lineGc: 'Approving here is an electronic signature with the same effect as one in ink; your company can ask for a paper copy at any time.',
  how: 'How electronic signing works',
  disclosure: 'Full disclosure',
  checkbox: 'I agree to sign electronically.',
  p1: (noun: string, verb: 'signing' | 'approving', mark: string) =>
    `You're ${verb} ${noun} electronically. Under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), ${mark} has the same legal effect as one in ink, and this page and its PDF are your copy.`,
  p2: (verb: 'sign' | 'approve', paper: string, tail: string) =>
    `You don't have to ${verb} this way: ${paper}, at no charge. ${tail} You need a current browser and a way to save or print a PDF.`,
  tailSign: 'You can withdraw consent to electronic records later; anything already signed stays signed.',
  tailApprove: "Withdrawing consent later doesn't undo anything already approved.",
  paperCall: "call or email the office and we'll bring paper",
  paperReply: "reply to the email or call the office and we'll send paper",
}

const ES = {
  line: 'Su firma escrita o dibujada tiene la misma validez legal que una en tinta, y puede pedir a la oficina el documento en papel sin costo.',
  how: 'Cómo funciona la firma electrónica',
  disclosure: 'Aviso completo',
  checkbox: 'Acepto firmar electrónicamente.',
  p1: (noun: string) =>
    `Está firmando ${noun} electrónicamente. Conforme a la ley federal ESIGN (15 U.S.C. § 7001) y la UETA de Texas (Código de Negocios y Comercio, cap. 322), una firma escrita o dibujada tiene la misma validez legal que una en tinta, y esta página y su PDF son su copia.`,
  p2: 'No está obligado a firmar así: llame o escriba a la oficina y le llevaremos el documento en papel, sin costo. Puede retirar su consentimiento a los registros electrónicos más adelante; lo ya firmado sigue vigente. Necesita un navegador actual y una forma de guardar o imprimir un PDF.',
}

/**
 * The consent text for one signing surface. `documentNoun` includes its
 * determiner ("this estimate", "esta orden de trabajo").
 */
export function esignConsentText(opts: { audience: EsignAudience; documentNoun: string; lang?: EsignLang }): EsignConsentText {
  const lang: EsignLang = opts.lang === 'es' ? 'es' : 'en'
  const noun = opts.documentNoun.trim()
  let line: string
  let how: string
  let disclosure: string
  let checkbox: string
  let paragraphs: [string, string]
  if (lang === 'es') {
    line = ES.line
    how = ES.how
    disclosure = ES.disclosure
    checkbox = ES.checkbox
    paragraphs = [ES.p1(noun), ES.p2]
  } else if (opts.audience === 'gc') {
    line = EN.lineGc
    how = EN.how
    disclosure = EN.disclosure
    checkbox = EN.checkbox
    paragraphs = [EN.p1(noun, 'approving', 'a typed or drawn signature'), EN.p2('approve', EN.paperReply, EN.tailApprove)]
  } else {
    line = EN.line
    how = EN.how
    disclosure = EN.disclosure
    checkbox = EN.checkbox
    paragraphs = [EN.p1(noun, 'signing', 'a typed or drawn signature'), EN.p2('sign', EN.paperCall, EN.tailSign)]
  }
  const clauseText = [line, ...paragraphs, `${disclosure}: ${ESIGN_DISCLOSURE_PATH}`, `☐ ${checkbox}`].join('\n')
  return {
    version: ESIGN_CONSENT_VERSION,
    lang,
    audience: opts.audience,
    documentNoun: noun,
    line,
    howLabel: how,
    paragraphs,
    disclosureLabel: disclosure,
    checkbox,
    clauseText,
  }
}

export function esignConsentPayload(text: EsignConsentText): EsignConsentPayload {
  return { version: text.version, lang: text.lang, audience: text.audience, documentNoun: text.documentNoun, clauseText: text.clauseText }
}

/**
 * The statute suffix for an audit line: ` · 15 U.S.C. § 7001 · Tex. Bus. & Com. Code ch. 322`,
 * plus ` · consent v1 (en)` when the ledger row is known.
 */
export function esignAuditSuffix(consent?: { version: number; lang: string } | null): string {
  const v = consent ? ` · consent v${consent.version} (${consent.lang})` : ''
  return ` · ${ESIGN_STATUTE_LINE}${v}`
}

/** Short label for a signed-record facts line: "Consent v1 · en". */
export function esignConsentVersionLabel(consent: { version: number; lang: string }): string {
  return `Consent v${consent.version} · ${consent.lang}`
}

/**
 * One paragraph (or heading) of the public disclosure page — the seven ESIGN
 * consumer elements in plain words. `contact` is the office line from company
 * settings; when empty the page says "the office".
 */
export type EsignDisclosureSection = { heading: string | null; body: string }

export function esignDisclosureSections(opts: { lang?: EsignLang; companyName?: string | null; contactLine?: string | null }): EsignDisclosureSection[] {
  const lang: EsignLang = opts.lang === 'es' ? 'es' : 'en'
  const company = (opts.companyName ?? '').trim()
  const contact = (opts.contactLine ?? '').trim()
  if (lang === 'es') {
    return [
      {
        heading: null,
        body: `Ofrecemos presupuestos, acuerdos, avisos y otros documentos para revisar y firmar por internet. Esta página explica qué significa eso y cuáles son sus opciones. Aplica conforme a la ley federal ESIGN (15 U.S.C. § 7001 y siguientes) y la Ley Uniforme de Transacciones Electrónicas de Texas (Código de Negocios y Comercio de Texas, cap. 322).`,
      },
      { heading: 'Qué está aceptando', body: 'Al marcar "Acepto firmar electrónicamente", acepta que podemos entregarle este documento y los registros relacionados (su PDF, nuestra confirmación y cualquier orden de cambio o aviso sobre el mismo trabajo) por medios electrónicos. Su consentimiento cubre esta transacción. Cada documento nuevo lo pregunta de nuevo.' },
      { heading: 'Papel en su lugar', body: 'No está obligado a firmar ni recibir nada electrónicamente. Pida a la oficina una copia en papel, sin costo, y puede firmar esa en su lugar.' },
      { heading: 'Retirar su consentimiento', body: 'Puede retirar su consentimiento en cualquier momento llamando o escribiendo a la oficina. A partir de entonces le enviaremos papel. Lo que ya firmó electrónicamente sigue vigente.' },
      { heading: 'Obtener una copia en papel después', body: 'Pida a la oficina una copia impresa de cualquier documento firmado. Sin costo.' },
      { heading: 'Mantener sus datos de contacto al día', body: 'Avise a la oficina si cambia su correo electrónico o su número de teléfono para que los documentos le lleguen.' },
      { heading: 'Qué necesita', body: 'Un teléfono, tableta o computadora con un navegador actual y conexión a internet; una forma de guardar o imprimir un PDF; y un correo electrónico donde podamos enviarle su copia. Si alguna vez cambiamos lo necesario de forma que pudiera impedirle abrir sus documentos, se lo diremos y le pediremos su consentimiento de nuevo.' },
      { heading: 'Cómo comunicarse con la oficina', body: contact || (company ? `${company} — pregunte a la oficina.` : 'Pregunte a la oficina.') },
    ]
  }
  return [
    {
      heading: null,
      body: `We offer estimates, agreements, notices, and other records for review and signature on the web. This page explains what that means and what your choices are. It applies under the federal Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.) and the Texas Uniform Electronic Transactions Act (Tex. Bus. & Com. Code ch. 322).`,
    },
    { heading: "What you're agreeing to", body: 'When you tick "I agree to sign electronically," you agree that we may give you this document, and the records that go with it (its PDF, our confirmation, and any change orders or notices about the same work), electronically. Your consent covers this transaction. Each new document asks again.' },
    { heading: 'Paper instead', body: "You don't have to sign or receive anything electronically. Ask the office and we'll bring or mail a paper copy, at no charge, and you can sign that instead." },
    { heading: 'Withdrawing your consent', body: "You can withdraw your consent at any time by calling or emailing the office. From then on we'll send you paper. Anything you've already signed electronically stays in force." },
    { heading: 'Getting a paper copy later', body: 'Ask the office for a printed copy of any signed record. No charge.' },
    { heading: 'Keeping your contact details current', body: 'Tell the office if your email address or phone number changes so records reach you.' },
    { heading: 'What you need', body: "A phone, tablet, or computer with a current web browser and an internet connection; a way to save or print a PDF; and an email address where we can send your copy. If we ever change what's needed in a way that could keep you from opening your records, we'll tell you and ask for your consent again." },
    { heading: 'How to reach the office', body: contact || (company ? `${company} — ask the office.` : 'Ask the office.') },
  ]
}
