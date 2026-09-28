import { describe, expect, it } from 'vitest'
import { esignConsentPayload, esignConsentText } from '../esignConsent'
import {
  CHANGE_ORDER_AGREE_HINT,
  CHANGE_ORDER_CONSENT_HINT,
  CHANGE_ORDER_CONSENT_NOUN,
  CHANGE_ORDER_DRAW_HINT,
  CHANGE_ORDER_NAME_HINT,
  changeOrderSignBody,
  changeOrderSignError,
  type ChangeOrderSignInput,
} from './changeOrderSign'

const ready: ChangeOrderSignInput = { printedName: 'Dana Ruiz', consented: true, agreed: true, mode: 'type', drawnPng: null }
const consent = esignConsentPayload(esignConsentText({ audience: 'gc', documentNoun: CHANGE_ORDER_CONSENT_NOUN }))

describe('changeOrderSignError', () => {
  it('lets a named, consented, agreed typed signature through', () => {
    expect(changeOrderSignError(ready)).toBeNull()
  })

  it('asks for the name first', () => {
    expect(changeOrderSignError({ ...ready, printedName: '   ', consented: false, agreed: false })).toBe(CHANGE_ORDER_NAME_HINT)
  })

  it('blocks a signature without the electronic-signature consent, even with the agree box ticked', () => {
    expect(changeOrderSignError({ ...ready, consented: false })).toBe(CHANGE_ORDER_CONSENT_HINT)
  })

  it('asks for consent before the agree box when both are missing', () => {
    expect(changeOrderSignError({ ...ready, consented: false, agreed: false })).toBe(CHANGE_ORDER_CONSENT_HINT)
  })

  it('blocks a signature without the agree box', () => {
    expect(changeOrderSignError({ ...ready, agreed: false })).toBe(CHANGE_ORDER_AGREE_HINT)
  })

  it('refuses an empty pad in draw mode, and only then', () => {
    expect(changeOrderSignError({ ...ready, mode: 'draw', drawnPng: null })).toBe(CHANGE_ORDER_DRAW_HINT)
    expect(changeOrderSignError({ ...ready, mode: 'draw', drawnPng: 'data:image/png;base64,AAA' })).toBeNull()
    expect(changeOrderSignError({ ...ready, mode: 'type', drawnPng: null })).toBeNull()
  })

  it('names the consent checkbox by the words the signer sees', () => {
    const text = esignConsentText({ audience: 'gc', documentNoun: CHANGE_ORDER_CONSENT_NOUN })
    expect(CHANGE_ORDER_CONSENT_HINT).toContain(text.checkbox.replace(/\.$/, ''))
  })
})

describe('changeOrderSignBody', () => {
  it('carries the consent payload with a typed signature and no PNG key', () => {
    const body = changeOrderSignBody('co-1', { ...ready, printedName: '  Dana Ruiz  ' }, consent)
    expect(body).toEqual({ action: 'sign', documentId: 'co-1', printedName: 'Dana Ruiz', agreedTerms: true, esignConsent: consent })
    expect('signaturePngBase64' in body).toBe(false)
  })

  it('adds the PNG for a drawn signature', () => {
    const body = changeOrderSignBody('co-1', { ...ready, mode: 'draw', drawnPng: 'data:image/png;base64,AAA' }, consent)
    expect(body.signaturePngBase64).toBe('data:image/png;base64,AAA')
    expect(body.esignConsent).toEqual(consent)
  })

  it('drops a leftover drawing when the signer switched back to typing', () => {
    const body = changeOrderSignBody('co-1', { ...ready, mode: 'type', drawnPng: 'data:image/png;base64,AAA' }, consent)
    expect('signaturePngBase64' in body).toBe(false)
  })

  it('sends the gc wording for this change order, ending in the checkbox the card renders', () => {
    expect(consent.audience).toBe('gc')
    expect(consent.documentNoun).toBe('this change order')
    expect(consent.clauseText).toContain("You're approving this change order electronically.")
    expect(consent.clauseText.endsWith('☐ I agree to sign electronically.')).toBe(true)
  })
})
