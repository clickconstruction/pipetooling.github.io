import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { payLinkRefInText } from './billsSentIo'

describe('payLinkRefInText', () => {
  it('reads the bill a pay link names, by id or by its short code', () => {
    expect(payLinkRefInText('Your bill is ready: https://clicktooling.example/pay/AAAAAAAA-1111-4111-8111-111111111111 Thank you')).toEqual({ kind: 'id', value: 'aaaaaaaa-1111-4111-8111-111111111111' })
    expect(payLinkRefInText('Pay here my.northgate.example/pay/k7m2q9xwpd')).toEqual({ kind: 'code', value: 'k7m2q9xwpd' })
  })
  it('answers nothing for words with no pay link', () => {
    expect(payLinkRefInText('On my way, about 20 minutes.')).toBeNull()
    expect(payLinkRefInText('see /pay/')).toBeNull()
    expect(payLinkRefInText('see /pay/not-a-code')).toBeNull()
  })
})
