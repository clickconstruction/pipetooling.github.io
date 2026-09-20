/**
 * The words inside the shared signature form (v2.3636): the Type / Draw input and the contract
 * accept form carried English only, so a sub reading the portal in Español met an English form
 * at the one step that binds them. Callers pass `lang`; everything defaults to English.
 */
export type SignatureFormLang = 'en' | 'es'

export type SignatureFormStrings = {
  yourName: string
  namePlaceholder: string
  type: string
  draw: string
  modeAria: string
  signBelow: string
  drawAreaAria: string
  clearSignature: string
  submitting: string
  hintName: string
  hintConsent: string
  hintAgree: string
  hintDraw: string
}

const EN: SignatureFormStrings = {
  yourName: 'Your name',
  namePlaceholder: 'Your full legal name',
  type: 'Type',
  draw: 'Draw',
  modeAria: 'Sign by typing or drawing',
  signBelow: 'Sign below (use your finger or mouse)',
  drawAreaAria: 'Signature drawing area',
  clearSignature: 'Clear signature',
  submitting: 'Submitting…',
  hintName: 'Please enter your full name.',
  hintConsent: 'Please tick "I agree to sign electronically" to continue.',
  hintAgree: 'Please confirm that you agree.',
  hintDraw: 'Please sign in the box.',
}

const ES: SignatureFormStrings = {
  yourName: 'Su nombre',
  namePlaceholder: 'Su nombre legal completo',
  type: 'Escribir',
  draw: 'Dibujar',
  modeAria: 'Firme escribiendo o dibujando',
  signBelow: 'Firme abajo (con el dedo o el ratón)',
  drawAreaAria: 'Área para dibujar la firma',
  clearSignature: 'Borrar firma',
  submitting: 'Enviando…',
  hintName: 'Escriba su nombre completo.',
  hintConsent: 'Marque "Acepto firmar electrónicamente" para continuar.',
  hintAgree: 'Confirme que está de acuerdo.',
  hintDraw: 'Firme dentro del recuadro.',
}

export function signatureFormStrings(lang: SignatureFormLang | string | null | undefined): SignatureFormStrings {
  return lang === 'es' ? ES : EN
}
