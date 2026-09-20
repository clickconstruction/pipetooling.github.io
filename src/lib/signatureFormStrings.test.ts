import { describe, expect, it } from 'vitest'
import { signatureFormStrings } from './signatureFormStrings'

describe('signatureFormStrings', () => {
  it('defaults to English for anything that is not es', () => {
    expect(signatureFormStrings(undefined).type).toBe('Type')
    expect(signatureFormStrings('fr').yourName).toBe('Your name')
    expect(signatureFormStrings('en').hintDraw).toBe('Please sign in the box.')
  })
  it('Spanish covers every key, none left in English or blank', () => {
    const en = signatureFormStrings('en')
    const es = signatureFormStrings('es')
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(es[key].trim(), key).not.toBe('')
      expect(es[key], key).not.toBe(en[key])
    }
    expect(es.hintConsent).toContain('Acepto firmar electrónicamente')
  })
})
