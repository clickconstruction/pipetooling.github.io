import { describe, expect, it } from 'vitest'
import { textRefusal } from './textingRule'

describe('textRefusal', () => {
  it('lets a yes through, and holds a no and a not-asked with the person named', () => {
    expect(textRefusal({ ok_to_text: 'yes', contact_name: 'Tomás Reyna', company_name: 'Bexar Fire Protection' })).toBeNull()
    expect(textRefusal({ ok_to_text: 'no', contact_name: 'Tomás Reyna', company_name: 'Bexar Fire Protection' })).toEqual({ refused: 'noTexts', words: 'Tomás Reyna said not to text them. Call or email instead.' })
    expect(textRefusal({ ok_to_text: 'not_asked', contact_name: null, company_name: 'Bexar Fire Protection' })).toEqual({ refused: 'notAskedToText', words: 'Bexar Fire Protection has not said we may text. Ask on the call, then set May we text? on their card.' })
    expect(textRefusal({ ok_to_text: null, contact_name: null, company_name: null })?.words).toBe('They has not said we may text. Ask on the call, then set May we text? on their card.')
    expect(textRefusal(null)).toBeNull()
  })
})
