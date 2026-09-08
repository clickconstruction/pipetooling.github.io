import { describe, expect, it } from 'vitest'
import {
  ESIGN_CONSENT_VERSION,
  ESIGN_DISCLOSURE_PATH,
  ESIGN_STATUTE_LINE,
  esignAuditSuffix,
  esignConsentPayload,
  esignConsentText,
  esignConsentVersionLabel,
  esignDisclosureSections,
} from './esignConsent'

describe('esignConsentText', () => {
  it('customer, English: the approved line, the two paragraphs, the five-word checkbox', () => {
    const t = esignConsentText({ audience: 'customer', documentNoun: 'this agreement' })
    expect(t.version).toBe(ESIGN_CONSENT_VERSION)
    expect(t.lang).toBe('en')
    expect(t.line).toBe(
      'Your typed or drawn signature has the same legal effect as one in ink, and you can ask the office for paper instead at no charge.',
    )
    expect(t.howLabel).toBe('How electronic signing works')
    expect(t.paragraphs[0]).toBe(
      "You're signing this agreement electronically. Under the federal ESIGN Act (15 U.S.C. § 7001) and the Texas UETA (Bus. & Com. Code ch. 322), a typed or drawn signature has the same legal effect as one in ink, and this page and its PDF are your copy.",
    )
    expect(t.paragraphs[1]).toBe(
      "You don't have to sign this way: call or email the office and we'll bring paper, at no charge. You can withdraw consent to electronic records later; anything already signed stays signed. You need a current browser and a way to save or print a PDF.",
    )
    expect(t.disclosureLabel).toBe('Full disclosure')
    expect(t.checkbox).toBe('I agree to sign electronically.')
  })

  it('the noun carries into the first paragraph only', () => {
    const t = esignConsentText({ audience: 'customer', documentNoun: 'this estimate' })
    expect(t.paragraphs[0]).toMatch(/^You're signing this estimate electronically\./)
    expect(t.line).not.toContain('estimate')
    expect(t.paragraphs[1]).not.toContain('estimate')
  })

  it('sub, English, reads the same as the customer version', () => {
    const c = esignConsentText({ audience: 'customer', documentNoun: 'this work order' })
    const s = esignConsentText({ audience: 'sub', documentNoun: 'this work order' })
    expect(s.line).toBe(c.line)
    expect(s.paragraphs).toEqual(c.paragraphs)
    expect(s.checkbox).toBe(c.checkbox)
  })

  it('Spanish carries the whole surface, with the noun and its determiner', () => {
    const t = esignConsentText({ audience: 'sub', documentNoun: 'esta orden de trabajo', lang: 'es' })
    expect(t.lang).toBe('es')
    expect(t.line).toBe(
      'Su firma escrita o dibujada tiene la misma validez legal que una en tinta, y puede pedir a la oficina el documento en papel sin costo.',
    )
    expect(t.howLabel).toBe('Cómo funciona la firma electrónica')
    expect(t.paragraphs[0]).toMatch(/^Está firmando esta orden de trabajo electrónicamente\./)
    expect(t.paragraphs[0]).toContain('15 U.S.C. § 7001')
    expect(t.paragraphs[0]).toContain('cap. 322')
    expect(t.paragraphs[1]).toMatch(/^No está obligado a firmar así/)
    expect(t.checkbox).toBe('Acepto firmar electrónicamente.')
    expect(t.disclosureLabel).toBe('Aviso completo')
  })

  it('Bid Room (gc): approval wording, typed signature, reply-to-email paper path', () => {
    const t = esignConsentText({ audience: 'gc', documentNoun: 'this proposal' })
    expect(t.line).toBe(
      'Approving here is an electronic signature with the same effect as one in ink; your company can ask for a paper copy at any time.',
    )
    expect(t.paragraphs[0]).toMatch(/^You're approving this proposal electronically\./)
    expect(t.paragraphs[0]).toContain('a typed signature has the same legal effect')
    expect(t.paragraphs[1]).toMatch(/^You don't have to approve this way: reply to the email or call the office/)
    expect(t.paragraphs[1]).toContain("Withdrawing consent later doesn't undo anything already approved.")
  })

  it('unknown language falls back to English', () => {
    const t = esignConsentText({ audience: 'customer', documentNoun: 'this form', lang: 'fr' as never })
    expect(t.lang).toBe('en')
  })

  it('clauseText carries every word the signer could read, including the checkbox and the disclosure path', () => {
    const t = esignConsentText({ audience: 'customer', documentNoun: 'this estimate' })
    expect(t.clauseText).toContain(t.line)
    expect(t.clauseText).toContain(t.paragraphs[0])
    expect(t.clauseText).toContain(t.paragraphs[1])
    expect(t.clauseText).toContain(ESIGN_DISCLOSURE_PATH)
    expect(t.clauseText).toContain(t.checkbox)
  })

  it('the payload is the storable subset', () => {
    const t = esignConsentText({ audience: 'sub', documentNoun: 'este formulario', lang: 'es' })
    expect(esignConsentPayload(t)).toEqual({
      version: ESIGN_CONSENT_VERSION,
      lang: 'es',
      audience: 'sub',
      documentNoun: 'este formulario',
      clauseText: t.clauseText,
    })
  })
})

describe('audit helpers', () => {
  it('statute suffix with and without a ledger row', () => {
    expect(esignAuditSuffix()).toBe(` · ${ESIGN_STATUTE_LINE}`)
    expect(esignAuditSuffix(null)).toBe(` · ${ESIGN_STATUTE_LINE}`)
    expect(esignAuditSuffix({ version: 1, lang: 'en' })).toBe(` · ${ESIGN_STATUTE_LINE} · consent v1 (en)`)
  })
  it('version label', () => {
    expect(esignConsentVersionLabel({ version: 2, lang: 'es' })).toBe('Consent v2 · es')
  })
})

describe('esignDisclosureSections', () => {
  it('walks the seven ESIGN elements in English and prints the office contact', () => {
    const s = esignDisclosureSections({ companyName: 'Click Plumbing and Electrical', contactLine: 'Click Plumbing · (512) 555-0140' })
    expect(s[0]?.heading).toBeNull()
    expect(s[0]?.body).toContain('15 U.S.C. § 7001')
    expect(s.map((x) => x.heading).filter(Boolean)).toEqual([
      "What you're agreeing to",
      'Paper instead',
      'Withdrawing your consent',
      'Getting a paper copy later',
      'Keeping your contact details current',
      'What you need',
      'How to reach the office',
    ])
    expect(s[s.length - 1]?.body).toBe('Click Plumbing · (512) 555-0140')
  })
  it('falls back to "ask the office" when there is no contact line', () => {
    const s = esignDisclosureSections({ companyName: 'Click Plumbing' })
    expect(s[s.length - 1]?.body).toBe('Click Plumbing — ask the office.')
    expect(esignDisclosureSections({})[7]?.body).toBe('Ask the office.')
  })
  it('has a Spanish version with the same shape', () => {
    const s = esignDisclosureSections({ lang: 'es', contactLine: 'Oficina · (512) 555-0140' })
    expect(s).toHaveLength(8)
    expect(s[1]?.heading).toBe('Qué está aceptando')
    expect(s[7]?.body).toBe('Oficina · (512) 555-0140')
  })
})
